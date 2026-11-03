// One way in for every new enquiry — Instagram/Facebook lead forms, the DM bot,
// WhatsApp, the website form and chat. Finds an existing lead for the same person
// (Meta lead id, Instagram/Facebook user, phone or email) and fills in what's new,
// otherwise creates a lead with the next MX- serial number.

const { normalizePhone, getSettings, logActivity, claimOnce } = require('./_shared')
const { autoWelcome, notifyTeam } = require('./_messaging')

// Service keys — the same ones the website contact form and the CRM use.
const SERVICES = {
  outreach: 'Buyer outreach',
  leads: 'Verified buyer leads',
  blueprint: 'Export buyer blueprint',
  'event-meetings': 'Trade fair meetings',
  'shipment-insurance': 'Shipment insurance',
  'buyer-verification': 'Buyer verification',
  'payment-recovery': 'Payment recovery',
  documentation: 'Documentation / ECGC',
  'factory-visits': 'Factory visit',
  'curated-buyers': 'Curated buyer portfolio',
  'direct-buyer-meet': 'Direct buyer meet',
  'shipment-check': 'Product & shipment check',
  ecgc: 'ECGC support',
  both: 'Not sure yet',
}

const SERVICE_WORDS = [
  [/outreach|find.*buyer|new buyer|buyer search/i, 'outreach'],
  [/lead/i, 'leads'],
  [/blueprint/i, 'blueprint'],
  [/fair|event|exhibition|\bexpo\b|meeting/i, 'event-meetings'],
  [/insur|claim/i, 'shipment-insurance'],
  [/verif/i, 'buyer-verification'],
  [/recover|payment.*(stuck|due|pending)/i, 'payment-recovery'],
  [/ecgc/i, 'ecgc'],
  [/document|paperwork|licen[cs]e|iec/i, 'documentation'],
  [/factory|visit|inspection/i, 'factory-visits'],
  [/curat|portfolio/i, 'curated-buyers'],
  [/quality|shipment check|product check/i, 'shipment-check'],
  [/not sure|all|everything|help/i, 'both'],
]

function parseServices(value) {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(/[,;/\n]| and /i)
  const keys = new Set()
  for (const item of list) {
    const s = String(item).trim()
    if (!s) continue
    if (SERVICES[s]) { keys.add(s); continue }
    const hit = SERVICE_WORDS.find(([re]) => re.test(s))
    keys.add(hit ? hit[1] : s.slice(0, 60))
  }
  return [...keys]
}

function parseBusinessType(value) {
  const s = String(value || '').toLowerCase().trim()
  if (!s) return null
  if (/^1$|^importer$/.test(s)) return 'importer'
  if (/^2$|^exporter$/.test(s)) return 'exporter'
  if (/^3$/.test(s)) return 'service_provider'
  if (/^4$/.test(s)) return 'beginner'
  if (/both|import.*export|export.*import|exim/.test(s)) return 'importer_exporter'
  if (/begin|new|start|fresh|not yet|planning|want to/.test(s)) return 'beginner'
  if (/servic|agent|consult|freight|forward|\bcha\b|logistic|provider/.test(s)) return 'service_provider'
  if (/export|manufactur|supplier|seller/.test(s)) return 'exporter'
  if (/import|buyer|trader|distribut/.test(s)) return 'importer'
  return 'other'
}

function parseExperience(value) {
  const s = String(value || '').toLowerCase().trim()
  if (!s) return null
  if (/^[1-5]$/.test(s)) return ['starting', 'under_1', '1_3', '3_5', '5_plus'][Number(s) - 1] // numbered menu reply
  if (/just|start|new|not yet|planning|none|beginner|^0$/.test(s)) return 'starting'
  if (/less|under|<|month/.test(s)) return 'under_1'
  const range = s.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/)
  if (range) {
    const upper = Number(range[2])
    return upper <= 1 ? 'under_1' : upper <= 3 ? '1_3' : upper <= 5 ? '3_5' : '5_plus'
  }
  const single = s.match(/\d+(?:\.\d+)?/)
  if (!single) return /more|over|long|many/.test(s) ? '5_plus' : null
  const n = Number(single[0])
  return n < 1 ? 'under_1' : n < 3 ? '1_3' : n < 5 ? '3_5' : '5_plus'
}

const MATCH_FIELDS = ['name', 'company', 'business_type', 'experience', 'city', 'country', 'phone', 'email', 'products', 'message',
  'meta_lead_id', 'meta_form_name', 'campaign_name', 'ad_name', 'social_user_id', 'social_username']

async function findExisting(db, f) {
  const tries = []
  if (f.meta_lead_id) tries.push(q => q.eq('meta_lead_id', f.meta_lead_id))
  if (f.social_user_id) tries.push(q => q.eq('social_user_id', f.social_user_id))
  if (f.phone) tries.push(q => q.like('phone', '%' + f.phone.slice(-10)))
  if (f.email) tries.push(q => q.ilike('email', f.email))
  for (const t of tries) {
    const { data } = await t(db.from('crm_leads').select('*')).neq('stage', 'lost').order('created_at', { ascending: false }).limit(1)
    if (data?.[0]) return data[0]
  }
  return null
}

// fields: any crm_leads columns (raw), plus services as array/text.
// Returns { lead, created }.
async function intakeLead(db, fields, { welcome = true, note = null } = {}) {
  const f = { ...fields }
  if (f.phone) f.phone = normalizePhone(f.phone)
  if (f.email) f.email = String(f.email).trim().toLowerCase()
  if (f.business_type && !['importer', 'exporter', 'importer_exporter', 'service_provider', 'beginner', 'other'].includes(f.business_type)) f.business_type = parseBusinessType(f.business_type)
  if (f.experience && !['starting', 'under_1', '1_3', '3_5', '5_plus'].includes(f.experience)) f.experience = parseExperience(f.experience)
  const services = parseServices(f.services)
  delete f.services
  for (const k of Object.keys(f)) if (f[k] === '' || f[k] === undefined) delete f[k]

  const existing = await findExisting(db, f)
  let lead, created = false
  if (existing) {
    // Only fill gaps; never overwrite what the team has already corrected.
    const patch = {}
    for (const k of MATCH_FIELDS) if (f[k] && !existing[k]) patch[k] = f[k]
    if (f.message && existing.message && !existing.message.includes(f.message)) patch.message = `${existing.message}\n\n${f.message}`.slice(0, 8000)
    const merged = [...new Set([...(existing.services || []), ...services])]
    if (merged.length !== (existing.services || []).length) patch.services = merged
    if (Object.keys(patch).length) {
      const { data, error } = await db.from('crm_leads').update(patch).eq('id', existing.id).select().single()
      if (error) throw error
      lead = data
    } else lead = existing
    if (note) await logActivity(db, lead.id, { kind: 'system', body: note })
  } else {
    const { data, error } = await db.from('crm_leads').insert({ ...f, services }).select().single()
    if (error) throw error
    lead = data
    created = true
    await logActivity(db, lead.id, { kind: 'system', body: note || `New lead from ${f.source || 'manual entry'}` })
  }

  // Website enquiries already reach the team by email from the site itself (FormSubmit).
  // Chat leads alert once the number is in or the chat ends — the same moment as the welcome.
  const alert = welcome && !/^website/.test(lead.source || '')
  if (welcome || alert) {
    try {
      const settings = await getSettings(db)
      if (alert && await claimOnce(db, `notify:${lead.id}`)) await notifyTeam(lead, settings, SERVICES)
      if (welcome) await autoWelcome(db, lead, settings)
    } catch (err) { console.error('Welcome / team alert failed', lead.id, err.message) }
  }
  return { lead, created }
}

module.exports = { SERVICES, intakeLead, parseServices, parseBusinessType, parseExperience }
