import { supabase, isSupabaseConfigured } from './supabase.js';

const page = document.body.classList.contains('admin-body') && document.querySelector('#login-form') ? 'login' : 'dashboard';
const message = (element, text = '', type = '') => { if (!element) return; element.textContent = text; element.className = `form-message ${type}`; };
const setBusy = (button, busy) => { button.disabled = busy; button.classList.toggle('is-busy', busy); };
const prettyError = (error) => error?.message?.toLowerCase().includes('invalid login credentials') ? 'The email or password is incorrect.' : 'Something went wrong. Please try again.';
const baseUrl = import.meta.env.BASE_URL;
const loginPath = `${baseUrl}admin/login/`;
const dashboardPath = `${baseUrl}admin/`;

const getAdminSession = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) return { session: null, isAdmin: false };
  const { data: adminRecord, error: adminError } = await supabase.from('admin_users').select('id').eq('id', sessionData.session.user.id).maybeSingle();
  return { session: sessionData.session, isAdmin: Boolean(adminRecord) && !adminError };
};

if (!isSupabaseConfigured) {
  const target = document.querySelector('#login-message') || document.querySelector('#portfolio-message');
  message(target, 'Add your Supabase values to .env before using the admin.', 'error');
}

const redirectToLogin = () => { window.location.replace(loginPath); };

if (page === 'login') {
  if (isSupabaseConfigured) {
    const auth = await getAdminSession();
    if (auth.isAdmin) window.location.replace(dashboardPath);
    else if (auth.session) await supabase.auth.signOut();
  }
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const target = document.querySelector('#login-message');
    if (!isSupabaseConfigured) return;
    setBusy(button, true); message(target);
    const values = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({ email: values.get('email'), password: values.get('password') });
    if (error) { message(target, prettyError(error), 'error'); setBusy(button, false); return; }
    const auth = await getAdminSession();
    if (!auth.isAdmin) {
      await supabase.auth.signOut();
      message(target, 'This account is not authorized for the admin dashboard.', 'error');
      setBusy(button, false);
      return;
    }
    window.location.replace(dashboardPath);
  });
}

if (page === 'dashboard') {
  if (!isSupabaseConfigured) {
    message(document.querySelector('#portfolio-message'), 'Configure Supabase to load your dashboard.', 'error');
  }
  const auth = await getAdminSession();
  if (!auth.session || !auth.isAdmin) {
    if (auth.session) await supabase.auth.signOut();
    redirectToLogin();
  }

  const state = { items: [], editing: null };
  const list = document.querySelector('#portfolio-list');
  const drawer = document.querySelector('#work-drawer');
  const form = document.querySelector('#work-form');
  const selectedFile = () => form.elements.media.files[0];
  const closeDrawer = () => { drawer.hidden = true; form.reset(); state.editing = null; document.querySelector('#drawer-title').textContent = 'Add new work'; document.querySelector('#upload-preview').innerHTML = ''; message(document.querySelector('#work-message')); };
  document.querySelectorAll('[data-close-drawer]').forEach((element) => element.addEventListener('click', closeDrawer));
  document.querySelector('#new-work-button')?.addEventListener('click', () => { drawer.hidden = false; });
  document.querySelector('#logout-button')?.addEventListener('click', async () => { await supabase.auth.signOut(); redirectToLogin(); });

  const renderStats = () => {
    const stats = [state.items.length, state.items.filter((item) => item.is_published).length, state.items.filter((item) => !item.is_published).length, state.items.filter((item) => item.media_type === 'video').length, state.items.filter((item) => item.media_type === 'image').length];
    document.querySelector('#stats-grid').innerHTML = stats.map((value, index) => `<div class="stat-card"><span>${['Total projects', 'Published', 'Hidden', 'Videos', 'Images'][index]}</span><strong>${value}</strong></div>`).join('');
  };
  const renderList = () => {
    if (!state.items.length) { list.innerHTML = '<div class="empty-state">No portfolio work yet. Add your first project.</div>'; renderStats(); return; }
    list.innerHTML = state.items.map((item) => `<article class="portfolio-admin-item" draggable="true" data-id="${item.id}"><div class="admin-thumb">${item.media_type === 'video' ? `<video src="${item.media_url}" muted preload="metadata"></video>` : `<img src="${item.media_url}" alt="">`}</div><div class="admin-item-copy"><span class="project-category">${item.category}</span><h3>${item.title}</h3><p>${item.description || 'No description'}</p><span class="status-pill ${item.is_published ? 'published' : 'hidden'}">${item.is_published ? 'Published' : 'Hidden'}</span></div><div class="item-actions"><button type="button" data-edit="${item.id}">Edit</button><button type="button" data-toggle="${item.id}">${item.is_published ? 'Hide' : 'Publish'}</button><button type="button" class="danger" data-delete="${item.id}">Delete</button></div></article>`).join('');
    renderStats();
    list.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editItem(button.dataset.edit)));
    list.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => toggleItem(button.dataset.toggle)));
    list.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteItem(button.dataset.delete)));
    list.querySelectorAll('.portfolio-admin-item').forEach((item) => { item.addEventListener('dragstart', () => item.classList.add('dragging')); item.addEventListener('dragend', () => { item.classList.remove('dragging'); saveOrder(); }); item.addEventListener('dragover', (event) => { event.preventDefault(); const dragging = list.querySelector('.dragging'); if (dragging && dragging !== item) { const box = item.getBoundingClientRect(); list.insertBefore(dragging, event.clientY < box.top + box.height / 2 ? item : item.nextSibling); } }); });
  };
  const loadItems = async () => { const { data, error } = await supabase.from('portfolio_items').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: false }); if (error) message(document.querySelector('#portfolio-message'), 'Unable to load portfolio. Check your Supabase setup.', 'error'); state.items = data || []; renderList(); };
  const loadSettings = async () => { const { data } = await supabase.from('contact_settings').select('*').eq('id', 1).maybeSingle(); if (data) Object.entries(data).forEach(([key, value]) => { const field = document.querySelector(`#settings-form [name="${key}"]`); if (field) field.value = value || ''; }); };
  const editItem = (id) => { const item = state.items.find((entry) => entry.id === id); if (!item) return; state.editing = item; document.querySelector('#drawer-title').textContent = 'Edit work'; Object.entries(item).forEach(([key, value]) => { const field = form.elements[key]; if (field && key !== 'media_url' && key !== 'thumbnail_url') field.type === 'checkbox' ? field.checked = value : field.value = value ?? ''; }); drawer.hidden = false; };
  const uploadFile = async (file) => { if (!file) return state.editing?.media_url; const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']; if (!allowed.includes(file.type)) throw new Error('Choose a JPG, PNG, WEBP, MP4, WEBM or MOV file.'); if (file.size > 100 * 1024 * 1024) throw new Error('Files must be smaller than 100 MB.'); const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi, '-')}`; const { error } = await supabase.storage.from('portfolio').upload(path, file, { contentType: file.type, upsert: false }); if (error) throw error; const { data } = supabase.storage.from('portfolio').getPublicUrl(path); return data.publicUrl; };
  const deleteStorageFile = async (url) => { const marker = '/storage/v1/object/public/portfolio/'; const path = url?.split(marker)[1]; if (path) await supabase.storage.from('portfolio').remove([decodeURIComponent(path)]); };
  const saveOrder = async () => { const ids = [...list.querySelectorAll('[data-id]')].map((item) => item.dataset.id); await Promise.all(ids.map((id, index) => supabase.from('portfolio_items').update({ display_order: index }).eq('id', id))); await loadItems(); };
  const toggleItem = async (id) => { const item = state.items.find((entry) => entry.id === id); if (!item) return; await supabase.from('portfolio_items').update({ is_published: !item.is_published }).eq('id', id); await loadItems(); };
  const deleteItem = async (id) => { const item = state.items.find((entry) => entry.id === id); if (!item || !window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return; const { error } = await supabase.from('portfolio_items').delete().eq('id', id); if (error) { message(document.querySelector('#portfolio-message'), 'Could not delete this project.', 'error'); return; } await deleteStorageFile(item.media_url); await loadItems(); };

  document.querySelector('#work-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); const target = document.querySelector('#work-message'); const values = new FormData(event.currentTarget); const file = selectedFile(); setBusy(button, true); message(target, 'Saving...'); try { const mediaUrl = await uploadFile(file); const payload = { title: values.get('title').trim(), category: values.get('category'), description: values.get('description').trim(), media_url: mediaUrl, media_type: file ? (file.type.startsWith('video/') ? 'video' : 'image') : state.editing.media_type, is_published: values.get('is_published') === 'on', display_order: Number(values.get('display_order')) || 0 }; const result = state.editing ? await supabase.from('portfolio_items').update(payload).eq('id', state.editing.id) : await supabase.from('portfolio_items').insert(payload); if (result.error) throw result.error; closeDrawer(); await loadItems(); } catch (error) { message(target, error.message?.includes('100 MB') || error.message?.includes('Choose') ? error.message : 'Could not save this project. Please try again.', 'error'); } finally { setBusy(button, false); } });
  document.querySelector('#settings-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); const values = Object.fromEntries(new FormData(event.currentTarget)); setBusy(button, true); const { error } = await supabase.from('contact_settings').upsert({ id: 1, ...values }); message(document.querySelector('#settings-message'), error ? 'Could not save contact settings.' : 'Contact settings saved.', error ? 'error' : 'success'); setBusy(button, false); });
  document.querySelector('#work-form [name="media"]')?.addEventListener('change', () => { const file = selectedFile(); const preview = document.querySelector('#upload-preview'); preview.innerHTML = file ? `<strong>${file.name}</strong><span>${(file.size / 1024 / 1024).toFixed(1)} MB</span>` : ''; });
  await loadItems(); await loadSettings();
}
