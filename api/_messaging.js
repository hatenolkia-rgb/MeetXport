// WhatsApp (Cloud API) and email (Resend) sending for the CRM.
//
// WhatsApp: a business may only start a conversation with an approved template.
// The three templates below are submitted to Meta from the CRM's Settings page
// (or created by hand in WhatsApp Manager with the same names and wording).
// Free-text messages only go through within 24 hours of the lead's last WhatsApp message.
//
// Needs WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_TOKEN (and WHATSAPP_BUSINESS_ACCOUNT_ID to
// submit templates); RESEND_API_KEY + EMAIL_FROM for email.

const { env, fill, firstName, logActivity } = require('./_shared')

const GRAPH = 'https://graph.facebook.com/v21.0'
const waToken = () => env('WHATSAPP_TOKEN') || env('META_PAGE_ACCESS_TOKEN')
const whatsappConfigured = () => !!(env('WHATSAPP_PHONE_NUMBER_ID') && waToken())
const emailConfigured = () => !!(env('RESEND_API_KEY') && env('EMAIL_FROM'))

// Wording submitted to Meta. {{n}} are filled in order from the params given when sending.
const TEMPLATE_DEFINITIONS = {
  welcome: {
    category: 'MARKETING',
    body: 'Hi {{1}}, thank you for your interest in Meetxport! 🌍\n\nWe help Indian businesses connect with verified international buyers. Someone from our team will call you shortly to understand your products and goals.\n\nReply here anytime if you have a question.',
    example: ['Ravi'],
    footer: 'Meetxport · Connecting India to the World',
  },
  community: {
    category: 'MARKETING',
    body: 'Hi {{1}}, join the Meetxport WhatsApp community for buyer requirements, export tips and trade-event updates:\n\n{{2}}',
    example: ['Ravi', 'https://chat.whatsapp.com/example'],
    footer: 'Meetxport',
  },
  payment: {
    category: 'UTILITY',
    body: 'Hi {{1}}, here is your secure payment link for {{2}} ({{3}}):\n\n{{4}}\n\nOnce the payment is done, we will start your onboarding right away.',
    example: ['Ravi', 'Exclusive Outreach — 6 months', '₹45,000', 'https://rzp.io/l/example'],
    footer: 'Meetxport',
  },
}

async function waPost(path, body) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error || {}
    throw new Error([e.code, e.error_user_msg || e.message || `HTTP ${res.status}`].filter(Boolean).join(' · '))
  }
  return data
}

async function sendWhatsAppTemplate(phone, templateName, language, params) {
  if (!whatsappConfigured()) return { ok: false, error: 'WhatsApp API is not connected yet' }
  if (!phone) return { ok: false, error: 'No WhatsApp number on this lead' }
  try {
    const data = await waPost(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      messaging_product: 'whatsapp', to: phone, type: 'template',
      template: {
        name: templateName, language: { code: language || 'en' },
        components: params.length ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p || '-').slice(0, 1000) })) }] : [],
      },
    })
    return { ok: true, id: data.messages?.[0]?.id || null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function sendWhatsAppText(phone, text) {
  if (!whatsappConfigured()) return { ok: false, error: 'WhatsApp API is not connected yet' }
  if (!phone) return { ok: false, error: 'No WhatsApp number on this lead' }
  try {
    const data = await waPost(`${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: String(text).slice(0, 4096), preview_url: true },
    })
    return { ok: true, id: data.messages?.[0]?.id || null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

async function submitTemplates(settings) {
  const wabaId = env('WHATSAPP_BUSINESS_ACCOUNT_ID')
  if (!wabaId || !waToken()) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_TOKEN not set')
  const results = []
  for (const [kind, def] of Object.entries(TEMPLATE_DEFINITIONS)) {
    const name = settings[`wa_template_${kind}`]
    try {
      const data = await waPost(`${wabaId}/message_templates`, {
        name, language: settings.wa_template_language || 'en', category: def.category,
        components: [
          { type: 'BODY', text: def.body, example: { body_text: [def.example] } },
          { type: 'FOOTER', text: def.footer },
        ],
      })
      results.push({ name, ok: true, status: data.status || 'PENDING' })
    } catch (err) {
      results.push({ name, ok: false, error: err.message })
    }
  }
  return results
}

async function sendEmail({ to, subject, text }) {
  if (!emailConfigured()) return { ok: false, error: 'Email sending is not connected yet' }
  if (!to) return { ok: false, error: 'No email address on this lead' }
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#180B33;max-width:560px">${
    String(text).split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('')
  }</div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env('EMAIL_FROM'), to: [to], reply_to: env('EMAIL_REPLY_TO') || undefined, subject, text, html }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` }
    return { ok: true, id: data.id || null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function money(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return ''
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount) }
  catch (_) { return `${currency || ''} ${amount}` }
}

function vars(lead, settings) {
  return {
    name: firstName(lead.name), full_name: lead.name || '', company: lead.company || '', lead_code: lead.lead_code || '',
    community_link: settings.community_link || '', payment_link: lead.payment_link || '',
    plan: lead.plan || 'your Meetxport plan', amount: money(lead.deal_value, lead.currency),
  }
}

const WA_LABELS = { welcome: 'Welcome message', community: 'Community link', payment: 'Payment link' }

// kind: welcome | community | payment | text. Logs the result on the lead's timeline.
async function whatsappToLead(db, lead, settings, kind, { userId = null, text = '' } = {}) {
  const v = vars(lead, settings)
  let result
  if (kind === 'text') {
    if (!text.trim()) return { ok: false, error: 'Message is empty' }
    result = await sendWhatsAppText(lead.phone, text)
  } else {
    if (kind === 'community' && !settings.community_link) return { ok: false, error: 'Add the community link in Settings first' }
    if (kind === 'payment' && !lead.payment_link) return { ok: false, error: 'Add a payment link to this lead first' }
    const params = { welcome: [v.name], community: [v.name, v.community_link], payment: [v.name, v.plan, v.amount || 'as discussed', v.payment_link] }[kind]
    if (!params) return { ok: false, error: 'Unknown message type' }
    result = await sendWhatsAppTemplate(lead.phone, settings[`wa_template_${kind}`], settings.wa_template_language, params)
  }
  const label = kind === 'text' ? `WhatsApp: "${text.slice(0, 300)}"` : `WhatsApp: ${WA_LABELS[kind]}`
  await logActivity(db, lead.id, {
    kind: 'whatsapp', userId, externalId: result.id,
    status: result.ok ? 'sent' : 'failed',
    body: result.ok ? label : `${label} — not sent (${result.error})`,
  })
  if (result.ok) {
    const stamp = { welcome: 'welcome_whatsapp_at', community: 'community_link_at' }[kind]
    if (stamp) await db.from('crm_leads').update({ [stamp]: new Date().toISOString() }).eq('id', lead.id)
  }
  return result
}

// kind: welcome | payment | custom
async function emailToLead(db, lead, settings, kind, { userId = null, subject = '', body = '' } = {}) {
  const v = vars(lead, settings)
  if (kind === 'payment' && !lead.payment_link) return { ok: false, error: 'Add a payment link to this lead first' }
  const s = kind === 'custom' ? subject : fill(settings[`email_${kind}_subject`], v)
  const t = kind === 'custom' ? body : fill(settings[`email_${kind}_body`], v)
  if (!s || !t) return { ok: false, error: 'Email subject or text is empty' }
  const result = await sendEmail({ to: lead.email, subject: s, text: t })
  await logActivity(db, lead.id, {
    kind: 'email', userId, externalId: result.id, status: result.ok ? 'sent' : 'failed',
    body: result.ok ? `Email: ${s}` : `Email: ${s} — not sent (${result.error})`,
  })
  if (result.ok && kind === 'welcome') await db.from('crm_leads').update({ welcome_email_at: new Date().toISOString() }).eq('id', lead.id)
  return result
}

// New leads from Instagram/Facebook/website: WhatsApp + email welcome, if switched on in Settings.
async function autoWelcome(db, lead, settings) {
  if (settings.auto_welcome_whatsapp === 'true' && lead.phone && !lead.welcome_whatsapp_at && whatsappConfigured()) {
    await whatsappToLead(db, lead, settings, 'welcome')
  }
  if (settings.auto_welcome_email === 'true' && lead.email && !lead.welcome_email_at && emailConfigured()) {
    await emailToLead(db, lead, settings, 'welcome')
  }
}

module.exports = {
  TEMPLATE_DEFINITIONS, whatsappConfigured, emailConfigured, sendWhatsAppText, submitTemplates,
  whatsappToLead, emailToLead, autoWelcome,
}
