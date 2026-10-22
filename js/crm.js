// Meetxport CRM — leads from Instagram/Facebook/WhatsApp/website moving through the sales
// pipeline, with notes, WhatsApp and email actions, plus buyers, meetings, tasks, team and settings.
// Data lives in Supabase (supabase/crm-schema.sql); sending and team management go through /api/crm.

const config = window.MEETXPORT_SUPABASE || {};
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------
const STAGES = { new:'New', contacted:'Contacted', follow_up:'Follow-up', demo:'Demo / call', payment_link:'Payment link sent', onboarded:'Paid / onboarded', lost:'Lost' };
const OPEN_STAGES = ['new','contacted','follow_up','demo','payment_link'];
const SOURCES = {
  instagram_form:'Instagram form', facebook_form:'Facebook form', instagram_dm:'Instagram DM', facebook_dm:'Messenger',
  instagram_comment:'Instagram comment', facebook_comment:'Facebook comment', website_form:'Website form', website_chat:'Website chat',
  whatsapp:'WhatsApp', manual:'Manual', referral:'Referral', event:'Event', other:'Other'
};
const BUSINESS_TYPES = { importer:'Importer', exporter:'Exporter', importer_exporter:'Importer & exporter', service_provider:'Service provider', beginner:'Beginner', other:'Other' };
const EXPERIENCE = { starting:'Just starting', under_1:'Under 1 year', '1_3':'1–3 years', '3_5':'3–5 years', '5_plus':'5+ years' };
const SERVICES = {
  outreach:'Buyer outreach', leads:'Verified buyer leads', blueprint:'Export buyer blueprint', 'event-meetings':'Trade fair meetings',
  'shipment-insurance':'Shipment insurance', 'buyer-verification':'Buyer verification', 'payment-recovery':'Payment recovery',
  documentation:'Documentation / ECGC', 'factory-visits':'Factory visit', 'curated-buyers':'Curated buyer portfolio',
  'direct-buyer-meet':'Direct buyer meet', 'shipment-check':'Product & shipment check', ecgc:'ECGC support', both:'Not sure yet'
};
const PLANS = Object.fromEntries([
  'Exclusive Outreach — 3 months', 'Exclusive Outreach — 6 months', 'Exclusive Outreach — 12 months',
  'Verified Buyer Leads', 'LinkedIn Decision-Maker Contacts', 'Verified WhatsApp Contacts', 'Export Buyer Blueprint',
  'Shipment Insurance & Claims', 'Dedicated Event Meetings', 'Curated Buyer Portfolio', 'Factory Visit & Verification',
  'Direct Buyer Meet', 'Buyer Verification', 'Payment Recovery', 'Documentation', 'Product & Shipment Check',
  'ECGC Execution & Support', 'Custom package'
].map(p => [p, p]));
const CURRENCIES = { INR:'INR', USD:'USD', AED:'AED', EUR:'EUR', GBP:'GBP' };
const BUYER_STATUS = { prospect:'Prospect', engaged:'Engaged', matched:'Matched', inactive:'Inactive' };
const MEETING_MODE = { online:'Online', in_person:'In person', event:'Trade event', intro_email:'Intro email' };
const MEETING_STATUS = { proposed:'Proposed', scheduled:'Scheduled', completed:'Completed', no_show:'No-show', cancelled:'Cancelled' };
const MEETING_OUTCOME = { pending:'Pending', interested:'Interested', samples_requested:'Samples requested', quotation_sent:'Quotation sent', order_placed:'Order placed', not_interested:'Not interested' };
const PRIORITY = { low:'Low', normal:'Normal', high:'High' };
const ROLES = { super_admin:'Super admin', member:'Team member' };

// ---------------------------------------------------------------------------
// Record types
// ---------------------------------------------------------------------------
const leadName = r => r.name || r.company || (r.social_username ? '@' + r.social_username : '') || (r.phone ? '+' + r.phone : '') || 'Unnamed lead';

const ENTITIES = {
  leads: {
    table:'crm_leads', label:'Lead',
    title: r => r.lead_code ? `${r.lead_code} · ${leadName(r)}` : leadName(r),
    fields: [
      [{ k:'name', l:'Name' }, { k:'company', l:'Company' }],
      [{ k:'phone', l:'WhatsApp number', t:'tel', hint:'With country code, e.g. 919812345678' }, { k:'email', l:'Email', t:'email' }],
      [{ k:'business_type', l:'Business type', t:'select', o:BUSINESS_TYPES }, { k:'experience', l:'In business for', t:'select', o:EXPERIENCE }],
      [{ k:'city', l:'City' }, { k:'country', l:'Country', d:'India' }],
      { k:'products', l:'Products / HS codes' },
      { k:'services', l:'Interested in', t:'multi', o:SERVICES },
      [{ k:'assigned_to', l:'Assigned to', t:'user' }, { k:'next_follow_up', l:'Next follow-up', t:'date' }],
      [{ k:'stage', l:'Stage', t:'select', o:STAGES, d:'new', noBlank:true }, { k:'source', l:'Source', t:'select', o:SOURCES, d:'manual', noBlank:true }],
      { section:'Deal & payment' },
      { k:'plan', l:'Plan / service sold', t:'select', o:PLANS },
      [{ k:'deal_value', l:'Amount', t:'number' }, { k:'currency', l:'Currency', t:'select', o:CURRENCIES, d:'INR', noBlank:true }],
      { k:'payment_link', l:'Payment link', t:'url', hint:'Razorpay / PayPal / bank link sent to the lead' },
      [{ k:'paid_amount', l:'Paid amount', t:'number' }, { k:'paid_at', l:'Paid on', t:'date' }],
      [{ k:'renewal_date', l:'Renewal date', t:'date' }, { k:'lost_reason', l:'Lost reason' }],
      { section:'Notes' },
      { k:'message', l:'Their enquiry', t:'textarea' },
      { k:'notes', l:'Summary notes', t:'textarea' }
    ]
  },
  buyers: {
    table:'crm_buyers', label:'Buyer',
    title: r => r.company || 'Untitled buyer',
    fields: [
      { k:'company', l:'Company', req:true },
      [{ k:'contact_name', l:'Contact person' }, { k:'designation', l:'Designation' }],
      [{ k:'email', l:'Email', t:'email' }, { k:'phone', l:'Phone / WhatsApp', t:'tel' }],
      [{ k:'country', l:'Country' }, { k:'status', l:'Status', t:'select', o:BUYER_STATUS, d:'prospect', noBlank:true }],
      [{ k:'products', l:'Buys' }, { k:'hs_codes', l:'HS codes' }],
      { k:'verified', l:'Verified buyer', t:'checkbox' },
      { k:'verification_notes', l:'Verification notes', t:'textarea' },
      { k:'notes', l:'Notes', t:'textarea' }
    ]
  },
  meetings: {
    table:'crm_meetings', label:'Meeting',
    title: r => [r.lead_id && leadName(byId('leads', r.lead_id) || {}), nameOf('buyers', r.buyer_id)].filter(Boolean).join(' × ') || 'Meeting',
    fields: [
      { k:'lead_id', l:'Client (lead)', t:'ref', ref:'leads' },
      { k:'buyer_id', l:'Buyer', t:'ref', ref:'buyers' },
      [{ k:'meeting_at', l:'Date & time', t:'datetime' }, { k:'mode', l:'Mode', t:'select', o:MEETING_MODE, d:'online', noBlank:true }],
      { k:'location', l:'Location / link' },
      [{ k:'status', l:'Status', t:'select', o:MEETING_STATUS, d:'proposed', noBlank:true }, { k:'outcome', l:'Outcome', t:'select', o:MEETING_OUTCOME, d:'pending', noBlank:true }],
      { k:'notes', l:'Notes', t:'textarea' }
    ]
  },
  tasks: {
    table:'crm_tasks', label:'Task',
    title: r => r.title || 'Task',
    fields: [
      { k:'title', l:'What needs doing', req:true },
      [{ k:'due_date', l:'Due', t:'date' }, { k:'priority', l:'Priority', t:'select', o:PRIORITY, d:'normal', noBlank:true }],
      { k:'lead_id', l:'Lead', t:'ref', ref:'leads' },
      { k:'buyer_id', l:'Buyer', t:'ref', ref:'buyers' },
      [{ k:'assigned_to', l:'Assigned to', t:'user' }, { k:'done', l:'Done', t:'checkbox' }],
      { k:'notes', l:'Notes', t:'textarea' }
    ]
  }
};

const VIEW_TITLES = { overview:'Overview', leads:'Leads', buyers:'Buyers', meetings:'Meetings', tasks:'Tasks', team:'Team', settings:'Settings' };
const FIELD_LIST = type => ENTITIES[type].fields.flat().filter(f => f.k);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let db = null;
const data = { leads:[], buyers:[], meetings:[], tasks:[], users:[] };
let settings = {};
let me = null;
let integration = null;
const ui = {
  view:'overview', search:'',
  filters:{ leads:{ mode:'board', stage:'all', owner:'all', source:'all' }, buyers:'all', meetings:'upcoming', tasks:'open' },
  drawer:null, // { type, record, isNew }
  panel:null   // open action panel in the lead drawer
};
const isSuper = () => me && me.role === 'super_admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function localISO(d){ d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
const todayISO = () => localISO(new Date());
const addDaysISO = days => localISO(Date.now() + days * 864e5);
function fmtDate(value){
  if(!value) return '—';
  const d = value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value);
  return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(d);
}
function fmtDateTime(value){
  if(!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' }).format(new Date(value));
}
function fmtAgo(value){
  const mins = Math.round((Date.now() - new Date(value)) / 60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins + 'm ago';
  if(mins < 1440) return Math.round(mins / 60) + 'h ago';
  return fmtDateTime(value);
}
function fmtMoney(amount, currency){
  if(amount === null || amount === undefined || amount === '') return '—';
  try{ return new Intl.NumberFormat('en-IN', { style:'currency', currency: currency || 'INR', maximumFractionDigits:0 }).format(amount); }
  catch{ return (currency || '') + ' ' + amount; }
}
function toLocalInput(iso){
  if(!iso) return '';
  const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function normalizePhone(value){
  let d = String(value || '').replace(/\D/g, '');
  if(d.startsWith('00')) d = d.slice(2);
  if(d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if(d.length === 10) d = '91' + d;
  return d || null;
}
const byId = (type, id) => id ? data[type].find(r => r.id === id) : null;
function nameOf(type, id){
  const record = byId(type, id);
  return record ? ENTITIES[type].title(record) : '';
}
const userName = id => (data.users.find(u => u.id === id) || {}).full_name || '';
const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function matchesSearch(record){
  if(!ui.search) return true;
  const q = ui.search.toLowerCase();
  return Object.values(record).some(v => (typeof v === 'string' && v.toLowerCase().includes(q)) || (Array.isArray(v) && v.join(' ').toLowerCase().includes(q)));
}
function badge(text, tone){ return `<span class="crm-badge ${tone || ''}">${esc(text)}</span>`; }
function stageTone(stage){ return { new:'gold', payment_link:'gold', onboarded:'green', lost:'grey' }[stage] || ''; }
function meetingTone(status){ return { completed:'green', proposed:'gold', no_show:'red', cancelled:'grey' }[status] || ''; }
const isOverdue = task => !task.done && task.due_date && task.due_date < todayISO();
const followUpDue = lead => lead.next_follow_up && lead.next_follow_up <= todayISO() && OPEN_STAGES.includes(lead.stage);
const servicesText = list => (list || []).map(s => SERVICES[s] || s).join(', ');

let toastTimer;
function toast(message, isError){
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 6000 : 2600);
}

async function api(action, payload = {}){
  const { data:{ session } } = await db.auth.getSession();
  if(!session) throw new Error('Please sign in again');
  const res = await fetch('/api/crm', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + session.access_token },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || ('Request failed (' + res.status + ')'));
  return body;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const ORDERS = { leads:['created_at', false], buyers:['updated_at', false], meetings:['meeting_at', true], tasks:['due_date', true], users:['full_name', true] };
const TABLES = { leads:'crm_leads', buyers:'crm_buyers', meetings:'crm_meetings', tasks:'crm_tasks', users:'crm_users' };

async function loadAll(){
  $('viewBody').innerHTML = '<p class="crm-loading">Loading…</p>';
  const keys = Object.keys(data);
  const [results, settingsResult] = await Promise.all([
    Promise.all(keys.map(type => db.from(TABLES[type]).select('*').order(ORDERS[type][0], { ascending:ORDERS[type][1], nullsFirst:false }).limit(5000))),
    db.from('crm_settings').select('key, value')
  ]);
  results.forEach((result, i) => {
    if(result.error){ toast('Could not load ' + keys[i] + ': ' + result.error.message, true); return; }
    data[keys[i]] = result.data;
  });
  settings = Object.fromEntries((settingsResult.data || []).map(r => [r.key, r.value]));
  render();
}

async function saveRecord(type, values, id){
  const table = TABLES[type];
  const query = id
    ? db.from(table).update(values).eq('id', id).select().single()
    : db.from(table).insert(values).select().single();
  const { data:saved, error } = await query;
  if(error){ toast('Save failed: ' + error.message, true); return null; }
  upsertLocal(type, saved);
  return saved;
}

function upsertLocal(type, record){
  const list = data[type];
  const index = list.findIndex(r => r.id === record.id);
  if(index >= 0) list[index] = record; else list.unshift(record);
}

async function deleteRecord(type, id){
  const { error } = await db.from(TABLES[type]).delete().eq('id', id);
  if(error){ toast('Delete failed: ' + error.message, true); return false; }
  data[type] = data[type].filter(r => r.id !== id);
  return true;
}

async function quickUpdate(type, id, values){
  const saved = await saveRecord(type, values, id);
  if(saved){ render(); toast('Updated'); }
  return saved;
}

async function toggleTask(id, done){
  await quickUpdate('tasks', id, { done, completed_at: done ? new Date().toISOString() : null });
}

async function refreshLead(id){
  const { data:fresh } = await db.from('crm_leads').select('*').eq('id', id).single();
  if(fresh) upsertLocal('leads', fresh);
  return fresh;
}

// Live updates: new leads from Instagram/website appear without reloading.
function subscribeLive(){
  db.channel('crm-leads').on('postgres_changes', { event:'*', schema:'public', table:'crm_leads' }, payload => {
    if(payload.eventType === 'DELETE'){ data.leads = data.leads.filter(r => r.id !== payload.old.id); render(); return; }
    const isNew = !byId('leads', payload.new.id);
    upsertLocal('leads', payload.new);
    if(isNew) toast(`New lead ${payload.new.lead_code} · ${leadName(payload.new)} (${SOURCES[payload.new.source] || payload.new.source})`);
    if(!ui.drawer) render();
  }).subscribe();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const VIEWS = { overview:viewOverview, leads:viewLeads, buyers:viewBuyers, meetings:viewMeetings, tasks:viewTasks, team:viewTeam, settings:viewSettings };

function render(){
  document.querySelectorAll('#crmNav button').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
  $('viewTitle').textContent = VIEW_TITLES[ui.view];
  const listView = ENTITIES[ui.view];
  $('newBtn').hidden = !listView;
  $('searchInput').hidden = !listView;
  if(listView) $('newBtn').textContent = '+ New ' + ENTITIES[ui.view].label.toLowerCase();

  $('countLeads').textContent = data.leads.filter(l => l.stage === 'new').length || '';
  $('countTasks').textContent = (data.tasks.filter(t => !t.done && t.due_date && t.due_date <= todayISO() && (!t.assigned_to || t.assigned_to === me.id)).length +
    data.leads.filter(l => followUpDue(l) && (!l.assigned_to || l.assigned_to === me.id)).length) || '';

  renderFilters();
  $('viewBody').innerHTML = VIEWS[ui.view]();
  if(ui.view === 'leads' && ui.filters.leads.mode === 'board') wireBoard();
}

function chip(key, label, active, count, attr = 'data-filter'){
  return `<button type="button" class="crm-chip ${active ? 'active' : ''}" ${attr}="${esc(key)}">${esc(label)}${count !== undefined ? `<b>${count}</b>` : ''}</button>`;
}

function renderFilters(){
  const count = (list, fn) => list.filter(fn).length;
  const bar = $('filterBar');
  const f = ui.filters[ui.view];
  switch(ui.view){
    case 'leads': {
      const pool = leadsPool(true);
      bar.innerHTML = `
        <div class="crm-seg">${chip('board', 'Pipeline', f.mode === 'board', undefined, 'data-mode')}${chip('list', 'List', f.mode === 'list', undefined, 'data-mode')}</div>
        ${f.mode === 'list' ? chip('all', 'All', f.stage === 'all', pool.length, 'data-stage-filter') + Object.entries(STAGES).map(([k, l]) => chip(k, l, f.stage === k, count(pool, r => r.stage === k), 'data-stage-filter')).join('') + chip('due', 'Follow-up due', f.stage === 'due', count(pool, followUpDue), 'data-stage-filter') : ''}
        <select class="crm-select" id="ownerFilter" aria-label="Assigned to">
          <option value="all" ${f.owner === 'all' ? 'selected' : ''}>Everyone's leads</option>
          <option value="me" ${f.owner === 'me' ? 'selected' : ''}>My leads</option>
          <option value="none" ${f.owner === 'none' ? 'selected' : ''}>Unassigned</option>
          ${data.users.filter(u => u.id !== me.id).map(u => `<option value="${u.id}" ${f.owner === u.id ? 'selected' : ''}>${esc(u.full_name)}</option>`).join('')}
        </select>
        <select class="crm-select" id="sourceFilter" aria-label="Source">
          <option value="all">All sources</option>
          ${Object.entries(SOURCES).map(([k, l]) => `<option value="${k}" ${f.source === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <button type="button" class="crm-chip" id="syncMetaBtn" title="Fetch the latest Instagram/Facebook lead-form leads">⟳ Sync Instagram leads</button>`;
      break;
    }
    case 'buyers':
      bar.innerHTML = chip('all', 'All', f === 'all', data.buyers.length) + Object.entries(BUYER_STATUS).map(([k, l]) => chip(k, l, f === k, count(data.buyers, r => r.status === k))).join('') + chip('verified', 'Verified', f === 'verified', count(data.buyers, r => r.verified));
      break;
    case 'meetings':
      bar.innerHTML = chip('upcoming', 'Upcoming', f === 'upcoming', count(data.meetings, isUpcomingMeeting)) + chip('past', 'Past', f === 'past', count(data.meetings, r => !isUpcomingMeeting(r))) + chip('all', 'All', f === 'all', data.meetings.length);
      break;
    case 'tasks':
      bar.innerHTML = chip('open', 'Open', f === 'open', count(data.tasks, r => !r.done)) + chip('mine', 'Mine', f === 'mine', count(data.tasks, r => !r.done && r.assigned_to === me.id)) + chip('overdue', 'Overdue', f === 'overdue', count(data.tasks, isOverdue)) + chip('done', 'Done', f === 'done', count(data.tasks, r => r.done)) + chip('all', 'All', f === 'all', data.tasks.length);
      break;
    default: bar.innerHTML = '';
  }
}

function isUpcomingMeeting(r){
  if(['completed','cancelled','no_show'].includes(r.status)) return false;
  return !r.meeting_at || new Date(r.meeting_at) >= new Date(Date.now() - 2 * 3600 * 1000);
}

const emptyState = text => `<p class="crm-empty">${esc(text)}</p>`;

function table(headers, rows, type){
  if(!rows.length) return `<div class="crm-table-wrap">${emptyState(ui.search ? 'Nothing matches your search.' : 'Nothing here yet.')}</div>`;
  return `<div class="crm-table-wrap"><table class="crm-table">
    <thead><tr>${headers.map(h => `<th${h.num ? ' style="text-align:right"' : ''}>${esc(h.l || h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([record, cells]) => `<tr data-open="${type}" data-id="${record.id}">${cells.map((c, i) => `<td${headers[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function taskRow(task){
  const related = [task.lead_id && nameOf('leads', task.lead_id), nameOf('buyers', task.buyer_id), task.assigned_to && '→ ' + userName(task.assigned_to)].filter(Boolean).join(' · ');
  const due = task.due_date ? (isOverdue(task) ? badge('Overdue · ' + fmtDate(task.due_date), 'red') : fmtDate(task.due_date)) : '';
  return `<li class="crm-row ${task.done ? 'done' : ''}" data-open="tasks" data-id="${task.id}">
    <input type="checkbox" class="crm-check" data-task-toggle="${task.id}" ${task.done ? 'checked' : ''} aria-label="Mark done">
    <div class="crm-row-main"><strong>${esc(task.title)}${task.priority === 'high' ? ' ' + badge('High', 'red') : ''}</strong>${related ? `<small>${esc(related)}</small>` : ''}</div>
    <div class="crm-row-side">${due}</div>
  </li>`;
}

function leadRow(l, side){
  return `<li class="crm-row" data-open="leads" data-id="${l.id}">
    <div class="crm-row-main"><strong><span class="crm-code">${esc(l.lead_code || '')}</span> ${esc(leadName(l))}</strong><small>${esc([BUSINESS_TYPES[l.business_type], l.city, servicesText(l.services)].filter(Boolean).join(' · ') || SOURCES[l.source] || '')}</small></div>
    <div class="crm-row-side">${side}</div>
  </li>`;
}

function meetingRow(m){
  return `<li class="crm-row" data-open="meetings" data-id="${m.id}">
    <div class="crm-row-main"><strong>${esc(ENTITIES.meetings.title(m))}</strong><small>${esc(MEETING_MODE[m.mode] || '')}${m.location ? ' · ' + esc(m.location) : ''}</small></div>
    <div class="crm-row-side">${fmtDateTime(m.meeting_at)}<br>${badge(MEETING_STATUS[m.status], meetingTone(m.status))}</div>
  </li>`;
}

function viewOverview(){
  const today = todayISO();
  const monthStart = today.slice(0, 8) + '01';
  const leads = data.leads;
  const newLeads = leads.filter(l => l.stage === 'new');
  const todayLeads = leads.filter(l => localISO(l.created_at) === today);
  const dueFollowUps = leads.filter(followUpDue).sort((a, b) => a.next_follow_up < b.next_follow_up ? -1 : 1);
  const awaitingPayment = leads.filter(l => l.stage === 'payment_link');
  const onboardedMonth = leads.filter(l => l.stage === 'onboarded' && (l.paid_at || localISO(l.updated_at)) >= monthStart);
  const revenueMonth = onboardedMonth.filter(l => (l.currency || 'INR') === 'INR').reduce((s, l) => s + Number(l.paid_amount || l.deal_value || 0), 0);
  const dueTasks = data.tasks.filter(t => !t.done && t.due_date && t.due_date <= today).sort((a, b) => a.due_date < b.due_date ? -1 : 1);
  const upcoming = data.meetings.filter(isUpcomingMeeting).sort((a, b) => (a.meeting_at || '9') < (b.meeting_at || '9') ? -1 : 1);

  const last30 = leads.filter(l => l.created_at >= addDaysISO(-30));
  const bySource = Object.entries(last30.reduce((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const maxStage = Math.max(1, ...Object.keys(STAGES).map(s => leads.filter(l => l.stage === s).length));

  const tile = (label, value, goto, alert) =>
    `<button type="button" class="crm-tile ${alert ? 'alert' : ''}" data-goto="${goto}"><span>${label}</span><strong>${value}</strong></button>`;

  return `
  <div class="crm-tiles">
    ${tile('New leads', newLeads.length + (todayLeads.length ? ` <small>+${todayLeads.length} today</small>` : ''), 'leads:new')}
    ${tile('Follow-ups due', dueFollowUps.length, 'leads:due', dueFollowUps.length > 0)}
    ${tile('Awaiting payment', awaitingPayment.length, 'leads:payment_link')}
    ${tile('Onboarded this month', onboardedMonth.length, 'leads:onboarded')}
    ${tile('Revenue this month', fmtMoney(revenueMonth, 'INR'), 'leads:onboarded')}
  </div>
  <div class="crm-grid2">
    <section class="crm-card"><h3>Follow-ups due</h3>
      ${dueFollowUps.length ? `<ul class="crm-rows">${dueFollowUps.slice(0, 8).map(l => leadRow(l, (l.next_follow_up < today ? badge('Overdue · ' + fmtDate(l.next_follow_up), 'red') : 'Today') + (l.assigned_to ? '<br>' + esc(userName(l.assigned_to)) : ''))).join('')}</ul>` : emptyState('No follow-ups due. Set "Next follow-up" on a lead to see it here.')}
    </section>
    <section class="crm-card"><h3>Newest leads <button type="button" class="crm-link" data-goto="leads:new">View all</button></h3>
      ${newLeads.length ? `<ul class="crm-rows">${newLeads.slice(0, 8).map(l => leadRow(l, fmtAgo(l.created_at) + '<br>' + esc(SOURCES[l.source] || ''))).join('')}</ul>` : emptyState('No new leads waiting.')}
    </section>
    <section class="crm-card"><h3>Pipeline</h3>
      <ul class="crm-bars">${Object.entries(STAGES).map(([k, label]) => {
        const n = leads.filter(l => l.stage === k).length;
        return `<li data-goto="leads:${k}"><span>${esc(label)}</span><div class="crm-bar"><i class="${stageTone(k)}" style="width:${(n / maxStage) * 100}%"></i></div><b>${n}</b></li>`;
      }).join('')}</ul>
    </section>
    <section class="crm-card"><h3>Lead sources · last 30 days</h3>
      ${bySource.length ? `<ul class="crm-bars">${bySource.map(([k, n]) => `<li><span>${esc(SOURCES[k] || k)}</span><div class="crm-bar"><i style="width:${(n / bySource[0][1]) * 100}%"></i></div><b>${n}</b></li>`).join('')}</ul>` : emptyState('No leads in the last 30 days.')}
    </section>
    <section class="crm-card"><h3>Tasks due <button type="button" class="crm-link" data-new="tasks">+ Task</button></h3>
      ${dueTasks.length ? `<ul class="crm-rows">${dueTasks.slice(0, 8).map(taskRow).join('')}</ul>` : emptyState('No tasks due.')}
    </section>
    <section class="crm-card"><h3>Upcoming meetings <button type="button" class="crm-link" data-new="meetings">+ Meeting</button></h3>
      ${upcoming.length ? `<ul class="crm-rows">${upcoming.slice(0, 6).map(meetingRow).join('')}</ul>` : emptyState('No meetings scheduled.')}
    </section>
  </div>`;
}

// Leads after owner/source/search filters (and the stage filter unless skipStage).
function leadsPool(skipStage){
  const f = ui.filters.leads;
  return data.leads.filter(r =>
    matchesSearch(r) &&
    (f.source === 'all' || r.source === f.source) &&
    (f.owner === 'all' || (f.owner === 'me' ? r.assigned_to === me.id : f.owner === 'none' ? !r.assigned_to : r.assigned_to === f.owner)) &&
    (skipStage || f.mode === 'board' || f.stage === 'all' || (f.stage === 'due' ? followUpDue(r) : r.stage === f.stage))
  );
}

function viewLeads(){
  const f = ui.filters.leads;
  const rows = leadsPool(false);
  if(f.mode === 'board') return viewBoard(rows);
  return table(['ID', 'Received', 'Name', 'Type', 'City', 'WhatsApp', 'Interested in', 'Stage', 'Assigned', 'Follow-up'], rows.map(r => [r, [
    `<span class="crm-code">${esc(r.lead_code || '')}</span>`,
    fmtDate(r.created_at) + `<br><small class="crm-muted">${esc(SOURCES[r.source] || '')}</small>`,
    `<strong>${esc(leadName(r))}</strong>${r.company && r.name ? `<br><small class="crm-muted">${esc(r.company)}</small>` : ''}`,
    esc(BUSINESS_TYPES[r.business_type] || '—') + (r.experience ? `<br><small class="crm-muted">${esc(EXPERIENCE[r.experience])}</small>` : ''),
    esc(r.city || '—'),
    r.phone ? '+' + esc(r.phone) : (r.email ? esc(r.email) : '—'),
    esc(servicesText(r.services) || '—'),
    badge(STAGES[r.stage], stageTone(r.stage)),
    esc(userName(r.assigned_to) || '—'),
    r.next_follow_up ? (followUpDue(r) ? badge(fmtDate(r.next_follow_up), 'red') : fmtDate(r.next_follow_up)) : '—'
  ]]), 'leads');
}

function viewBoard(records){
  return `<div class="crm-board">${Object.entries(STAGES).map(([stage, label]) => {
    const cards = records.filter(r => r.stage === stage);
    return `<div class="crm-col" data-stage="${stage}">
      <h4>${esc(label)} <small>${cards.length}</small></h4>
      ${cards.slice(0, 200).map(r => `<div class="crm-deal" draggable="true" data-open="leads" data-id="${r.id}">
        <div class="crm-deal-top"><span class="crm-code">${esc(r.lead_code || '')}</span>${r.assigned_to ? `<span class="crm-avatar" title="${esc(userName(r.assigned_to))}">${esc(initials(userName(r.assigned_to)))}</span>` : ''}</div>
        <strong>${esc(leadName(r))}</strong>
        <small>${esc([BUSINESS_TYPES[r.business_type], r.city].filter(Boolean).join(' · ') || SOURCES[r.source] || '')}</small>
        ${(r.services || []).length ? `<small>${esc(servicesText(r.services))}</small>` : ''}
        <div class="crm-deal-foot"><span>${r.deal_value ? fmtMoney(r.deal_value, r.currency) : esc(SOURCES[r.source] || '')}</span><span>${r.next_follow_up ? (followUpDue(r) ? `<em class="crm-due">⏰ ${fmtDate(r.next_follow_up)}</em>` : '⏰ ' + fmtDate(r.next_follow_up)) : ''}</span></div>
      </div>`).join('')}
    </div>`;
  }).join('')}</div>`;
}

function wireBoard(){
  let dragId = null;
  document.querySelectorAll('.crm-deal').forEach(card => {
    card.addEventListener('dragstart', e => { dragId = card.dataset.id; e.dataTransfer.effectAllowed = 'move'; });
  });
  document.querySelectorAll('.crm-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('drop');
      const record = byId('leads', dragId);
      if(record && record.stage !== col.dataset.stage) moveStage(record, col.dataset.stage);
    });
  });
}

async function moveStage(lead, stage){
  const values = { stage };
  if(stage === 'contacted' && !lead.assigned_to) values.assigned_to = me.id; // whoever contacts first owns it
  if(stage === 'onboarded' && !lead.paid_at) values.paid_at = todayISO();
  const saved = await quickUpdate('leads', lead.id, values);
  if(saved && ui.drawer && ui.drawer.record.id === lead.id) openDrawer('leads', saved, false);
}

function viewBuyers(){
  const f = ui.filters.buyers;
  const rows = data.buyers.filter(r => matchesSearch(r) && (f === 'all' || (f === 'verified' ? r.verified : r.status === f)));
  return table(['Company', 'Contact', 'Country', 'Buys', 'Status', 'Verified', 'Meetings'], rows.map(r => [r, [
    `<strong>${esc(r.company)}</strong>`,
    esc([r.contact_name, r.designation].filter(Boolean).join(', ') || r.email || '—'),
    esc(r.country || '—'),
    esc(r.products || '—'),
    badge(BUYER_STATUS[r.status], r.status === 'matched' ? 'green' : r.status === 'inactive' ? 'grey' : ''),
    r.verified ? badge('✓ Verified', 'green') : '—',
    String(data.meetings.filter(m => m.buyer_id === r.id).length)
  ]]), 'buyers');
}

function viewMeetings(){
  const f = ui.filters.meetings;
  let rows = data.meetings.filter(r => matchesSearch(r) || matchesSearch({ a:ENTITIES.meetings.title(r) }));
  if(f === 'upcoming') rows = rows.filter(isUpcomingMeeting);
  if(f === 'past') rows = rows.filter(r => !isUpcomingMeeting(r)).reverse();
  return table(['When', 'Client', 'Buyer', 'Mode', 'Status', 'Outcome'], rows.map(r => [r, [
    fmtDateTime(r.meeting_at),
    `<strong>${esc(r.lead_id ? nameOf('leads', r.lead_id) : '—')}</strong>`,
    esc(nameOf('buyers', r.buyer_id) || '—'),
    esc(MEETING_MODE[r.mode] || '—'),
    badge(MEETING_STATUS[r.status], meetingTone(r.status)),
    r.outcome === 'pending' ? '—' : badge(MEETING_OUTCOME[r.outcome], r.outcome === 'not_interested' ? 'grey' : 'green')
  ]]), 'meetings');
}

function viewTasks(){
  const f = ui.filters.tasks;
  const rows = data.tasks.filter(r => matchesSearch(r) && (
    f === 'all' || (f === 'open' && !r.done) || (f === 'mine' && !r.done && r.assigned_to === me.id) || (f === 'done' && r.done) || (f === 'overdue' && isOverdue(r))
  ));
  if(f === 'done') rows.sort((a, b) => (b.completed_at || '') < (a.completed_at || '') ? -1 : 1);
  if(!rows.length) return `<section class="crm-card">${emptyState(ui.search ? 'Nothing matches your search.' : 'No tasks here.')}</section>`;
  return `<section class="crm-card"><ul class="crm-rows">${rows.map(taskRow).join('')}</ul></section>`;
}

function viewTeam(){
  if(!isSuper()) return emptyState('Only a super admin can manage the team.');
  const leadCount = id => data.leads.filter(l => l.assigned_to === id && OPEN_STAGES.includes(l.stage)).length;
  return `
  <div class="crm-grid2 crm-grid-wide">
    <section class="crm-card"><h3>Team members</h3>
      <ul class="crm-rows">${data.users.map(u => `<li class="crm-row crm-team-row">
        <span class="crm-avatar lg">${esc(initials(u.full_name))}</span>
        <div class="crm-row-main"><strong>${esc(u.full_name)} ${u.id === me.id ? badge('You') : ''} ${u.active ? '' : badge('Disabled', 'grey')}</strong><small>${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''} · ${leadCount(u.id)} open leads</small></div>
        <div class="crm-team-actions">
          <select class="crm-select" data-user-role="${u.id}" aria-label="Role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button type="button" class="crm-link" data-user-password="${u.id}">Reset password</button>
          ${u.id === me.id ? '' : `<button type="button" class="crm-link ${u.active ? 'crm-danger' : ''}" data-user-active="${u.id}" data-active="${u.active ? 'false' : 'true'}">${u.active ? 'Disable' : 'Enable'}</button>`}
        </div>
      </li>`).join('')}</ul>
    </section>
    <section class="crm-card"><h3>Add a team member</h3>
      <form id="addUserForm" class="crm-form">
        <div class="field-row">
          <div class="field"><label for="nuName">Full name</label><input id="nuName" required></div>
          <div class="field"><label for="nuRole">Role</label><select id="nuRole">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === 'member' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="nuEmail">Email (their login)</label><input id="nuEmail" type="email" required></div>
          <div class="field"><label for="nuPhone">Phone</label><input id="nuPhone" type="tel"></div>
        </div>
        <div class="field"><label for="nuPassword">Temporary password</label><input id="nuPassword" type="text" minlength="8" required value="${esc(suggestPassword())}"><p class="field-hint">Share it with them privately; they can change it with "Forgot password".</p></div>
        <button type="submit" class="btn btn-primary btn-sm">Add member</button>
      </form>
      <p class="crm-muted crm-note"><b>Super admin</b>: everything, including team, settings and deleting records. <b>Team member</b>: works on leads, notes, WhatsApp/email, buyers, meetings and tasks.</p>
    </section>
  </div>`;
}

function suggestPassword(){
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'Mx-' + Array.from(bytes, b => chars[b % chars.length]).join('');
}

function viewSettings(){
  if(!isSuper()) return emptyState('Only a super admin can change settings.');
  const s = settings;
  const status = (ok, label) => `<li>${ok ? badge('Connected', 'green') : badge('Not connected', 'grey')} ${esc(label)}</li>`;
  const it = integration;
  const text = (k, l, hint) => `<div class="field"><label for="s_${k}">${l}</label><input id="s_${k}" data-setting="${k}" value="${esc(s[k] || '')}">${hint ? `<p class="field-hint">${hint}</p>` : ''}</div>`;
  const area = (k, l, rows, hint) => `<div class="field"><label for="s_${k}">${l}</label><textarea id="s_${k}" data-setting="${k}" rows="${rows}">${esc(s[k] || '')}</textarea>${hint ? `<p class="field-hint">${hint}</p>` : ''}</div>`;
  const toggle = (k, l) => `<label class="field-check"><input type="checkbox" class="crm-check" data-setting="${k}" ${s[k] === 'true' ? 'checked' : ''}> ${l}</label>`;
  return `
  <div class="crm-grid2 crm-grid-wide">
    <section class="crm-card"><h3>Connections</h3>
      ${it ? `<ul class="crm-status">
        ${status(it.meta, 'Instagram & Facebook (lead forms, DM bot, comments)')}
        ${status(it.whatsapp, 'WhatsApp Business API')}
        ${status(it.email, 'Email' + (it.email_from ? ' — from ' + it.email_from : ''))}
      </ul>` : '<p class="crm-muted">Checking… (only works on the live site)</p>'}
      <div class="crm-actions-row">
        <button type="button" class="btn btn-outline btn-sm" id="syncMetaBtn2">⟳ Sync Instagram/Facebook leads (30 days)</button>
        <button type="button" class="btn btn-outline btn-sm" id="submitTemplatesBtn">Submit WhatsApp templates to Meta</button>
      </div>
      <p class="crm-muted crm-note">WhatsApp needs approved templates before it can message a lead first. Submit them once; Meta usually approves within a few minutes to a day.</p>
      ${it && it.whatsapp_templates ? `<details class="crm-details"><summary>Template wording</summary>${Object.entries(it.whatsapp_templates).map(([k, body]) => `<p><b>${esc(s['wa_template_' + k] || k)}</b><br>${esc(body).replace(/\n/g, '<br>')}</p>`).join('')}</details>` : ''}
    </section>
    <section class="crm-card"><h3>Automation</h3>
      <form class="crm-form" id="settingsForm">
        ${toggle('auto_welcome_whatsapp', 'Send the WhatsApp welcome to every new lead automatically')}
        ${toggle('auto_welcome_email', 'Send the welcome email to every new lead automatically')}
        ${text('community_link', 'WhatsApp community link', 'Sent with the "Community link" action and at the end of the Instagram chat.')}
        <div class="field-row">${text('wa_template_welcome', 'Welcome template name')}${text('wa_template_community', 'Community template name')}</div>
        <div class="field-row">${text('wa_template_payment', 'Payment template name')}${text('wa_template_language', 'Template language code')}</div>
        ${text('email_welcome_subject', 'Welcome email subject')}
        ${area('email_welcome_body', 'Welcome email text', 8, 'Placeholders: {name} {company} {lead_code} {community_link}')}
        ${text('email_payment_subject', 'Payment email subject')}
        ${area('email_payment_body', 'Payment email text', 6, 'Placeholders: {name} {plan} {amount} {payment_link}')}
        <button type="submit" class="btn btn-primary btn-sm">Save settings</button>
      </form>
    </section>
  </div>`;
}

// ---------------------------------------------------------------------------
// Drawer (view / edit / create a record)
// ---------------------------------------------------------------------------
function fieldHTML(f, record){
  if(f.section) return `<h4 class="crm-section">${esc(f.section)}</h4>`;
  const value = record[f.k] ?? '';
  const id = 'f_' + f.k;
  const label = `<label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>`;
  const hint = f.hint ? `<p class="field-hint">${esc(f.hint)}</p>` : '';
  switch(f.t){
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${f.k}" rows="3">${esc(value)}</textarea>${hint}</div>`;
    case 'select': {
      const opts = { ...f.o };
      if(value && !(value in opts)) opts[value] = value;
      return `<div class="field">${label}<select id="${id}" name="${f.k}">${f.noBlank ? '' : '<option value="">—</option>'}${Object.entries(opts).map(([k, l]) => `<option value="${esc(k)}" ${k === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint}</div>`;
    }
    case 'user':
      return `<div class="field">${label}<select id="${id}" name="${f.k}"><option value="">Unassigned</option>${data.users.filter(u => u.active || u.id === value).map(u => `<option value="${u.id}" ${u.id === value ? 'selected' : ''}>${esc(u.full_name)}</option>`).join('')}</select></div>`;
    case 'ref': {
      const list = [...data[f.ref]].sort((a, b) => ENTITIES[f.ref].title(a).localeCompare(ENTITIES[f.ref].title(b)));
      return `<div class="field">${label}<select id="${id}" name="${f.k}"><option value="">—</option>${list.map(r => `<option value="${r.id}" ${r.id === value ? 'selected' : ''}>${esc(ENTITIES[f.ref].title(r))}</option>`).join('')}</select></div>`;
    }
    case 'multi': {
      const chosen = new Set(Array.isArray(value) ? value : []);
      const opts = { ...f.o };
      chosen.forEach(v => { if(!(v in opts)) opts[v] = v; });
      return `<div class="field"><label>${esc(f.l)}</label><div class="crm-multi" id="${id}">${Object.entries(opts).map(([k, l]) =>
        `<label class="crm-pill"><input type="checkbox" value="${esc(k)}" ${chosen.has(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>`;
    }
    case 'checkbox':
      return `<label class="field-check"><input type="checkbox" class="crm-check" id="${id}" name="${f.k}" ${value ? 'checked' : ''}> ${esc(f.l)}</label>`;
    case 'datetime':
      return `<div class="field">${label}<input type="datetime-local" id="${id}" name="${f.k}" value="${esc(toLocalInput(value))}"></div>`;
    default: {
      const type = { number:'number', date:'date', email:'email', tel:'tel', url:'url' }[f.t] || 'text';
      return `<div class="field">${label}<input type="${type}" id="${id}" name="${f.k}" value="${esc(value)}" ${type === 'number' ? 'step="any" min="0"' : ''}>${hint}</div>`;
    }
  }
}

function openDrawer(type, record, isNew){
  const entity = ENTITIES[type];
  if(isNew){
    const defaults = {};
    FIELD_LIST(type).forEach(f => { if(f.d !== undefined) defaults[f.k] = f.d; });
    if(type === 'leads' || type === 'tasks') defaults.assigned_to = me.id;
    record = { ...defaults, ...record };
  }
  const sameRecord = ui.drawer && ui.drawer.record.id && ui.drawer.record.id === record.id;
  ui.drawer = { type, record, isNew };
  if(!sameRecord) ui.panel = null;
  $('drawer').classList.toggle('wide', type === 'leads');
  $('drawerKind').textContent = isNew ? 'New ' + entity.label.toLowerCase() : (type === 'leads' ? `${record.lead_code} · ${SOURCES[record.source] || ''} · ${fmtDate(record.created_at)}` : entity.label);
  $('drawerTitle').textContent = isNew ? 'New ' + entity.label.toLowerCase() : (type === 'leads' ? leadName(record) : entity.title(record));
  $('drawerTop').innerHTML = (type === 'leads' && !isNew) ? leadTopHTML(record) : '';
  $('recordForm').innerHTML = entity.fields.map(f => Array.isArray(f)
    ? `<div class="field-row">${f.map(x => fieldHTML(x, record)).join('')}</div>`
    : fieldHTML(f, record)).join('');
  $('deleteBtn').hidden = isNew || !isSuper();
  $('drawerExtra').innerHTML = '';
  $('drawerRelated').innerHTML = isNew ? '' : relatedHTML(type, record);

  $('scrim').hidden = false;
  $('drawer').classList.add('open');
  $('drawer').setAttribute('aria-hidden', 'false');
  if(!sameRecord) $('drawer').scrollTop = 0;
  if(type === 'leads' && !isNew) loadTimeline(record.id);
  const first = $('recordForm').querySelector('input, select, textarea');
  if(first && isNew) first.focus();
}

function closeDrawer(){
  ui.drawer = null;
  ui.panel = null;
  $('drawer').classList.remove('open');
  $('drawer').setAttribute('aria-hidden', 'true');
  $('scrim').hidden = true;
  render();
}

// Stage stepper + WhatsApp / email / call actions at the top of a lead.
function leadTopHTML(lead){
  const steps = Object.keys(STAGES).filter(s => s !== 'lost');
  const at = steps.indexOf(lead.stage);
  const facts = [
    BUSINESS_TYPES[lead.business_type], lead.experience && EXPERIENCE[lead.experience], lead.city,
    lead.social_username && '@' + lead.social_username, lead.campaign_name && 'Campaign: ' + lead.campaign_name
  ].filter(Boolean);
  const sent = [
    lead.welcome_whatsapp_at && 'WhatsApp welcome ✓', lead.welcome_email_at && 'Welcome email ✓', lead.community_link_at && 'Community link ✓'
  ].filter(Boolean);
  const waDigits = lead.phone ? lead.phone.replace(/\D/g, '') : '';
  return `
    ${facts.length ? `<p class="crm-facts">${facts.map(esc).join(' · ')}</p>` : ''}
    <ol class="crm-steps">${steps.map((s, i) => `<li class="${i < at ? 'done' : ''} ${i === at ? 'now' : ''}"><button type="button" data-stage="${s}">${esc(STAGES[s])}</button></li>`).join('')}</ol>
    <div class="crm-lead-actions">
      ${lead.stage === 'lost' ? badge('Lost' + (lead.lost_reason ? ' · ' + lead.lost_reason : ''), 'grey') + ` <button type="button" class="crm-link" data-stage="follow_up">Re-open</button>` : `<button type="button" class="crm-link crm-danger" data-stage="lost">Mark lost</button>`}
      <span class="crm-spacer"></span>
      <button type="button" class="btn btn-outline btn-sm ${ui.panel === 'whatsapp' ? 'on' : ''}" data-panel="whatsapp" ${lead.phone ? '' : 'disabled title="Add a WhatsApp number first"'}>WhatsApp ▾</button>
      <button type="button" class="btn btn-outline btn-sm ${ui.panel === 'email' ? 'on' : ''}" data-panel="email" ${lead.email ? '' : 'disabled title="Add an email first"'}>Email ▾</button>
      ${lead.phone ? `<a class="btn btn-outline btn-sm" href="tel:+${esc(waDigits)}" data-log-call>Call</a>` : ''}
    </div>
    ${ui.panel === 'whatsapp' ? `<div class="crm-panel">
      <div class="crm-panel-row">
        <button type="button" class="btn btn-purple btn-sm" data-wa="welcome">Welcome message</button>
        <button type="button" class="btn btn-purple btn-sm" data-wa="community">Community link</button>
        <button type="button" class="btn btn-purple btn-sm" data-wa="payment" ${lead.payment_link ? '' : 'disabled title="Add a payment link below first"'}>Payment link</button>
        <a class="crm-link" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener">Open chat ↗</a>
      </div>
      <textarea id="waText" rows="2" placeholder="Custom message (only delivered if they messaged you on WhatsApp in the last 24 hours)"></textarea>
      <button type="button" class="btn btn-primary btn-sm" data-wa="text">Send custom message</button>
    </div>` : ''}
    ${ui.panel === 'email' ? `<div class="crm-panel">
      <div class="crm-panel-row">
        <button type="button" class="btn btn-purple btn-sm" data-email="welcome">Welcome email</button>
        <button type="button" class="btn btn-purple btn-sm" data-email="payment" ${lead.payment_link ? '' : 'disabled title="Add a payment link below first"'}>Payment link email</button>
      </div>
      <input id="emailSubject" placeholder="Subject">
      <textarea id="emailBody" rows="4" placeholder="Write an email to ${esc(lead.email || '')}"></textarea>
      <button type="button" class="btn btn-primary btn-sm" data-email="custom">Send email</button>
    </div>` : ''}
    ${sent.length ? `<p class="crm-sent">${sent.join(' · ')}</p>` : ''}`;
}

function relatedHTML(type, record){
  if(type === 'leads'){
    const tasks = data.tasks.filter(t => t.lead_id === record.id).sort((a, b) => a.done - b.done);
    const meetings = data.meetings.filter(m => m.lead_id === record.id);
    return `
      <h3>Add a note</h3>
      <div class="crm-composer">
        <textarea id="noteText" rows="2" placeholder="What happened? e.g. Called — interested in 6-month outreach, send proposal Monday"></textarea>
        <div class="crm-composer-row">
          <select id="noteKind" class="crm-select"><option value="note">Note</option><option value="call">Call</option></select>
          <label class="crm-inline">Next follow-up <input type="date" id="noteFollow" value="${esc(record.next_follow_up || '')}"></label>
          <button type="button" class="btn btn-primary btn-sm" id="noteSave">Save note</button>
        </div>
      </div>
      <h3>Tasks <button type="button" class="crm-link" data-new-related="tasks" data-key="lead_id">+ Task</button></h3>
      ${tasks.length ? `<ul class="crm-rows">${tasks.map(taskRow).join('')}</ul>` : emptyState('No tasks yet.')}
      ${meetings.length ? `<h3>Buyer meetings <button type="button" class="crm-link" data-new-related="meetings" data-key="lead_id">+ Meeting</button></h3><ul class="crm-rows">${meetings.map(meetingRow).join('')}</ul>` : ''}
      <h3>Timeline</h3>
      <ul class="crm-timeline" id="timeline"><li class="crm-muted">Loading…</li></ul>`;
  }
  if(type === 'buyers'){
    const meetings = data.meetings.filter(m => m.buyer_id === record.id);
    const tasks = data.tasks.filter(t => t.buyer_id === record.id).sort((a, b) => a.done - b.done);
    return `<h3>Meetings <button type="button" class="crm-link" data-new-related="meetings" data-key="buyer_id">+ Meeting</button></h3>
      ${meetings.length ? `<ul class="crm-rows">${meetings.map(meetingRow).join('')}</ul>` : emptyState('No meetings yet.')}
      <h3>Tasks <button type="button" class="crm-link" data-new-related="tasks" data-key="buyer_id">+ Task</button></h3>
      ${tasks.length ? `<ul class="crm-rows">${tasks.map(taskRow).join('')}</ul>` : emptyState('No tasks yet.')}`;
  }
  return '';
}

const KIND_ICON = { note:'✎', call:'☎', stage:'→', whatsapp:'💬', email:'✉', system:'•', bot:'🤖' };
const STATUS_TONE = { sent:'', delivered:'', read:'green', failed:'red', received:'gold' };

async function loadTimeline(leadId){
  const { data:items, error } = await db.from('crm_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending:false }).limit(300);
  const list = $('timeline');
  if(!list || !ui.drawer || ui.drawer.record.id !== leadId) return;
  if(error){ list.innerHTML = `<li class="crm-muted">${esc(error.message)}</li>`; return; }
  if(!items.length){ list.innerHTML = '<li class="crm-muted">Nothing yet.</li>'; return; }
  list.innerHTML = items.map(a => `<li class="crm-tl ${a.kind}">
    <span class="crm-tl-icon">${KIND_ICON[a.kind] || '•'}</span>
    <div><p>${a.kind === 'stage' ? 'Stage: ' + esc(a.body.split(' → ').map(s => STAGES[s] || s).join(' → ')) : esc(a.body).replace(/\n/g, '<br>')}
      ${a.status ? ' ' + badge(a.status, STATUS_TONE[a.status]) : ''}</p>
      <small>${esc(a.user_id ? userName(a.user_id) || 'Team' : (a.kind === 'bot' ? 'Instagram bot' : 'System'))} · ${fmtAgo(a.created_at)}
      ${(['note','call'].includes(a.kind) && (a.user_id === me.id || isSuper())) ? ` · <button type="button" class="crm-link" data-del-activity="${a.id}">delete</button>` : ''}</small></div>
  </li>`).join('');
}

async function saveNote(){
  const lead = ui.drawer.record;
  const text = $('noteText').value.trim();
  const follow = $('noteFollow').value || null;
  if(!text && follow === (lead.next_follow_up || null)){ toast('Write a note first', true); return; }
  if(text){
    const { error } = await db.from('crm_activities').insert({ lead_id: lead.id, user_id: me.id, kind: $('noteKind').value, body: text });
    if(error){ toast('Could not save note: ' + error.message, true); return; }
  }
  const patch = {};
  if(follow !== (lead.next_follow_up || null)) patch.next_follow_up = follow;
  if(lead.stage === 'new') patch.stage = 'contacted';
  if(!lead.assigned_to) patch.assigned_to = me.id;
  const saved = Object.keys(patch).length ? await saveRecord('leads', patch, lead.id) : lead;
  toast(text ? 'Note saved' : 'Follow-up date saved');
  openDrawer('leads', saved || lead, false);
}

async function sendAction(kind, sub){
  const lead = ui.drawer.record;
  const payload = { lead_id: lead.id, kind: sub };
  if(kind === 'whatsapp' && sub === 'text'){
    payload.text = $('waText').value.trim();
    if(!payload.text){ toast('Write a message first', true); return; }
  }
  if(kind === 'email' && sub === 'custom'){
    payload.subject = $('emailSubject').value.trim();
    payload.body = $('emailBody').value.trim();
    if(!payload.subject || !payload.body){ toast('Add a subject and message', true); return; }
  }
  // Save unsaved edits (e.g. a payment link just pasted) before sending.
  const values = readForm('leads');
  const changed = Object.keys(values).some(k => JSON.stringify(values[k] ?? null) !== JSON.stringify(lead[k] ?? null));
  let current = lead;
  if(changed){ current = await saveRecord('leads', values, lead.id); if(!current) return; }
  toast('Sending…');
  try{
    await api(kind, payload);
    toast(kind === 'whatsapp' ? 'WhatsApp sent' : 'Email sent');
    if(sub === 'payment' && current.stage !== 'payment_link' && OPEN_STAGES.includes(current.stage)) current = await saveRecord('leads', { stage:'payment_link' }, lead.id) || current;
    if(current.stage === 'new') current = await saveRecord('leads', { stage:'contacted', assigned_to: current.assigned_to || me.id }, lead.id) || current;
  }catch(err){
    toast(err.message, true);
  }
  const fresh = await refreshLead(lead.id);
  ui.panel = null;
  if(ui.drawer && ui.drawer.record.id === lead.id) openDrawer('leads', fresh || current, false);
}

function readForm(type){
  const values = {};
  FIELD_LIST(type).forEach(f => {
    const input = $('f_' + f.k);
    if(!input) return;
    if(f.t === 'checkbox') values[f.k] = input.checked;
    else if(f.t === 'multi') values[f.k] = [...input.querySelectorAll('input:checked')].map(i => i.value);
    else if(f.t === 'number') values[f.k] = input.value === '' ? null : Number(input.value);
    else if(f.t === 'datetime') values[f.k] = input.value ? new Date(input.value).toISOString() : null;
    else if(f.t === 'tel' && type === 'leads') values[f.k] = normalizePhone(input.value);
    else values[f.k] = input.value.trim() === '' ? null : input.value.trim();
  });
  return values;
}

async function submitDrawer(e){
  e.preventDefault();
  const { type, record, isNew } = ui.drawer;
  const values = readForm(type);
  const missing = FIELD_LIST(type).find(f => f.req && !values[f.k]);
  if(missing){ toast(missing.l + ' is required', true); $('f_' + missing.k).focus(); return; }
  if(type === 'leads' && !values.name && !values.company && !values.phone && !values.email){ toast('Add at least a name, company, phone or email', true); return; }
  if(isNew) ['lead_id', 'buyer_id'].forEach(k => { if(record[k] && !(k in values)) values[k] = record[k]; });
  if(type === 'tasks' && values.done !== !!record.done) values.completed_at = values.done ? new Date().toISOString() : null;
  if(type === 'leads' && values.stage === 'onboarded' && !values.paid_at) values.paid_at = todayISO();

  $('saveBtn').disabled = true;
  const saved = await saveRecord(type, values, isNew ? null : record.id);
  $('saveBtn').disabled = false;
  if(!saved) return;
  if(isNew && type === 'leads') await db.from('crm_activities').insert({ lead_id: saved.id, user_id: me.id, kind:'system', body:'Lead added manually' });
  toast(isNew ? (type === 'leads' ? `Lead ${saved.lead_code} added` : ENTITIES[type].label + ' added') : 'Saved');
  if(type === 'leads') openDrawer('leads', saved, false); else closeDrawer();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function wireApp(){
  $('crmNav').addEventListener('click', e => {
    const btn = e.target.closest('button[data-view]');
    if(!btn) return;
    ui.view = btn.dataset.view;
    ui.search = ''; $('searchInput').value = '';
    render();
    window.scrollTo(0, 0);
    if(ui.view === 'settings') loadIntegration();
  });

  $('filterBar').addEventListener('click', e => {
    const t = e.target.closest('button');
    if(!t) return;
    if(t.dataset.mode){ ui.filters.leads.mode = t.dataset.mode; render(); return; }
    if(t.dataset.stageFilter){ ui.filters.leads.stage = t.dataset.stageFilter; render(); return; }
    if(t.dataset.filter){ ui.filters[ui.view] = t.dataset.filter; render(); return; }
    if(t.id === 'syncMetaBtn') syncMeta(7);
  });
  $('filterBar').addEventListener('change', e => {
    if(e.target.id === 'ownerFilter') ui.filters.leads.owner = e.target.value;
    if(e.target.id === 'sourceFilter') ui.filters.leads.source = e.target.value;
    render();
  });

  let searchTimer;
  $('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { ui.search = e.target.value.trim(); render(); }, 150);
  });

  $('newBtn').addEventListener('click', () => openDrawer(ui.view, {}, true));
  $('refreshBtn').addEventListener('click', async () => { await loadAll(); toast('Refreshed'); });

  document.addEventListener('click', e => {
    const t = e.target;
    const toggle = t.closest('[data-task-toggle]');
    if(toggle){ toggleTask(toggle.dataset.taskToggle, toggle.checked).then(() => ui.drawer && !ui.drawer.isNew && openDrawer(ui.drawer.type, byId(ui.drawer.type, ui.drawer.record.id) || ui.drawer.record, false)); return; }

    const goto = t.closest('[data-goto]');
    if(goto){
      const [view, stage] = goto.dataset.goto.split(':');
      ui.view = view;
      if(view === 'leads'){ ui.filters.leads.mode = 'list'; ui.filters.leads.stage = stage || 'all'; }
      render(); return;
    }

    const create = t.closest('[data-new]');
    if(create){ openDrawer(create.dataset.new, {}, true); return; }

    const createRelated = t.closest('[data-new-related]');
    if(createRelated && ui.drawer){ openDrawer(createRelated.dataset.newRelated, { [createRelated.dataset.key]: ui.drawer.record.id }, true); return; }

    if(ui.drawer && ui.drawer.type === 'leads'){
      const stageBtn = t.closest('[data-stage]');
      if(stageBtn && $('drawer').contains(stageBtn)){
        if(stageBtn.dataset.stage === 'lost'){
          const reason = prompt('Why was this lead lost? (optional)');
          if(reason === null) return;
          quickUpdate('leads', ui.drawer.record.id, { stage:'lost', lost_reason: reason || null }).then(s => s && openDrawer('leads', s, false));
        }else moveStage(ui.drawer.record, stageBtn.dataset.stage);
        return;
      }
      const panel = t.closest('[data-panel]');
      if(panel){ ui.panel = ui.panel === panel.dataset.panel ? null : panel.dataset.panel; $('drawerTop').innerHTML = leadTopHTML(ui.drawer.record); return; }
      const wa = t.closest('[data-wa]');
      if(wa){ sendAction('whatsapp', wa.dataset.wa); return; }
      const em = t.closest('[data-email]');
      if(em){ sendAction('email', em.dataset.email); return; }
      if(t.closest('[data-log-call]')){ $('noteKind').value = 'call'; $('noteText').focus(); return; }
      if(t.id === 'noteSave'){ saveNote(); return; }
      const del = t.closest('[data-del-activity]');
      if(del){
        if(!confirm('Delete this note?')) return;
        db.from('crm_activities').delete().eq('id', del.dataset.delActivity).then(({ error }) => { if(error) toast(error.message, true); else loadTimeline(ui.drawer.record.id); });
        return;
      }
    }

    // Team management
    const pw = t.closest('[data-user-password]');
    if(pw){
      const password = prompt('New password for ' + (data.users.find(u => u.id === pw.dataset.userPassword) || {}).full_name + ' (min 8 characters):', suggestPassword());
      if(password) api('user-update', { id: pw.dataset.userPassword, password }).then(() => toast('Password changed — share it with them privately')).catch(err => toast(err.message, true));
      return;
    }
    const act = t.closest('[data-user-active]');
    if(act){
      api('user-update', { id: act.dataset.userActive, active: act.dataset.active === 'true' }).then(reloadUsers).catch(err => toast(err.message, true));
      return;
    }
    if(t.id === 'syncMetaBtn2'){ syncMeta(30); return; }
    if(t.id === 'submitTemplatesBtn'){ submitTemplates(); return; }

    const open = t.closest('[data-open]');
    if(open){
      const record = byId(open.dataset.open, open.dataset.id);
      if(record) openDrawer(open.dataset.open, record, false);
    }
  });

  document.addEventListener('change', e => {
    const role = e.target.closest('[data-user-role]');
    if(role) api('user-update', { id: role.dataset.userRole, role: role.value }).then(() => { toast('Role updated'); reloadUsers(); }).catch(err => { toast(err.message, true); reloadUsers(); });
  });

  document.addEventListener('submit', e => {
    if(e.target.id === 'addUserForm'){ e.preventDefault(); addUser(); }
    if(e.target.id === 'settingsForm'){ e.preventDefault(); saveSettings(); }
  });

  $('recordForm').addEventListener('submit', submitDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && ui.drawer) closeDrawer(); });

  $('deleteBtn').addEventListener('click', async () => {
    const { type, record } = ui.drawer;
    if(!confirm(`Delete this ${ENTITIES[type].label.toLowerCase()}? This cannot be undone.`)) return;
    if(await deleteRecord(type, record.id)){ toast('Deleted'); closeDrawer(); }
  });

  $('signOutBtn').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
}

async function syncMeta(days){
  toast('Fetching Instagram/Facebook leads…');
  try{
    const r = await api('sync-meta', { days });
    toast(`Checked ${r.checked} form leads · ${r.added} new`);
    await loadAll();
  }catch(err){ toast(err.message, true); }
}

async function submitTemplates(){
  if(!confirm('Submit the 3 WhatsApp templates to Meta for approval?')) return;
  try{
    const { results } = await api('wa-templates');
    alert(results.map(r => `${r.name}: ${r.ok ? 'submitted (' + r.status + ')' : 'failed — ' + r.error}`).join('\n'));
  }catch(err){ toast(err.message, true); }
}

async function loadIntegration(){
  try{ integration = await api('status'); }
  catch(err){ integration = null; }
  if(ui.view === 'settings') render();
}

async function reloadUsers(){
  const { data:users } = await db.from('crm_users').select('*').order('full_name');
  if(users) data.users = users;
  render();
}

async function addUser(){
  const payload = { full_name:$('nuName').value.trim(), email:$('nuEmail').value.trim(), phone:$('nuPhone').value.trim(), role:$('nuRole').value, password:$('nuPassword').value };
  try{
    await api('user-create', payload);
    toast(`${payload.full_name} added. Login: ${payload.email}`);
    await reloadUsers();
  }catch(err){ toast(err.message, true); }
}

async function saveSettings(){
  const rows = [...document.querySelectorAll('[data-setting]')].map(el => ({
    key: el.dataset.setting, value: el.type === 'checkbox' ? String(el.checked) : el.value.trim(), updated_at: new Date().toISOString()
  }));
  const { error } = await db.from('crm_settings').upsert(rows);
  if(error){ toast('Could not save: ' + error.message, true); return; }
  rows.forEach(r => { settings[r.key] = r.value; });
  toast('Settings saved');
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showAuth(message){
  $('appView').hidden = true;
  $('authView').hidden = false;
  $('authMsg').textContent = message || '';
}

async function enterApp(session){
  const { data:member, error } = await db.from('crm_users').select('*').eq('id', session.user.id).maybeSingle();
  if(error || !member || !member.active){
    await db.auth.signOut();
    showAuth(error ? 'Could not check access: ' + error.message : `${session.user.email} does not have CRM access. Ask a super admin to add you.`);
    return;
  }
  me = member;
  $('authView').hidden = true;
  $('appView').hidden = false;
  $('userEmail').textContent = member.full_name;
  $('userRole').textContent = ROLES[member.role];
  document.querySelectorAll('[data-super]').forEach(el => { el.hidden = !isSuper(); });
  await loadAll();
  subscribeLive();
  if(isSuper()) loadIntegration();
}

function wireAuth(){
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('authMsg').textContent = 'Signing in…';
    const { data:result, error } = await db.auth.signInWithPassword({ email:$('loginEmail').value.trim(), password:$('loginPassword').value });
    if(error){ $('authMsg').textContent = error.message; return; }
    enterApp(result.session);
  });

  $('forgotBtn').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    if(!email){ $('authMsg').textContent = 'Enter your email above first.'; $('loginEmail').focus(); return; }
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('authMsg').textContent = error ? error.message : 'Check your inbox for a reset link.';
  });

  $('resetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await db.auth.updateUser({ password:$('newPassword').value });
    if(error){ $('authMsg').textContent = error.message; return; }
    $('resetForm').hidden = true; $('loginForm').hidden = false;
    history.replaceState(null, '', location.pathname);
    const { data:{ session } } = await db.auth.getSession();
    if(session) enterApp(session); else showAuth('Password updated. Sign in with your new password.');
  });

  db.auth.onAuthStateChange(event => { if(event === 'PASSWORD_RECOVERY') showResetForm(); });
}

function showResetForm(){
  showAuth('Choose a new password.');
  $('loginForm').hidden = true;
  $('resetForm').hidden = false;
}

async function start(){
  if(!config.url || !config.anonKey || !window.supabase){
    $('setupView').hidden = false;
    return;
  }
  db = window.supabase.createClient(config.url, config.anonKey);
  wireAuth();
  wireApp();
  if(/type=recovery/.test(location.hash)){ showResetForm(); return; }
  const { data:{ session } } = await db.auth.getSession();
  if(session) enterApp(session); else showAuth();
}

start();
