// Server actions for the CRM page (crm.html). Every request must carry the signed-in
// user's Supabase access token; the user must be an active crm_users member, and team
// management / settings actions need the super_admin role.
//
// POST /api/crm  { action, ... }
//   status                       → which integrations are connected
//   whatsapp   { lead_id, kind: welcome|community|payment|text, text? }
//   email      { lead_id, kind: welcome|payment|custom, subject?, body? }
//   sync-meta  { days? }         → pull recent Instagram/Facebook lead-form leads
//   user-create { email, full_name, role, password }      (super admin)
//   user-update { id, full_name?, role?, active?, password? }  (super admin)
//   wa-templates                 → submit the WhatsApp templates to Meta (super admin)
//
// GET /api/crm?cron=sync — daily Vercel cron (Authorization: Bearer CRON_SECRET).

const { env, adminDb, readJson, getSettings } = require('./_shared')
const { whatsappToLead, emailToLead, submitTemplates, whatsappConfigured, emailConfigured, TEMPLATE_DEFINITIONS } = require('./_messaging')
const { syncMetaLeads, metaConfigured } = require('./_meta')

async function currentUser(db, req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: member } = await db.from('crm_users').select('*').eq('id', data.user.id).eq('active', true).maybeSingle()
  return member || null
}

async function loadLead(db, id) {
  const { data } = await db.from('crm_leads').select('*').eq('id', id).maybeSingle()
  return data
}

const ROLES = ['super_admin', 'member']

module.exports = async function handler(req, res) {
  let db
  try { db = adminDb() } catch (err) { return res.status(500).json({ error: err.message }) }

  if (req.method === 'GET' && req.query.cron === 'sync') {
    if (!env('CRON_SECRET') || req.headers.authorization !== `Bearer ${env('CRON_SECRET')}`) return res.status(401).json({ error: 'Unauthorized' })
    if (!metaConfigured()) return res.status(200).json({ skipped: 'Meta not connected' })
    try { return res.status(200).json(await syncMetaLeads(db, 3)) }
    catch (err) { return res.status(500).json({ error: err.message }) }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await currentUser(db, req)
  if (!user) return res.status(401).json({ error: 'Please sign in again' })
  const isSuper = user.role === 'super_admin'
  const body = await readJson(req)

  try {
    switch (body.action) {
      case 'status':
        return res.json({
          whatsapp: whatsappConfigured(), email: emailConfigured(), meta: metaConfigured(),
          whatsapp_templates: Object.fromEntries(Object.entries(TEMPLATE_DEFINITIONS).map(([k, d]) => [k, d.body])),
          email_from: env('EMAIL_FROM') || null,
        })

      case 'whatsapp': {
        const lead = await loadLead(db, body.lead_id)
        if (!lead) return res.status(404).json({ error: 'Lead not found' })
        const result = await whatsappToLead(db, lead, await getSettings(db), body.kind, { userId: user.id, text: body.text || '' })
        return res.status(result.ok ? 200 : 400).json(result)
      }

      case 'email': {
        const lead = await loadLead(db, body.lead_id)
        if (!lead) return res.status(404).json({ error: 'Lead not found' })
        const result = await emailToLead(db, lead, await getSettings(db), body.kind, { userId: user.id, subject: body.subject || '', body: body.body || '' })
        return res.status(result.ok ? 200 : 400).json(result)
      }

      case 'sync-meta':
        return res.json(await syncMetaLeads(db, Math.min(Number(body.days) || 7, 90)))

      case 'user-create': {
        if (!isSuper) return res.status(403).json({ error: 'Only a super admin can add team members' })
        const email = String(body.email || '').trim().toLowerCase()
        const fullName = String(body.full_name || '').trim()
        const role = ROLES.includes(body.role) ? body.role : 'member'
        if (!email || !fullName) return res.status(400).json({ error: 'Name and email are required' })
        if (String(body.password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
        const { data: created, error } = await db.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { full_name: fullName } })
        if (error) return res.status(400).json({ error: error.message })
        const { data: member, error: insertError } = await db.from('crm_users')
          .insert({ id: created.user.id, email, full_name: fullName, role, phone: body.phone || null }).select().single()
        if (insertError) return res.status(400).json({ error: insertError.message })
        return res.json({ ok: true, user: member })
      }

      case 'user-update': {
        if (!isSuper) return res.status(403).json({ error: 'Only a super admin can change team members' })
        const { data: target } = await db.from('crm_users').select('*').eq('id', body.id).maybeSingle()
        if (!target) return res.status(404).json({ error: 'User not found' })
        const patch = {}
        if (body.full_name) patch.full_name = String(body.full_name).trim()
        if (body.phone !== undefined) patch.phone = body.phone || null
        if (ROLES.includes(body.role)) patch.role = body.role
        if (typeof body.active === 'boolean') patch.active = body.active
        // Never lock the team out: keep at least one active super admin.
        if ((patch.role === 'member' || patch.active === false) && target.role === 'super_admin') {
          const { count } = await db.from('crm_users').select('id', { count: 'exact', head: true }).eq('role', 'super_admin').eq('active', true)
          if ((count || 0) <= 1) return res.status(400).json({ error: 'There must be at least one active super admin' })
        }
        if (body.password) {
          if (String(body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
          const { error } = await db.auth.admin.updateUserById(target.id, { password: body.password })
          if (error) return res.status(400).json({ error: error.message })
        }
        if (Object.keys(patch).length) {
          const { error } = await db.from('crm_users').update(patch).eq('id', target.id)
          if (error) return res.status(400).json({ error: error.message })
        }
        return res.json({ ok: true })
      }

      case 'wa-templates':
        if (!isSuper) return res.status(403).json({ error: 'Only a super admin can submit templates' })
        return res.json({ results: await submitTemplates(await getSettings(db)) })

      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (err) {
    console.error('CRM action failed', body.action, err)
    return res.status(500).json({ error: err.message })
  }
}
