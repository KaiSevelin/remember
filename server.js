import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './db.js';

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const COOKIE = 'remember_session';

// Dev-only: enables the one-click test login, which signs in as the demo user
// without a password. Off unless explicitly asked for, so a plain `node
// server.js` (or any production start) has no way to reach it.
const TEST_LOGIN = process.argv.includes('--dev') || process.env.ALLOW_TEST_LOGIN === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* ----------------------------------------------------------------- helpers */

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token, expires) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expires).toUTCString()}`;
}

const CLEARED_COOKIE = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

function currentUser(req) {
  return store.userForSession(cookies(req)[COOKIE]);
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts what <input type="datetime-local"> emits ("2026-08-17T14:30") as well
// as a full ISO string; always stores UTC ISO.
function parseAlarm(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* -------------------------------------------------------------- API routes */

async function handleApi(req, res, url) {
  const path = url.pathname;
  const method = req.method;

  if (path === '/api/config' && method === 'GET') {
    return send(res, 200, { testLogin: TEST_LOGIN });
  }

  // Dev-only shortcut: no credentials, straight into the demo account.
  if (path === '/api/test-login' && method === 'POST') {
    if (!TEST_LOGIN) return send(res, 404, { error: 'No such endpoint.' });
    const user = store.ensureDemoUser();
    const { token, expires } = store.createSession(user.id);
    return send(res, 200, { user }, { 'Set-Cookie': sessionCookie(token, expires) });
  }

  if (path === '/api/register' && method === 'POST') {
    const { email, password } = await readJson(req);
    if (!EMAIL_RE.test(String(email ?? ''))) {
      return send(res, 400, { error: 'Enter a valid email address.' });
    }
    if (String(password ?? '').length < 8) {
      return send(res, 400, { error: 'Password must be at least 8 characters.' });
    }
    if (store.findUserByEmail(email)) {
      return send(res, 409, { error: 'That email is already registered.' });
    }
    const user = store.createUser(email.trim(), password);
    const { token, expires } = store.createSession(user.id);
    return send(res, 201, { user }, { 'Set-Cookie': sessionCookie(token, expires) });
  }

  if (path === '/api/login' && method === 'POST') {
    const { email, password } = await readJson(req);
    const user = store.findUserByEmail(String(email ?? ''));
    if (!user || !store.verifyPassword(String(password ?? ''), user.password_hash)) {
      return send(res, 401, { error: 'Wrong email or password.' });
    }
    const { token, expires } = store.createSession(user.id);
    return send(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(token, expires) });
  }

  if (path === '/api/logout' && method === 'POST') {
    store.deleteSession(cookies(req)[COOKIE]);
    return send(res, 200, { ok: true }, { 'Set-Cookie': CLEARED_COOKIE });
  }

  if (path === '/api/me' && method === 'GET') {
    const user = currentUser(req);
    return user ? send(res, 200, { user }) : send(res, 401, { error: 'Not signed in.' });
  }

  // Everything below requires a session.
  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'Not signed in.' });

  if (path === '/api/notes' && method === 'GET') {
    return send(res, 200, { notes: store.listNotes(user.id) });
  }

  if (path === '/api/notes' && method === 'POST') {
    const { text, alarm_at } = await readJson(req);
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return send(res, 400, { error: 'The note needs some text.' });
    if (trimmed.length > 500) return send(res, 400, { error: 'Keep the note under 500 characters.' });
    const alarm = parseAlarm(alarm_at);
    if (!alarm) return send(res, 400, { error: 'Pick a valid alarm date and time.' });
    return send(res, 201, { note: store.createNote(user.id, trimmed, alarm) });
  }

  const noteMatch = path.match(/^\/api\/notes\/(\d+)$/);
  if (noteMatch) {
    const id = Number(noteMatch[1]);
    if (method === 'DELETE') {
      return store.deleteNote(user.id, id)
        ? send(res, 200, { ok: true })
        : send(res, 404, { error: 'Note not found.' });
    }
    if (method === 'PATCH') {
      const { done } = await readJson(req);
      return store.setNoteDone(user.id, id, Boolean(done))
        ? send(res, 200, { ok: true })
        : send(res, 404, { error: 'Note not found.' });
    }
  }

  return send(res, 404, { error: 'No such endpoint.' });
}

/* ------------------------------------------------------------ static files */

async function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(PUBLIC_DIR, normalize(requested).replace(/^[\\/]+/, ''));

  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
  }
}

/* ------------------------------------------------------------------ server */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 400, { error: 'Bad request.' });
  }
});

store.purgeExpiredSessions();
if (!TEST_LOGIN) store.revokeDemoSessions();
setInterval(store.purgeExpiredSessions, 3600_000).unref();

server.listen(PORT, () => {
  console.log(`Remember is running at http://localhost:${PORT}`);
  if (TEST_LOGIN) console.log('Dev mode: one-click test login is ENABLED (no password required).');
});
