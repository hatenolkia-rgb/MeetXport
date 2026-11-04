// Website enquiries (contact form + chat widget) → CRM lead, with the automatic
// WhatsApp/email welcome. Public endpoint: validated, size-limited, honeypot-protected.

const { adminDb, readJson, extractEmail, extractPhone } = require('./_shared')
const { intakeLead } = require('./_intake')
const { sendLeadEvent } = require('./_capi')

const recent = new Map() // best-effort per-instance rate limit
function tooMany(ip) {
  const now = Date.now()
  const hits = (recent.get(ip) || []).filter(t => now - t < 10 * 60e3)
  hits.push(now)
  recent.set(ip, hits)
  return hits.length > 5
}

const clip = (v, n) => (v === undefined || v === null || v === '') ? null : String(v).trim().slice(0, n)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = await readJson(req)
  if (body.website) return res.status(200).json({ ok: true }) // honeypot filled → bot
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many requests' })

  const contact = clip(body.contact, 200) || ''
  const fields = {
    source: body.source === 'chatbot' ? 'website_chat' : 'website_form',
    name: clip(body.name, 200),
    company: clip(body.company, 200),
    business_type: body.role === 'buyer' ? 'importer' : body.role === 'exporter' ? 'exporter' : clip(body.business_type, 60),
    experience: clip(body.experience, 60),
    city: clip(body.city, 120),
    country: clip(body.country, 120),
    products: clip(body.category || body.product, 300),
    phone: extractPhone(body.phone || contact),
    email: extractEmail(body.email || contact),
    services: clip(body.interest || body.service, 200),
    message: [clip(body.message, 3000), !extractPhone(contact) && !extractEmail(contact) && contact ? `Contact given: ${contact}` : null].filter(Boolean).join('\n') || null,
  }
  // The chat widget asks for "name + phone/email" in one answer.
  if (!fields.name && contact) {
    const rest = contact.replace(/\S+@\S+/g, '').replace(/\+?[\d][\d\s\-().]{8,}\d/g, '').replace(/[,;:|-]+/g, ' ').trim()
    if (rest && rest.length <= 80) fields.name = rest
  }
  if (!fields.phone && !fields.email && !fields.name && !fields.message) return res.status(400).json({ error: 'Empty enquiry' })

  // Tell Meta about the enquiry (Conversions API) alongside saving it; neither waits on the other.
  const [capi, saved] = await Promise.allSettled([
    sendLeadEvent(req, body, fields),
    (async () => intakeLead(adminDb(), fields, { note: fields.source === 'website_chat' ? 'Website chat enquiry' : 'Website contact form enquiry' }))(),
  ])
  if (capi.status === 'fulfilled' && !capi.value.ok) console.error('Meta Lead event not sent', capi.value.error)
  if (saved.status === 'rejected') {
    console.error('Website lead failed', saved.reason && saved.reason.message)
    return res.status(500).json({ error: 'Could not save enquiry' })
  }
  return res.status(200).json({ ok: true, ref: saved.value.lead.lead_code })
}
