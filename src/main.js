import './style.css';
import { createScene } from './scene.js';
import { createWorkshopAudio } from './audio.js';
import { profile } from './config.js';
const $ = selector => document.querySelector(selector);
const audio = createWorkshopAudio();
let scene, current = 'home', navigationId = 0, exploded = false, soundEnabled = false;
const contact = $('#display-contact'), diagnosticButton = $('#diagnostic-control');
const icons = {
  telegram: '<path d="m3 10 17-7-4 17-6-6-4 3 1-6Z"/><path d="m7 11 9-5-6 8"/>',
  github: '<path d="M9 20c-5 1-5-3-7-3m14 5v-4c0-1-.3-2-1-2 4-.5 6-2 6-6 0-2-.6-3-2-4 0-1 0-2-.3-3-2 0-3 1-4 2a14 14 0 0 0-6 0C8 4 7 3 5 3c-.4 1-.4 2-.2 3C3.5 7 3 8 3 10c0 4 2 5.5 6 6-.7.5-1 1-1 2v4"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
};
for (const [type, value] of Object.entries(profile.contacts)) {
  if (!value) continue;
  const link = document.createElement('a'); link.className = 'contact-link'; link.href = type === 'email' ? `mailto:${value}` : value;
  if (type !== 'email') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  const icon = document.createElement('span'); icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[type]}</svg>`;
  const labels = document.createElement('span');
  const name = document.createElement('span'); name.className = 'contact-name'; name.textContent = { telegram: 'Telegram', github: 'GitHub', email: 'Email' }[type];
  const detail = document.createElement('span'); detail.className = 'contact-value'; detail.textContent = type === 'email' ? value : `@${new URL(value).pathname.slice(1)}`;
  labels.append(name, detail);
  const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
  link.append(icon, labels, arrow); $('#contact-links').append(link);
}

function error(failure) {
  console.error('Workshop:', failure);
  document.body.classList.add('scene-unavailable');
  diagnosticButton.hidden = true; $('.armor-access').inert = true; $('#drag-hint').hidden = true;
  const loader = $('.scene-error'); loader.hidden = false; loader.replaceChildren();
  const message = document.createElement('span'); message.textContent = '3D is unavailable. Contact is still available.';
  const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.addEventListener('click', () => location.reload());
  loader.append(message, retry); $('#displays').append(contact);
}
function diagnosticChanged(value) {
  exploded = value; diagnosticButton.setAttribute('aria-pressed', String(value));
  diagnosticButton.textContent = value ? 'Assemble' : 'Exploded view';
  $('.back-button').hidden = current === 'home' && !value;
  $('#navigation-status').textContent = value ? 'Exploded diagnostic view' : 'Armor assembled';
  if (value) audio.signal();
}
try {
  scene = createScene($('#scene'), {
    onReady() { document.body.classList.add('ready'); diagnosticButton.disabled = false; },
    onDiagnostic: diagnosticChanged,
    onExplore: () => navigate('contact'),
    onTurn() { $('#drag-hint').classList.add('used'); audio.motion(); },
    onService: () => audio.signal(),
    onError: error,
  });
} catch (failure) { error(failure); }
async function navigate(next, {history = true, focus = true} = {}) {
  next = next === 'contact' ? 'contact' : 'home';
  const id = ++navigationId; current = next;
  if (history) window.history.pushState({view:next}, '', `#${next}`);
  document.body.dataset.view = next;
  document.title = `hanagumori — ${next === 'home' ? 'Armor systems' : 'Contact'}`;
  $('.back-button').hidden = next === 'home';
  $('.scene-nav').setAttribute('aria-hidden', String(next !== 'home')); $('.scene-nav').inert = true;
  $('.armor-access').inert = next !== 'home' || document.body.classList.contains('scene-unavailable');
  contact.inert = true; contact.setAttribute('aria-hidden','true'); contact.classList.remove('is-active');
  if (!document.body.classList.contains('scene-unavailable')) await scene?.navigate(next);
  if (id !== navigationId) return;
  $('.scene-nav').inert = next !== 'home';
  if (next === 'contact') {
    contact.classList.add('is-active'); contact.inert = false; contact.removeAttribute('aria-hidden');
    if (focus) $('#contact-heading').focus({preventScroll:true}); audio.signal();
  } else if (focus) $('[data-go="contact"]').focus({preventScroll:true});
  $('#navigation-status').textContent = next === 'home' ? 'Workshop' : 'Contact ready';
}
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-go], .brand'); if (!trigger) return;
  event.preventDefault(); const route = trigger.dataset.go || 'home';
  if (route === 'home' && current === 'home') { scene?.toggleDiagnostic(false); return; }
  if (route !== current) navigate(route);
});
diagnosticButton.addEventListener('click', () => scene?.toggleDiagnostic());
$('[data-action="service"]').addEventListener('click', () => scene?.service());
for (const trigger of document.querySelectorAll('.scene-link')) {
  const hover = () => scene?.setHover(trigger.dataset.go || 'contact');
  trigger.addEventListener('pointerenter',hover); trigger.addEventListener('focus',hover);
  trigger.addEventListener('pointerleave',()=>scene?.setHover('')); trigger.addEventListener('blur',()=>scene?.setHover(''));
}
for (const button of document.querySelectorAll('[data-part]')) {
  button.addEventListener('focus',()=>scene?.inspect(button.dataset.part));
  button.addEventListener('click',()=>scene?.inspect(button.dataset.part));
  button.addEventListener('blur',()=>scene?.inspect(''));
}
$('#sound-control').addEventListener('click',async()=>{
  const button = $('#sound-control'); button.disabled = true;
  try { soundEnabled = await audio.setEnabled(!soundEnabled); button.textContent = soundEnabled ? 'Sound on' : 'Sound off'; button.setAttribute('aria-pressed',String(soundEnabled)); button.setAttribute('aria-label',soundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'); }
  catch { button.textContent = 'Sound unavailable'; }
  finally { button.disabled = false; }
});
window.addEventListener('popstate',()=>navigate(location.hash.slice(1),{history:false}));
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  scene?.inspect('');
  if (current !== 'home') navigate('home'); else if (exploded) scene?.toggleDiagnostic(false);
});
const initial = location.hash.slice(1);
if (initial === 'contact') navigate(initial,{history:false,focus:false});
else if (initial && initial !== 'home') window.history.replaceState(null,'','#home');

