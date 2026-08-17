const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  notes: [],
  view: 'notes',   // 'notes' | 'due'
  authMode: 'login', // 'login' | 'register'
};

/* --------------------------------------------------------------- API calls */

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/* ----------------------------------------------------------------- helpers */

const isAlarmed = (note) => !note.done && new Date(note.alarm_at) <= new Date();

function formatAlarm(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// "in 3 hours" / "2 days ago", relative to now.
function relativeTime(iso) {
  const diffMs = new Date(iso) - new Date();
  const units = [
    ['minute', 60_000], ['hour', 3_600_000], ['day', 86_400_000], ['week', 604_800_000],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  let [unit, ms] = units[0];
  for (const [u, m] of units) if (Math.abs(diffMs) >= m) [unit, ms] = [u, m];
  return rtf.format(Math.round(diffMs / ms), unit);
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

/* --------------------------------------------------------------- rendering */

function noteItem(note, { showRelative = false } = {}) {
  const li = document.createElement('li');
  li.className = 'note';
  if (note.done) li.classList.add('done');
  else if (isAlarmed(note)) li.classList.add('alarmed');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = Boolean(note.done);
  check.title = note.done ? 'Mark as not done' : 'Mark as done';
  check.addEventListener('change', () => toggleDone(note, check.checked));

  const main = document.createElement('div');
  main.className = 'note-main';

  const text = document.createElement('span');
  text.className = 'note-text';
  text.textContent = note.text;

  const meta = document.createElement('span');
  meta.className = 'note-meta';
  meta.textContent = note.done
    ? `Done · was due ${formatAlarm(note.alarm_at)}`
    : isAlarmed(note)
      ? `Alarmed · was due ${formatAlarm(note.alarm_at)}`
      : `Due ${formatAlarm(note.alarm_at)}`;

  main.append(text, meta);

  const right = document.createElement('div');
  right.className = 'note-right';

  if (showRelative && !note.done) {
    const rel = document.createElement('span');
    rel.className = 'relative';
    rel.textContent = relativeTime(note.alarm_at);
    right.append(rel);
  }

  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  del.title = 'Delete note';
  del.setAttribute('aria-label', `Delete note: ${note.text}`);
  del.textContent = '✕';
  del.addEventListener('click', () => removeNote(note));
  right.append(del);

  li.append(check, main, right);
  return li;
}

function render() {
  $('view-login').hidden = Boolean(state.user);
  $('app-shell').hidden = !state.user;
  if (!state.user) return;

  $('account-email').textContent = state.user.email;
  $('view-notes').hidden = state.view !== 'notes';
  $('view-due').hidden = state.view !== 'due';
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  }

  // View 2 — everything, newest first (server order).
  const list = $('notes-list');
  list.replaceChildren(...state.notes.map((n) => noteItem(n)));
  $('notes-empty').hidden = state.notes.length > 0;

  // View 3 — outstanding notes sorted by alarm time, soonest first.
  const due = state.notes
    .filter((n) => !n.done)
    .sort((a, b) => new Date(a.alarm_at) - new Date(b.alarm_at));
  $('due-list').replaceChildren(...due.map((n) => noteItem(n, { showRelative: true })));
  $('due-empty').hidden = due.length > 0;

  const alarmed = due.filter(isAlarmed).length;
  const badge = $('alarm-count');
  badge.textContent = alarmed;
  badge.hidden = alarmed === 0;
}

/* ----------------------------------------------------------------- actions */

async function loadNotes() {
  const { notes } = await api('/api/notes');
  state.notes = notes;
  render();
}

async function toggleDone(note, done) {
  await api(`/api/notes/${note.id}`, { method: 'PATCH', body: { done } });
  note.done = done ? 1 : 0;
  render();
}

async function removeNote(note) {
  await api(`/api/notes/${note.id}`, { method: 'DELETE' });
  state.notes = state.notes.filter((n) => n.id !== note.id);
  render();
}

/* -------------------------------------------------------------------- auth */

function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === 'register';
  $('auth-submit').textContent = registering ? 'Create account' : 'Sign in';
  $('auth-tagline').textContent = registering
    ? 'Create an account and start remembering.'
    : 'Sign in to see what you owe your future self.';
  $('switch-text').textContent = registering ? 'Already have an account?' : 'No account yet?';
  $('switch-mode').textContent = registering ? 'Sign in' : 'Create one';
  $('password').autocomplete = registering ? 'new-password' : 'current-password';
  showError($('auth-error'), '');
}

$('switch-mode').addEventListener('click', () => {
  setAuthMode(state.authMode === 'login' ? 'register' : 'login');
});

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showError($('auth-error'), '');
  const button = $('auth-submit');
  button.disabled = true;
  try {
    const path = state.authMode === 'register' ? '/api/register' : '/api/login';
    const { user } = await api(path, {
      method: 'POST',
      body: { email: $('email').value.trim(), password: $('password').value },
    });
    state.user = user;
    $('auth-form').reset();
    state.view = 'notes';
    await loadNotes();
  } catch (err) {
    showError($('auth-error'), err.message);
  } finally {
    button.disabled = false;
  }
});

// Dev-only: signs in as the demo account with no credentials. The button stays
// hidden unless the server was started with --dev.
$('test-login').addEventListener('click', async () => {
  showError($('auth-error'), '');
  try {
    const { user } = await api('/api/test-login', { method: 'POST' });
    state.user = user;
    state.view = 'notes';
    await loadNotes();
  } catch {
    // The page was loaded against a dev server that has since been replaced by
    // a normal one, so the button is stale. Say what to do, and hide it.
    showError($('auth-error'),
      'Test login is off on this server. Restart it with "npm run dev" (or the ' +
      '"Run Remember (dev — test login on)" launch config), then reload this page.');
    $('test-login-box').hidden = true;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  state.user = null;
  state.notes = [];
  setAuthMode('login');
  render();
});

/* ------------------------------------------------------------------- notes */

// datetime-local wants local wall-clock time, not UTC.
function localInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resetAlarmDefault() {
  $('note-alarm').value = localInputValue(new Date(Date.now() + 86_400_000));
}

$('note-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  showError($('note-error'), '');
  try {
    const { note } = await api('/api/notes', {
      method: 'POST',
      body: { text: $('note-text').value, alarm_at: $('note-alarm').value },
    });
    state.notes.unshift(note);
    $('note-text').value = '';
    resetAlarmDefault();
    render();
  } catch (err) {
    showError($('note-error'), err.message);
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    render();
  });
}

/* ------------------------------------------------------------------- start */

// Notes can cross their alarm time while the page sits open.
setInterval(() => { if (state.user) render(); }, 30_000);

resetAlarmDefault();
setAuthMode('login');

try {
  const { testLogin } = await api('/api/config');
  $('test-login-box').hidden = !testLogin;
} catch { /* leave the test-login button hidden */ }

try {
  const { user } = await api('/api/me');
  state.user = user;
  await loadNotes();
} catch {
  render();
}
