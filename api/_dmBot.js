// Instagram DM / Messenger question bot for Meetxport.
//
// Someone messages the Page (e.g. by tapping "Send message" on an ad) or comments
// on a post/ad → the bot asks, one at a time, with tap buttons where possible:
//   1. Importer / Exporter / Service provider / Just starting
//   2. How long in business
//   3. City
//   4. WhatsApp number (or email)
//   5. Service they're interested in
// The lead appears in the CRM after the first answer and fills in as they reply;
// once the number arrives the WhatsApp/email welcome goes out (if on in Settings).
//
// When a team member replies from the Instagram/Page inbox, the bot stays quiet in
// that chat for 7 days so it never talks over a person. After the questions are done
// the bot is silent too — the team takes it from there.

const { normalizePhone, extractPhone, extractEmail, getSettings, logActivity, claimOnce } = require('./_shared')
const { intakeLead, SERVICES, parseBusinessType, parseExperience, parseServices } = require('./_intake')
const { sendSocialMessage, replyToComment, socialProfile } = require('./_meta')

const PAUSE_MS = 7 * 864e5
const SESSION_RESTART_MS = 30 * 864e5 // someone coming back a month later is asked again

const TYPE_OPTIONS = [
  { title: 'Importer', payload: 'type:importer' },
  { title: 'Exporter', payload: 'type:exporter' },
  { title: 'Service provider', payload: 'type:service_provider' },
  { title: 'Just starting', payload: 'type:beginner' },
]
const EXPERIENCE_OPTIONS = [
  { title: 'Just starting', payload: 'exp:starting' },
  { title: 'Under 1 year', payload: 'exp:under_1' },
  { title: '1–3 years', payload: 'exp:1_3' },
  { title: '3–5 years', payload: 'exp:3_5' },
  { title: '5+ years', payload: 'exp:5_plus' },
]
const SERVICE_OPTIONS = [
  ['outreach', 'Buyer outreach'], ['leads', 'Verified buyer leads'], ['event-meetings', 'Trade fair meetings'],
  ['shipment-insurance', 'Shipment insurance'], ['buyer-verification', 'Buyer verification'], ['payment-recovery', 'Payment recovery'],
  ['documentation', 'Documentation / ECGC'], ['factory-visits', 'Factory visit'], ['both', 'Not sure yet'],
].map(([key, title]) => ({ title, payload: `svc:${key}` }))

const numbered = opts => opts.map((o, i) => `${i + 1}. ${o.title}`).join('\n')

const QUESTIONS = {
  type: {
    text: name => `Hi${name ? ' ' + name.split(' ')[0] : ''}! 👋 Thanks for reaching out to Meetxport — we connect Indian businesses with verified international buyers.\n\nA few quick questions so the right expert can help you.\n\nWhich best describes you?`,
    options: TYPE_OPTIONS,
  },
  experience: { text: () => 'Great! How long have you been in this business?', options: EXPERIENCE_OPTIONS },
  city: { text: () => 'Which city are you based in?' },
  contact: { text: () => 'Please share your WhatsApp number (with country code, e.g. +91 98XXXXXXXX) so our team can reach you.' },
  services: { text: () => 'Last one — which service are you most interested in? (You can also type more than one.)', options: SERVICE_OPTIONS },
}
const ORDER = ['type', 'experience', 'city', 'contact', 'services']

const DONE_TEXT = settings => `Thank you! 🙏 Our team will contact you on WhatsApp shortly.${
  settings.community_link ? `\n\nMeanwhile, join the Meetxport community for buyer updates and export tips:\n${settings.community_link}` : ''}`

const SOURCE = { instagram: 'instagram_dm', facebook: 'facebook_dm' }

// The bot's wording is fixed, so its own echoed messages can be recognised even if
// Meta's echo arrives before the sent message id has been saved.
const BOT_PHRASES = ['Thanks for reaching out to Meetxport', 'How long have you been in this business', 'Which city are you based in',
  'Please share your WhatsApp number', 'which service are you most interested in', 'Our team will contact you on WhatsApp shortly',
  "Sorry, I couldn't read a number", 'Which best describes you']
const isBotText = text => !!text && BOT_PHRASES.some(p => text.includes(p))

async function loadSession(db, userId) {
  const { data } = await db.from('crm_dm_sessions').select('*').eq('social_user_id', userId).maybeSingle()
  return data
}

async function saveSession(db, session) {
  await db.from('crm_dm_sessions').upsert({ ...session, updated_at: new Date().toISOString() })
}

// Sends a question; buttons where Meta allows them, plus a numbered list so a typed
// "2" also works (and private replies to comments, which can't carry buttons).
async function ask(recipient, step, { name = null, buttons = true } = {}) {
  const q = QUESTIONS[step]
  let text = q.text(name)
  if (q.options && !buttons) text += '\n\n' + numbered(q.options) + '\n\nReply with a number.'
  return sendSocialMessage(recipient, text, buttons ? q.options : null)
}

function pickOption(step, text, payload) {
  const opts = QUESTIONS[step].options
  if (payload) return opts.find(o => o.payload === payload)?.payload.split(':')[1] || null
  const n = Number(String(text).trim())
  if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1].payload.split(':')[1]
  return null
}

// Applies an answer; returns the lead fields it produced, or null if it didn't make sense.
function readAnswer(step, text, payload) {
  const picked = pickOption(step, text, payload)
  switch (step) {
    case 'type': {
      const v = picked || parseBusinessType(text)
      return v ? { business_type: v } : null
    }
    case 'experience': {
      const v = picked || parseExperience(text)
      return v ? { experience: v } : null
    }
    case 'city':
      return text && text.trim().length >= 2 ? { city: text.trim().slice(0, 120) } : null
    case 'contact': {
      const phone = extractPhone(text)
      const email = extractEmail(text)
      return phone || email ? { ...(phone && { phone }), ...(email && { email }) } : null
    }
    case 'services': {
      const v = picked ? [picked] : parseServices(text)
      return v.length ? { services: v } : null
    }
  }
  return null
}

async function handleMessage(db, platform, event) {
  const msg = event.message
  if (!msg || msg.is_deleted || msg.is_unsupported) return
  if (!await claimOnce(db, `dm:${msg.mid}`)) return

  // Sent from our side: either the bot's own message, or a team member typing in the inbox.
  if (msg.is_echo) {
    const userId = event.recipient?.id
    const session = userId && await loadSession(db, userId)
    if (session && !isBotText(msg.text) && !(session.answers._bot_mids || []).includes(msg.mid)) {
      await saveSession(db, { ...session, paused_until: new Date(Date.now() + PAUSE_MS).toISOString() })
    }
    return
  }

  const userId = event.sender?.id
  if (!userId) return
  const text = msg.text || ''
  const payload = msg.quick_reply?.payload || null
  const recipient = { id: userId }
  const settings = await getSettings(db)

  let session = await loadSession(db, userId)
  if (session && Date.now() - new Date(session.updated_at).getTime() > SESSION_RESTART_MS && session.step === 'done') session = null
  if (session?.paused_until && new Date(session.paused_until) > new Date()) {
    if (session.lead_id && text) await logActivity(db, session.lead_id, { kind: 'bot', body: `${platform === 'instagram' ? 'Instagram' : 'Messenger'} message: "${text.slice(0, 500)}"` })
    return
  }

  const remember = async (s, sent) => {
    const mids = [...(s.answers._bot_mids || []), sent?.message_id].filter(Boolean).slice(-20)
    s.answers = { ...s.answers, _bot_mids: mids }
    await saveSession(db, s)
  }

  // New conversation: greet and ask the first question — unless the first message
  // already answers it (e.g. an ad's "I'm an exporter" quick reply).
  if (!session) {
    const profile = await socialProfile(platform, userId)
    session = { social_user_id: userId, platform, step: 'type', answers: { _name: profile.name, _username: profile.username }, lead_id: null, paused_until: null }
    const first = (payload || /^(importer|exporter|service provider|just starting)$/i.test(text.trim())) ? readAnswer('type', text, payload) : null
    if (first) return advance(db, platform, session, first, settings, remember, text)
    const sent = await ask(recipient, 'type', { name: profile.name })
    await remember(session, sent)
    return
  }

  if (session.step === 'done') {
    // The team handles the chat from here; keep the message on the lead's timeline.
    if (session.lead_id && text) await logActivity(db, session.lead_id, { kind: 'bot', body: `${platform === 'instagram' ? 'Instagram' : 'Messenger'} message: "${text.slice(0, 500)}"` })
    return
  }

  const step = session.step
  const answer = readAnswer(step, text, payload)
  if (!answer) {
    const tries = (session.answers._retries || 0) + 1
    if (tries >= 2 && step !== 'type') {
      // Don't trap anyone in a loop: keep what they wrote and move on.
      session.answers = { ...session.answers, _retries: 0, [`_${step}_raw`]: text }
      return advance(db, platform, session, {}, settings, remember, text)
    }
    session.answers = { ...session.answers, _retries: tries }
    const hint = step === 'contact' ? "Sorry, I couldn't read a number there. Please type your WhatsApp number with country code, e.g. +91 9812345678." : null
    const sent = hint ? await sendSocialMessage(recipient, hint) : await ask(recipient, step, { buttons: true })
    await remember(session, sent)
    return
  }
  session.answers = { ...session.answers, _retries: 0 }
  return advance(db, platform, session, answer, settings, remember, text)
}

async function advance(db, platform, session, answer, settings, remember, rawText) {
  const recipient = { id: session.social_user_id }
  const nextStep = ORDER[ORDER.indexOf(session.step) + 1] || 'done'

  // Create / update the lead with everything known so far.
  const fields = {
    ...answer,
    source: SOURCE[platform],
    social_user_id: session.social_user_id,
    name: session.answers._name || null,
    social_username: session.answers._username || null,
  }
  if (!Object.keys(answer).length && rawText) fields.message = `Chat (${session.step}): ${rawText.slice(0, 500)}`
  else if (!session.lead_id && session.answers._comment) fields.message = `Commented: "${session.answers._comment}"`
  const isLast = nextStep === 'done'
  // Welcome messages wait until the WhatsApp number is in (or the chat ends).
  const { lead } = await intakeLead(db, fields, {
    welcome: !!answer.phone || !!answer.email || isLast,
    note: session.lead_id ? null : `${platform === 'instagram' ? 'Instagram' : 'Messenger'} chat started${session.answers._username ? ` (@${session.answers._username})` : ''}`,
  })
  session.lead_id = lead.id
  session.step = nextStep

  if (isLast) {
    const summary = [
      lead.business_type && `Type: ${lead.business_type.replace(/_/g, ' ')}`,
      lead.experience && `Experience: ${lead.experience.replace(/_/g, '–').replace('–plus', '+')}`,
      lead.city && `City: ${lead.city}`,
      lead.phone && `WhatsApp: +${lead.phone}`,
      lead.email && `Email: ${lead.email}`,
      (lead.services || []).length && `Services: ${lead.services.map(s => SERVICES[s] || s).join(', ')}`,
    ].filter(Boolean).join(' · ')
    await logActivity(db, lead.id, { kind: 'bot', body: `Chat questions completed — ${summary}` })
    const sent = await sendSocialMessage(recipient, DONE_TEXT(settings))
    await remember(session, sent)
    return
  }
  const sent = await ask(recipient, nextStep)
  await remember(session, sent)
}

// A comment on a post or ad: short public reply + a private message that starts the questions.
async function handleComment(db, platform, { commentId, fromId, fromName, text, ownIds }) {
  if (!commentId || !fromId || ownIds.includes(fromId)) return
  if (!await claimOnce(db, `comment:${commentId}`)) return
  if (!text || text.trim().length < 2) return
  try {
    await replyToComment(platform, commentId, 'Thanks for your interest! We\'ve sent you a message 📩')
  } catch (err) { console.error('Public comment reply failed', commentId, err.message) }
  try {
    const sent = await sendSocialMessage({ comment_id: commentId }, QUESTIONS.type.text(fromName) + '\n\n' + numbered(TYPE_OPTIONS) + '\n\nReply with a number.')
    const userId = sent.recipient_id || fromId
    const existing = await loadSession(db, userId)
    if (!existing || existing.step === 'done' && !existing.paused_until) {
      await saveSession(db, {
        social_user_id: userId, platform, step: 'type', lead_id: existing?.lead_id || null,
        answers: { _name: fromName || null, _comment: text.slice(0, 500), _bot_mids: [sent.message_id].filter(Boolean) },
        paused_until: null,
      })
    }
  } catch (err) { console.error('Private reply to comment failed', commentId, err.message) }
}

module.exports = { handleMessage, handleComment, readAnswer }
