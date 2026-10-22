// Shared helpers for the Meetxport CRM server functions (files starting with "_"
// are not deployed as their own Vercel functions).

const { createClient } = require('@supabase/supabase-js')

const env = name => (process.env[name] || '').trim().replace(/^["']|["']$/g, '')

let adminClient = null
// Service-role client: bypasses row level security, so only ever used on the server.
function adminDb() {
  if (!adminClient) {
    if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    adminClient = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  }
  return adminClient
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const raw = await readRawBody(req)
  try { return JSON.parse(raw.toString('utf8') || '{}') } catch (_) { return {} }
}

// Phone → digits with country code. A bare 10-digit number is taken as Indian (+91).
function normalizePhone(value) {
  let d = String(value || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = '91' + d
  return d.length >= 10 && d.length <= 15 ? d : null
}

const EMAIL_RE = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i
const extractEmail = text => (String(text || '').match(EMAIL_RE) || [null])[0]
function extractPhone(text) {
  const candidates = String(text || '').match(/\+?[\d][\d\s\-().]{8,}\d/g) || []
  for (const c of candidates) { const p = normalizePhone(c); if (p) return p }
  return null
}

const firstName = name => (name && String(name).trim().split(/\s+/)[0]) || 'there'

// "{name}" style placeholders in message wording from Settings.
const fill = (text, vars) => String(text || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))

async function getSettings(db) {
  const { data } = await db.from('crm_settings').select('key, value')
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
}

async function logActivity(db, leadId, { kind, body, status = null, externalId = null, userId = null }) {
  if (!leadId) return
  const { error } = await db.from('crm_activities').insert({
    lead_id: leadId, kind, body: String(body).slice(0, 5000), status, external_id: externalId, user_id: userId,
  })
  if (error) console.error('Could not log activity', error.message)
}

// Webhook de-duplication: true the first time a key is seen.
async function claimOnce(db, key) {
  const { error } = await db.from('crm_webhook_seen').insert({ key })
  return !error
}

module.exports = {
  env, adminDb, readRawBody, readJson, normalizePhone, extractEmail, extractPhone,
  firstName, fill, getSettings, logActivity, claimOnce,
}
