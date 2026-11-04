// Meta Conversions API: tells Meta about a website enquiry from the server, so it is counted
// even when the visitor's browser blocks the pixel. Same event id as the pixel → counted once.
const crypto = require('crypto')
const { env } = require('./_shared')

const PIXEL_ID = () => env('META_PIXEL_ID') || '1670229504613904'
const TOKEN = () => env('META_CAPI_TOKEN') || env('META_PAGE_ACCESS_TOKEN')
const sha = v => crypto.createHash('sha256').update(v).digest('hex')

async function sendLeadEvent(req, body, fields) {
  if (!TOKEN()) return { ok: false, error: 'META_CAPI_TOKEN not set' }
  const user = {
    client_ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: typeof body.fbp === 'string' ? body.fbp.slice(0, 200) : undefined,
    fbc: typeof body.fbc === 'string' ? body.fbc.slice(0, 300) : undefined,
  }
  if (fields.email) user.em = [sha(fields.email.trim().toLowerCase())]
  if (fields.phone) user.ph = [sha(fields.phone.replace(/\D/g, ''))]
  if (fields.name) user.fn = [sha(fields.name.trim().split(/\s+/)[0].toLowerCase())]
  if (fields.country) user.country = [sha(fields.country.trim().toLowerCase().slice(0, 2))]
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: typeof body.event_id === 'string' ? body.event_id.slice(0, 100) : undefined,
    event_source_url: typeof body.page === 'string' ? body.page.slice(0, 500) : req.headers.referer,
    action_source: 'website',
    user_data: user,
    custom_data: { content_name: fields.source },
  }
  const payload = { data: [event] }
  if (env('META_CAPI_TEST_CODE')) payload.test_event_code = env('META_CAPI_TEST_CODE')
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${PIXEL_ID()}/events?access_token=${encodeURIComponent(TOKEN())}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data.error && data.error.message) || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

module.exports = { sendLeadEvent }
