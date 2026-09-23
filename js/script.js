import { supabase, isSupabaseConfigured } from './supabase.js';

const navbar = document.querySelector('.navbar');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

const updateNavbar = () => {
  navbar.classList.toggle('scrolled', window.scrollY > 24);
};

updateNavbar();
window.addEventListener('scroll', updateNavbar, { passive: true });

menuToggle?.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => revealObserver.observe(item));

const portfolioGrid = document.querySelector('#portfolio-grid');
const contactLinks = document.querySelector('#contact-links');
const mediaModal = document.querySelector('#media-modal');

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);

const projectMarkup = (item, index) => {
  const layoutClass = index % 5 === 0 ? 'wide' : index % 5 === 1 ? 'tall' : '';
  const media = item.media_type === 'video'
    ? `<video src="${escapeHtml(item.media_url)}" muted playsinline loop preload="metadata" aria-label="${escapeHtml(item.title)}"></video>`
    : `<img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title)}" loading="lazy">`;
  return `<article class="project dynamic-project ${layoutClass} reveal" data-project-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(item.title)}"><div class="project-media">${media}</div><div class="project-content"><div><p class="project-category">${escapeHtml(item.category)}</p><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p class="project-description">${escapeHtml(item.description)}</p>` : ''}</div><span class="arrow">&nearr;</span></div></article>`;
};

const renderPortfolio = (items) => {
  if (!items.length) {
    portfolioGrid.innerHTML = '<p class="portfolio-status">New work is on the way. Check back soon.</p>';
    return;
  }
  portfolioGrid.innerHTML = items.map(projectMarkup).join('');
  portfolioGrid.querySelectorAll('.dynamic-project').forEach((project) => {
    const open = () => openMediaModal(items.find((item) => item.id === project.dataset.projectId));
    project.addEventListener('click', open);
    project.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    revealObserver.observe(project);
    const video = project.querySelector('video');
    if (video) project.addEventListener('mouseenter', () => video.play().catch(() => {}));
  });
};

const loadPortfolio = async () => {
  if (!isSupabaseConfigured) { renderPortfolio([]); return; }
  const { data, error } = await supabase.from('portfolio_items').select('*').eq('is_published', true).order('display_order', { ascending: true }).order('created_at', { ascending: false });
  renderPortfolio(error ? [] : (data || []));
};

const renderContact = (settings) => {
  const footerEmail = document.querySelector('#footer-email');
  const footerWhatsapp = document.querySelector('#footer-whatsapp');
  const footerInstagram = document.querySelector('#footer-instagram');
  if (!settings) { contactLinks.innerHTML = '<p class="contact-status">Contact details coming soon.</p>'; return; }
  const whatsapp = String(settings.whatsapp_number || '').replace(/[^\d]/g, '');
  if (footerEmail && settings.email) footerEmail.href = `mailto:${settings.email}`;
  if (footerWhatsapp && whatsapp) { footerWhatsapp.href = `https://wa.me/${whatsapp}`; footerWhatsapp.target = '_blank'; footerWhatsapp.rel = 'noreferrer'; }
  if (footerInstagram && settings.instagram_url) { footerInstagram.href = settings.instagram_url; footerInstagram.target = '_blank'; footerInstagram.rel = 'noreferrer'; }
  contactLinks.innerHTML = `${settings.email ? `<a class="contact-link" href="mailto:${escapeHtml(settings.email)}"><span>Email</span>${escapeHtml(settings.email)} <b class="arrow">&nearr;</b></a>` : ''}${whatsapp ? `<a class="contact-link prominent" href="https://wa.me/${whatsapp}" target="_blank" rel="noreferrer"><span>WhatsApp</span>Message us <b class="arrow">&nearr;</b></a>` : ''}${settings.instagram_url ? `<a class="contact-link" href="${escapeHtml(settings.instagram_url)}" target="_blank" rel="noreferrer"><span>Instagram</span>Instagram <b class="arrow">&nearr;</b></a>` : ''}` || '<p class="contact-status">Contact details coming soon.</p>';
};

const loadContact = async () => {
  if (!isSupabaseConfigured) { renderContact(null); return; }
  const { data, error } = await supabase.from('contact_settings').select('*').eq('id', 1).maybeSingle();
  renderContact(error ? null : data);
};

const openMediaModal = (item) => {
  if (!item) return;
  document.querySelector('#media-modal-category').textContent = item.category;
  document.querySelector('#media-modal-title').textContent = item.title;
  document.querySelector('#media-modal-description').textContent = item.description || '';
  document.querySelector('#media-modal-media').innerHTML = item.media_type === 'video' ? `<video src="${escapeHtml(item.media_url)}" controls autoplay muted playsinline></video>` : `<img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title)}">`;
  mediaModal.hidden = false;
  document.body.classList.add('modal-open');
};

document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', () => { mediaModal.hidden = true; document.body.classList.remove('modal-open'); document.querySelector('#media-modal-media').innerHTML = ''; }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !mediaModal.hidden) { mediaModal.hidden = true; document.body.classList.remove('modal-open'); } });

loadPortfolio();
loadContact();
