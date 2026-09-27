// Mobile nav toggle
function toggleMenu(){
  const menu = document.getElementById('mobileMenu');
  if(menu){ menu.classList.toggle('open'); }
}

// Generic tab switcher: showTab('exporter', btn, 'how')  -> toggles .tab-panel inside #<group>-panels
function showTab(name, btn, group){
  const scope = group ? document.getElementById(group) : document;
  scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  scope.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if(panel) panel.classList.add('active');
}

// Role toggle used on hero CTAs + contact form
function setRole(role){
  const exp = document.getElementById('role-exporter');
  const buy = document.getElementById('role-buyer');
  if(exp) exp.classList.toggle('active', role === 'exporter');
  if(buy) buy.classList.toggle('active', role === 'buyer');
  window.__meetxportRole = role;
}

// Contact form submit -> localStorage (placeholder until backend is wired up)
const leadEmailEndpoint = 'https://formsubmit.co/ajax/admin@meetxport.com';

async function sendLeadByEmail(entry){
  try{
    const response = await fetch(leadEmailEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body:JSON.stringify({
        ...entry,
        _subject:'New Meetxport enquiry',
        _captcha:'false',
        _template:'table'
      })
    });
    return response.ok;
  }catch(error){
    console.error('Could not send lead by email', error);
    return false;
  }
}

function saveLeadLocally(entry){
  try{
    const existing = JSON.parse(localStorage.getItem('meetxport_leads') || '[]');
    existing.push(entry);
    localStorage.setItem('meetxport_leads', JSON.stringify(existing));
  }catch(err){ console.error('Could not save lead locally', err); }
}

async function handleSubmit(e){
  e.preventDefault();
  const entry = {
    role: window.__meetxportRole || 'exporter',
    name: document.getElementById('name').value,
    company: document.getElementById('company').value,
    category: document.getElementById('category').value,
    country: document.getElementById('country').value,
    interest: document.getElementById('interest') ? document.getElementById('interest').value : '',
    contact: document.getElementById('email').value,
    message: document.getElementById('message') ? document.getElementById('message').value : '',
    submittedAt: new Date().toISOString()
  };
  saveLeadLocally(entry);
  const sent = await sendLeadByEmail(entry);

  const msg = document.getElementById('formMsg');
  if(msg){
    msg.textContent = sent
      ? "Thanks — your inquiry has been sent. We'll reach out shortly."
      : "Thanks — your inquiry is saved. Please also email admin@meetxport.com if you need an immediate reply.";
    msg.classList.add('show');
  }
  e.target.reset();
}

// Login/signup tab switch
function showLoginTab(name, btn){
  document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}

function setPortal(portal){
  document.getElementById('portal-exporter').classList.toggle('active', portal === 'exporter');
  document.getElementById('portal-buyer').classList.toggle('active', portal === 'buyer');
  window.__meetxportPortal = portal;
}

// Placeholder auth handler (no backend yet)
function handleAuth(e, type){
  e.preventDefault();
  const msg = document.getElementById('authMsg');
  if(msg){
    msg.textContent = type === 'login'
      ? "Login isn't connected yet — this is a placeholder until the account system is wired up."
      : "Signup isn't connected yet — this is a placeholder until the account system is wired up.";
    msg.classList.add('show');
  }
}

// Scroll reveal
document.addEventListener('DOMContentLoaded', () => {
  initMeetxportChat();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('in'); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

function initMeetxportChat(){
  if(document.getElementById('meetxportChat')) return;
  const chat = document.createElement('aside');
  chat.id = 'meetxportChat';
  chat.className = 'meetxport-chat';
  chat.innerHTML = `
    <button class="chat-launcher" id="chatLauncher" type="button" aria-controls="chatPanel" aria-expanded="false">
      <span class="chat-launcher-icon" aria-hidden="true">✦</span><span>Talk to us</span>
    </button>
    <section class="chat-panel" id="chatPanel" aria-label="Meetxport assistant" aria-hidden="true">
      <div class="chat-header">
        <div><strong>Quick enquiry</strong><span>Your details go to our team</span></div>
        <button class="chat-close" id="chatClose" type="button" aria-label="Close chat">×</button>
      </div>
      <div class="chat-messages" id="chatMessages" aria-live="polite"></div>
      <form class="chat-form" id="chatForm">
        <input id="chatInput" autocomplete="off" placeholder="Type your answer..." aria-label="Your answer" required>
        <button type="submit" aria-label="Send message">→</button>
      </form>
    </section>`;
  document.body.appendChild(chat);

  const launcher = document.getElementById('chatLauncher');
  const panel = document.getElementById('chatPanel');
  const close = document.getElementById('chatClose');
  const messages = document.getElementById('chatMessages');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const state = { step: 0, answers: {} };

  const questions = [
    { key:'service', text:'Hi. What can we help you with?', choices:['Buyer outreach','Shipment insurance','Event meetings'] },
    { key:'product', text:'What product or business do you work with?', placeholder:'Product or company' },
    { key:'contact', text:'Your name and email or phone number?', placeholder:'Name + email or phone' }
  ];

  function addMessage(text, sender){
    const bubble = document.createElement('div');
    bubble.className = 'chat-message ' + sender;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function addChoices(choices){
    const row = document.createElement('div');
    row.className = 'chat-choices';
    choices.forEach(choice => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice;
      button.addEventListener('click', () => submitAnswer(choice));
      row.appendChild(button);
    });
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  async function askNext(){
    const question = questions[state.step];
    if(!question){
      const entry = { ...state.answers, submittedAt:new Date().toISOString(), source:'chatbot' };
      saveLeadLocally(entry);
      const sent = await sendLeadByEmail(entry);
      addMessage(sent
        ? 'Thank you. Our team will connect with you shortly.'
        : 'Thank you. Your details are saved. Please email admin@meetxport.com if you need an immediate reply.', 'bot');
      form.hidden = true;
      return;
    }
    addMessage(question.text, 'bot');
    input.placeholder = question.placeholder || 'Type your answer...';
    if(question.choices) addChoices(question.choices);
    else input.focus();
  }

  function submitAnswer(answer){
    const question = questions[state.step];
    state.answers[question.key] = answer;
    addMessage(answer, 'user');
    state.step += 1;
    askNext();
  }

  function toggleChat(open){
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    if(open && !messages.children.length) askNext();
    if(open) input.focus();
  }

  launcher.addEventListener('click', () => toggleChat(!panel.classList.contains('open')));
  close.addEventListener('click', () => toggleChat(false));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const answer = input.value.trim();
    if(!answer) return;
    input.value = '';
    submitAnswer(answer);
  });
}

// Pre-fill contact form "Interested in" from ?plan= links on services.html
document.addEventListener('DOMContentLoaded', () => {
  const interestSelect = document.getElementById('interest');
  if(!interestSelect) return;
  const plan = new URLSearchParams(window.location.search).get('plan');
  if(!plan) return;
  const planToInterest = {
    '3month': 'outreach',
    '6month': 'outreach',
    '12month': 'outreach',
    'shipment-insurance': 'shipment-insurance',
    'event-meetings': 'event-meetings'
  };
  if(planToInterest[plan]) interestSelect.value = planToInterest[plan];
});

// Hero outreach dashboard: count-up stats, floating "buyer activity" cards
document.addEventListener('DOMContentLoaded', () => {
  renderWorldMap();
  const dashboardEl = document.getElementById('routePanel');
  if(dashboardEl){
    refreshDailyOutreach(dashboardEl);
    const vals = dashboardEl.querySelectorAll('.today-val');
    const metricsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          vals.forEach(animateCount);
          metricsObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    metricsObserver.observe(dashboardEl);
  }

  const cardsEl = document.getElementById('liveCards');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(cardsEl && !reduceMotion){
    const events = [
      { x: 71.4, y: 21.4, title: 'Germany', status: 'Importer replied', detail: 'Response rate 32%' },
      { x: 45.2, y: 19.0, title: 'UAE', status: 'Meeting confirmed', detail: '23 May · 11:00 AM' },
      { x: 16.7, y: 21.4, title: 'USA', status: 'Procurement head contacted', detail: 'Response rate 28%' },
      { x: 71.4, y: 69.0, title: 'South Africa', status: 'New importer found', detail: 'Added to pipeline' },
      { x: 81.0, y: 46.4, title: 'Singapore', status: 'Meeting confirmed', detail: '26 May · 02:30 PM' }
    ];
    const spawnCard = () => {
      const region = events[Math.floor(Math.random() * events.length)];
      const card = document.createElement('div');
      card.className = 'live-card' + (region.x > 65 ? ' anchor-right' : region.x < 25 ? ' anchor-left' : '');
      card.style.left = region.x + '%';
      card.style.top = Math.max(region.y, 17) + '%';
      card.innerHTML =
        '<span class="live-card-title">' + region.title + '</span>' +
        '<span class="live-card-status">' + region.status + '</span>' +
        '<span class="live-card-detail">' + region.detail + '</span>';
      cardsEl.appendChild(card);
      setTimeout(() => card.remove(), 3200);
    };
    spawnCard();
    setInterval(spawnCard, 3800);
  }
});

function refreshDailyOutreach(dashboardEl){
  const daySeed = Math.floor(Date.now() / 86400000);
  const baseValues = [184, 62, 9, 2];
  const dailyValues = baseValues.map((value, index) => {
    const variation = ((daySeed + index * 11) % (index === 3 ? 4 : 31));
    return value + variation;
  });
  dashboardEl.querySelectorAll('.today-val').forEach((el, index) => {
    el.dataset.target = dailyValues[index];
  });
  const updatedLabel = dashboardEl.querySelector('#outreachUpdated');
  if(updatedLabel){
    updatedLabel.textContent = 'Updated ' + new Intl.DateTimeFormat('en-IN', {
      day:'2-digit', month:'short', year:'numeric'
    }).format(new Date());
  }
  const meetingOptions = [
    { days: 1, time: 'Thu · 10:30 AM', title: 'Importer from Germany', industry: 'Auto components' },
    { days: 2, time: 'Fri · 11:00 AM', title: 'Buyer from UAE', industry: 'Chemicals industry' },
    { days: 3, time: 'Sat · 02:00 PM', title: 'Distributor from Singapore', industry: 'Food ingredients' },
    { days: 4, time: 'Sun · 09:30 AM', title: 'Procurement team from USA', industry: 'Engineering goods' },
    { days: 5, time: 'Mon · 12:30 PM', title: 'Buyer from South Africa', industry: 'Packaging materials' }
  ];
  const meeting = meetingOptions[daySeed % meetingOptions.length];
  const meetingDate = new Date(Date.now() + meeting.days * 86400000);
  const meetingMonth = dashboardEl.querySelector('#meetingMonth');
  const meetingDay = dashboardEl.querySelector('#meetingDay');
  const meetingTime = dashboardEl.querySelector('#meetingTime');
  const meetingTitle = dashboardEl.querySelector('#meetingTitle');
  const meetingSub = dashboardEl.querySelector('#meetingSub');
  if(meetingMonth) meetingMonth.textContent = new Intl.DateTimeFormat('en-IN', { month:'short' }).format(meetingDate).toUpperCase();
  if(meetingDay) meetingDay.textContent = meetingDate.getDate();
  if(meetingTime) meetingTime.textContent = meeting.time;
  if(meetingTitle) meetingTitle.textContent = meeting.title;
  if(meetingSub) meetingSub.textContent = meeting.industry;
  dashboardEl.dataset.updatedDay = new Date().toISOString().slice(0, 10);
  const untilNextUtcDay = 86400000 - (Date.now() % 86400000) + 1000;
  window.setTimeout(() => window.location.reload(), untilNextUtcDay);
}

async function renderWorldMap(){
  const map = document.getElementById('networkMap');
  const countryMap = document.getElementById('countryMap');
  if(!map || !countryMap || typeof d3 === 'undefined' || typeof topojson === 'undefined') return;

  try{
    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(response => {
      if(!response.ok) throw new Error('World map data could not be loaded');
      return response.json();
    });
    const countries = topojson.feature(world, world.objects.countries);
    const projection = d3.geoNaturalEarth1().fitExtent([[18, 52], [402, 368]], countries);
    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule().step([30, 20]);

    countryMap.innerHTML = '<path class="map-graticule" d="' + path(graticule()) + '"></path>';
    countries.features.forEach(country => {
      const countryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const countryId = String(country.id);
      countryPath.setAttribute('d', path(country));
      countryPath.setAttribute('class', 'map-country' + (countryId === '356' ? ' is-origin' : '') + (countryId === '840' || countryId === '276' || countryId === '702' || countryId === '710' || countryId === '784' ? ' is-destination' : ''));
      countryMap.appendChild(countryPath);
    });

    const locations = {
      India: [78.9629, 20.5937],
      Germany: [10.4515, 51.1657],
      Singapore: [103.8198, 1.3521],
      SouthAfrica: [24.9916, -30.5595],
      Uae: [54.3773, 24.4539],
      Usa: [-100, 39.5]
    };
    const points = Object.fromEntries(Object.entries(locations).map(([name, coordinates]) => [name, projection(coordinates)]));
    const origin = points.India;
    const destinations = ['Germany', 'Singapore', 'SouthAfrica', 'Uae', 'Usa'];

    setSvgPoint('originRingOne', origin);
    setSvgPoint('originRingTwo', origin);
    setSvgPoint('originNode', origin);
    setSvgText('originLabel', origin, -28, 28);
    destinations.forEach(name => {
      setSvgPoint('node' + name, points[name]);
      setSvgText('label' + name, points[name], name === 'Usa' ? -22 : 7, name === 'SouthAfrica' ? 18 : -7);
      document.getElementById('route' + name)?.setAttribute('d', routePath(origin, points[name]));
    });
  }catch(error){
    console.error('Could not render world map', error);
  }
}

function setSvgPoint(id, point){
  const element = document.getElementById(id);
  if(element && point){ element.setAttribute('cx', point[0]); element.setAttribute('cy', point[1]); }
}

function setSvgText(id, point, xOffset, yOffset){
  const element = document.getElementById(id);
  if(element && point){ element.setAttribute('x', point[0] + xOffset); element.setAttribute('y', point[1] + yOffset); }
}

function routePath(origin, destination){
  const midpointX = (origin[0] + destination[0]) / 2;
  const midpointY = (origin[1] + destination[1]) / 2 - Math.min(38, Math.abs(destination[0] - origin[0]) * .08);
  return 'M' + origin[0] + ' ' + origin[1] + ' Q' + midpointX + ' ' + midpointY + ' ' + destination[0] + ' ' + destination[1];
}

function animateCount(el){
  const target = parseInt(el.dataset.target, 10) || 0;
  const duration = 1400;
  const start = performance.now();
  function tick(now){
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if(progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
