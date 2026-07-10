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
function handleSubmit(e){
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
  try{
    const existing = JSON.parse(localStorage.getItem('meetxport_leads') || '[]');
    existing.push(entry);
    localStorage.setItem('meetxport_leads', JSON.stringify(existing));
  }catch(err){ console.error('Could not save lead locally', err); }

  const msg = document.getElementById('formMsg');
  if(msg) msg.classList.add('show');
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
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('in'); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

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
    'leads': 'leads',
    'linkedin-addon': 'leads',
    'whatsapp-addon': 'leads'
  };
  if(planToInterest[plan]) interestSelect.value = planToInterest[plan];
});

// Hero outreach dashboard: count-up stats, floating "buyer activity" cards
document.addEventListener('DOMContentLoaded', () => {
  const dashboardEl = document.getElementById('routePanel');
  if(dashboardEl){
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
