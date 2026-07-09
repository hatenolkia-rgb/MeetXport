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
