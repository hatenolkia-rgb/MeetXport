// Meta webhook for the Meetxport CRM — one URL for every Meta event:
//   * object "page"      — Facebook/Instagram lead form submissions (field "leadgen"),
//                          Page post/ad comments (field "feed"), Messenger DMs
//   * object "instagram" — Instagram DMs (messaging) and comments (field "comments")
//   * object "whatsapp_business_account" — WhatsApp delivery receipts and incoming replies
//
// Callback URL: https://meetxport.com/api/meta-webhook
// Verify token: META_VERIFY_TOKEN. Every POST is checked against META_APP_SECRET.

const crypto = require('crypto')
const { env, adminDb, readRawBody, normalizePhone, logActivity, claimOnce } = require('./_shared')
const { intakeLead } = require('./_intake')
const { saveMetaLead, formName, igAccountId, metaConfigured } = require('./_meta')
const { handleMessage, handleComment } = require('./_dmBot')

function validSignature(raw, header) {
  const secret = env('META_APP_SECRET')
  if (!secret || !header) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(String(header))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function handleLeadgen(db, value) {
  if (!value.leadgen_id || !metaConfigured()) return
  await saveMetaLead(db, value.leadgen_id, await formName(value.form_id))
}

const WA_STATUS_ORDER = ['sent', 'delivered', 'read']

async function handleWhatsApp(db, value) {
  // Delivery receipts → the matching "WhatsApp: …" line on the lead's timeline.
  for (const st of value.statuses || []) {
    const { data: act } = await db.from('crm_activities').select('id, status, body').eq('external_id', st.id).maybeSingle()
    if (!act) continue
    if (st.status === 'failed') {
      const e = st.errors?.[0] || {}
      await db.from('crm_activities').update({
        status: 'failed', body: `${act.body.split(' — ')[0]} — not delivered (${[e.code, e.title, e.error_data?.details].filter(Boolean).join(' · ')})`.slice(0, 5000),
      }).eq('id', act.id)
    } else if (WA_STATUS_ORDER.indexOf(st.status) > WA_STATUS_ORDER.indexOf(act.status)) {
      await db.from('crm_activities').update({ status: st.status }).eq('id', act.id)
    }
  }

  // A lead writing back on WhatsApp → on their timeline (or a new lead if unknown).
  const name = value.contacts?.[0]?.profile?.name || null
  for (const m of value.messages || []) {
    if (!await claimOnce(db, `wa:${m.id}`)) continue
    const phone = normalizePhone(m.from)
    const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || `[${m.type}]`
    const { data: found } = await db.from('crm_leads').select('id').like('phone', '%' + (phone || '').slice(-10)).order('created_at', { ascending: false }).limit(1)
    if (found?.[0]) {
      await logActivity(db, found[0].id, { kind: 'whatsapp', status: 'received', body: `WhatsApp reply: "${text.slice(0, 1000)}"` })
    } else if (phone) {
      await intakeLead(db, { source: 'whatsapp', phone, name, message: text.slice(0, 1000) }, { welcome: false, note: 'Messaged Meetxport on WhatsApp' })
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && env('META_VERIFY_TOKEN') && req.query['hub.verify_token'] === env('META_VERIFY_TOKEN')) {
      return res.status(200).send(req.query['hub.challenge'])
    }
    return res.status(403).send('Verification failed')
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const raw = await readRawBody(req)
  if (!validSignature(raw, req.headers['x-hub-signature-256'])) return res.status(401).json({ error: 'Invalid signature' })

  let payload
  try { payload = JSON.parse(raw.toString('utf8')) } catch (_) { return res.status(400).json({ error: 'Invalid JSON' }) }

  let db
  try { db = adminDb() } catch (err) { return res.status(200).json({ skipped: err.message }) }

  const ownIds = [env('META_PAGE_ID'), await igAccountId().catch(() => null)].filter(Boolean)
  let failed = false

  for (const entry of payload.entry || []) {
    if (payload.object === 'page' || payload.object === 'instagram') {
      const platform = payload.object === 'page' ? 'facebook' : 'instagram'
      for (const change of entry.changes || []) {
        const v = change.value || {}
        try {
          if (change.field === 'leadgen') await handleLeadgen(db, v)
          else if (change.field === 'feed' && v.item === 'comment' && v.verb === 'add') {
            await handleComment(db, 'facebook', { commentId: v.comment_id, fromId: v.from?.id, fromName: v.from?.name, text: v.message, ownIds })
          } else if (change.field === 'comments') {
            await handleComment(db, 'instagram', { commentId: v.id, fromId: v.from?.id, fromName: null, text: v.text, ownIds })
          }
        } catch (err) {
          // Lead form events are retried by Meta (and de-duplicated by meta_lead_id).
          console.error(`${platform} ${change.field} event failed`, err.message)
          if (change.field === 'leadgen') failed = true
        }
      }
      for (const event of entry.messaging || []) {
        try { await handleMessage(db, platform, event) }
        catch (err) { console.error(`${platform} message failed`, event.message?.mid, err.message) }
      }
    } else if (payload.object === 'whatsapp_business_account') {
      for (const change of entry.changes || []) {
        try { await handleWhatsApp(db, change.value || {}) }
        catch (err) { console.error('WhatsApp event failed', err.message) }
      }
    }
  }
  return res.status(failed ? 500 : 200).json({ ok: !failed })
}

module.exports.config = { api: { bodyParser: false } }
