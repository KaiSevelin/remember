import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const db = new DatabaseSync(process.env.DB_FILE ?? 'remember.db');

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    alarm_at   TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_alarm ON notes(user_id, alarm_at);
`);

/* ---------------------------------------------------------------- passwords */

// scrypt with a per-user random salt, stored as "salt:hash" in hex.
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------- users */

export function createUser(email, password) {
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)'
  );
  const info = stmt.run(email, hashPassword(password), new Date().toISOString());
  return { id: Number(info.lastInsertRowid), email };
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

/* ---------------------------------------------------------------- sessions */

const SESSION_DAYS = 30;

export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expires);
  return { token, expires };
}

export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT users.id, users.email, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    deleteSession(token);
    return null;
  }
  return { id: row.id, email: row.email };
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

/* ------------------------------------------------------------------- notes */

export function listNotes(userId) {
  return db.prepare(`
    SELECT id, text, alarm_at, done, created_at
    FROM notes WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}

export function createNote(userId, text, alarmAt) {
  const info = db.prepare(`
    INSERT INTO notes (user_id, text, alarm_at, created_at) VALUES (?, ?, ?, ?)
  `).run(userId, text, alarmAt, new Date().toISOString());
  return db.prepare('SELECT id, text, alarm_at, done, created_at FROM notes WHERE id = ?')
    .get(Number(info.lastInsertRowid));
}

export function setNoteDone(userId, noteId, done) {
  const info = db.prepare('UPDATE notes SET done = ? WHERE id = ? AND user_id = ?')
    .run(done ? 1 : 0, noteId, userId);
  return info.changes > 0;
}

export function deleteNote(userId, noteId) {
  const info = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(noteId, userId);
  return info.changes > 0;
}

/* -------------------------------------------------------------- demo user */

export const DEMO_EMAIL = 'demo@example.com';

// Sample notes, as hours relative to now — one already overdue so the alarmed
// (red) state is visible the moment you sign in.
const DEMO_NOTES = [
  ['Pay the parking fine', -30],
  ['Reply to Sam about the lease', -2],
  ['Take the bins out', 5],
  ['Book a dentist appointment', 48],
  ['Renew the passport', 24 * 21],
];

// Called on every non-dev startup: a session handed out by the test-login
// endpoint would otherwise keep working after a restart without --dev, since
// the session row outlives the process.
export function revokeDemoSessions() {
  db.prepare(`
    DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)
  `).run(DEMO_EMAIL);
}

// Finds or creates the demo account. Its password is random and thrown away —
// the account is only reachable through the dev-only test-login endpoint.
export function ensureDemoUser() {
  const existing = findUserByEmail(DEMO_EMAIL);
  if (existing) return { id: existing.id, email: existing.email };

  const user = createUser(DEMO_EMAIL, randomBytes(32).toString('hex'));
  for (const [text, hours] of DEMO_NOTES) {
    createNote(user.id, text, new Date(Date.now() + hours * 3_600_000).toISOString());
  }
  return user;
}

export default db;
