// Meta Graph API: Instagram/Facebook lead forms and Instagram/Messenger messages.
// Needs META_PAGE_ID and META_PAGE_ACCESS_TOKEN (a Page token, or a system-user token
// with access to the Page — it is swapped for the Page's own token automatically).
// Permissions: leads_retrieval, pages_manage_metadata, pages_messaging,
// instagram_basic, instagram_manage_messages, instagram_manage_comments.

const { env } = require('./_shared')
const { intakeLead } = require('./_intake')

const GRAPH = 'https://graph.facebook.com/v21.0'
const metaConfigured = () => !!(env('META_PAGE_ID') && env('META_PAGE_ACCESS_TOKEN'))

async function graph(path, { params = {}, body = null, method = body ? 'POST' : 'GET', token = null } = {}) {
  const url = new URL(path.startsWith('https://') ? path : `${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', token || await pageToken())
  const res = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined, headers: body ? { 'Content-Type': 'application/json' } : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data.error?.message || `Meta Graph API error ${res.status}`)
  return data
}

let tokenCache = null
async function pageToken() {
  const given = env('META_PAGE_ACCESS_TOKEN')
  if (tokenCache?.from === given) return tokenCache.token
  let token = given
  try {
    const accounts = await graph('me/accounts', { params: { fields: 'id,access_token', limit: '100' }, token: given })
    token = (accounts.data || []).find(a => a.id === env('META_PAGE_ID'))?.access_token || given
  } catch (_) { /* already a Page token */ }
  tokenCache = { from: given, token }
  return token
}

let igIdCache
async function igAccountId() {
  if (env('META_IG_USER_ID')) return env('META_IG_USER_ID')
  if (igIdCache === undefined) {
    igIdCache = (await graph(env('META_PAGE_ID'), { params: { fields: 'instagram_business_account' } }).catch(() => ({}))).instagram_business_account?.id || null
  }
  return igIdCache
}

// ── Lead forms ───────────────────────────────────────────────────────────
const LEAD_FIELDS = 'id,created_time,field_data,ad_name,adset_name,campaign_name,form_id,platform'

// Form questions are matched loosely by their names, so any wording works.
// Order matters: the first pattern that matches a question wins.
const QUESTION_MAP = [
  ['name', /^(full_?name|first_?name|name|your_name)$/],
  ['phone', /whatsapp|phone|mobile|contact_number/],
  ['email', /email/],
  ['company', /company|business_name|firm|brand/],
  ['city', /city|location|district|state/],
  ['country', /country/],
  ['experience', /how_long|experience|years|since|in_business/],
  ['business_type', /importer|exporter|business_type|describe/],
  ['services', /service|interest|looking_for|need|help/],
  ['products', /product|hs_code|commodity|item/],
  ['business_type', /you_are|are_you|profile|type|role/],
]

const pretty = v => String(v || '').replace(/_/g, ' ').trim()

function leadFromForm(meta, formName) {
  const out = {}
  const extra = []
  for (const f of meta.field_data || []) {
    const key = (f.name || '').toLowerCase()
    const value = (f.values || []).map(pretty).filter(Boolean).join(', ')
    if (!value) continue
    if (/^last_?name$/.test(key)) { out.name = [out.name, value].filter(Boolean).join(' '); continue }
    const hit = QUESTION_MAP.find(([field, re]) => !out[field] && re.test(key))
    if (hit) {
      out[hit[0]] = value
    } else {
      extra.push(`${pretty(f.name)}: ${value}`)
    }
  }
  return {
    ...out,
    source: meta.platform === 'ig' ? 'instagram_form' : 'facebook_form',
    message: extra.length ? extra.join('\n') : null,
    meta_lead_id: meta.id,
    meta_form_name: formName || null,
    campaign_name: meta.campaign_name || null,
    ad_name: meta.ad_name || null,
  }
}

async function saveMetaLead(db, leadgenId, formName) {
  const { data: seen } = await db.from('crm_leads').select('id').eq('meta_lead_id', leadgenId).limit(1)
  if (seen?.length) return null
  const meta = await graph(leadgenId, { params: { fields: LEAD_FIELDS } })
  const row = leadFromForm(meta, formName)
  if (meta.created_time) row.created_at = new Date(meta.created_time).toISOString()
  const label = row.source === 'instagram_form' ? 'Instagram lead form' : 'Facebook lead form'
  return intakeLead(db, row, { note: `${label}${formName ? ` "${formName}"` : ''}${row.campaign_name ? ` · campaign ${row.campaign_name}` : ''}` })
}

// Pulls the last `days` of leads from every lead form on the Page (catches anything
// the webhook missed). Returns how many new leads were added.
async function syncMetaLeads(db, days = 7) {
  if (!metaConfigured()) throw new Error('Meta is not connected yet (META_PAGE_ID / META_PAGE_ACCESS_TOKEN)')
  const since = Math.floor((Date.now() - days * 864e5) / 1000)
  let added = 0, checked = 0
  let next = `${env('META_PAGE_ID')}/leadgen_forms?fields=id,name&limit=100`
  while (next) {
    const forms = await graph(next)
    for (const form of forms.data || []) {
      let page = `${form.id}/leads?fields=id&limit=100&filtering=${encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]))}`
      while (page) {
        const leads = await graph(page)
        for (const l of leads.data || []) {
          checked++
          try { if ((await saveMetaLead(db, l.id, form.name))?.created) added++ }
          catch (err) { console.error('Meta lead sync failed', l.id, err.message) }
        }
        page = leads.paging?.next || null
      }
    }
    next = forms.paging?.next || null
  }
  return { added, checked }
}

async function formName(formId) {
  if (!formId) return null
  try { return (await graph(formId, { params: { fields: 'name' } })).name } catch (_) { return null }
}

// ── Messaging (Instagram DMs and Messenger both go through the Page) ─────
async function sendSocialMessage(recipient, text, quickReplies = null) {
  const message = { text: String(text).slice(0, 1000) }
  if (quickReplies?.length) {
    message.quick_replies = quickReplies.slice(0, 13).map(q => ({ content_type: 'text', title: q.title.slice(0, 20), payload: q.payload }))
  }
  return graph(`${env('META_PAGE_ID')}/messages`, { body: { recipient, messaging_type: 'RESPONSE', message } })
}

async function replyToComment(platform, commentId, text) {
  return platform === 'instagram'
    ? graph(`${commentId}/replies`, { body: { message: text } })
    : graph(`${commentId}/comments`, { body: { message: text } })
}

async function socialProfile(platform, userId) {
  try {
    const fields = platform === 'instagram' ? 'name,username' : 'first_name,last_name,name'
    const p = await graph(userId, { params: { fields } })
    return { name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null, username: p.username || null }
  } catch (_) {
    return { name: null, username: null }
  }
}

module.exports = {
  metaConfigured, igAccountId, saveMetaLead, syncMetaLeads, formName,
  sendSocialMessage, replyToComment, socialProfile, leadFromForm,
}
