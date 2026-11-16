// Baza de date node:sqlite: deschidere, migrații simple (PRAGMA user_version) și interogările folosite.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = [
  // v1
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     pass TEXT NOT NULL,
     display_name TEXT NOT NULL,
     avatar TEXT NOT NULL,
     color TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('admin', 'child')),
     minutes_per_day INTEGER,
     from_hm TEXT,
     to_hm TEXT,
     disabled INTEGER NOT NULL DEFAULT 0,
     last_beat INTEGER,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE usage (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     day TEXT NOT NULL,
     seconds INTEGER NOT NULL DEFAULT 0,
     bonus_min INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, day)
   );
   CREATE TABLE progress (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL,
     data TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game)
   );`,
  // v2: salvări pe sloturi (1–3) per utilizator și joc; `data` = base64, `size` = lungimea lui în octeți
  `CREATE TABLE saves (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL,
     slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
     name TEXT NOT NULL,
     data TEXT NOT NULL,
     size INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, game, slot)
   );`,
];

/** Deschide (sau creează) `<dataDir>/jocuri.db` și aplică migrațiile lipsă. */
export function openDb(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDir, 'jocuri.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return wrap(db);
}

function wrap(db) {
  const q = (sql) => db.prepare(sql);
  const s = {
    userById: q('SELECT * FROM users WHERE id = ?'),
    userByName: q('SELECT * FROM users WHERE username = ?'),
    users: q('SELECT * FROM users ORDER BY role, display_name COLLATE NOCASE, id'),
    countAdmins: q("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0"),
    insertUser: q(`INSERT INTO users (username, pass, display_name, avatar, color, role, minutes_per_day, from_hm, to_hm, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    deleteUser: q('DELETE FROM users WHERE id = ?'),
    setBeat: q('UPDATE users SET last_beat = ? WHERE id = ?'),
    insertSession: q('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
    session: q('SELECT * FROM sessions WHERE token_hash = ?'),
    extendSession: q('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
    deleteSession: q('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: q('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?'),
    trimSessions: q(`DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN
                     (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`),
    purgeSessions: q('DELETE FROM sessions WHERE expires_at <= ?'),
    usage: q('SELECT seconds, bonus_min FROM usage WHERE user_id = ? AND day = ?'),
    addSeconds: q(`INSERT INTO usage (user_id, day, seconds) VALUES (?, ?, ?)
                   ON CONFLICT (user_id, day) DO UPDATE SET seconds = seconds + excluded.seconds`),
    setBonus: q(`INSERT INTO usage (user_id, day, bonus_min) VALUES (?, ?, ?)
                 ON CONFLICT (user_id, day) DO UPDATE SET bonus_min = excluded.bonus_min`),
    progress: q('SELECT data, updated_at FROM progress WHERE user_id = ? AND game = ?'),
    putProgress: q(`INSERT INTO progress (user_id, game, data, updated_at) VALUES (?, ?, ?, ?)
                    ON CONFLICT (user_id, game) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    saves: q('SELECT slot, name, size, updated_at FROM saves WHERE user_id = ? AND game = ? ORDER BY slot'),
    save: q('SELECT slot, name, data, updated_at FROM saves WHERE user_id = ? AND game = ? AND slot = ?'),
    saveSize: q('SELECT size FROM saves WHERE user_id = ? AND game = ? AND slot = ?'),
    countUserSaves: q('SELECT COUNT(*) AS n FROM saves WHERE user_id = ?'),
    totalSavesSize: q('SELECT COALESCE(SUM(size), 0) AS n FROM saves'),
    putSave: q(`INSERT INTO saves (user_id, game, slot, name, data, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, game, slot) DO UPDATE SET name = excluded.name, data = excluded.data,
                  size = excluded.size, updated_at = excluded.updated_at`),
    deleteSave: q('DELETE FROM saves WHERE user_id = ? AND game = ? AND slot = ?'),
  };

  /** UPDATE users SET <câmpuri din lista albă> WHERE id = ? */
  const COLS = new Set(['pass', 'display_name', 'avatar', 'color', 'minutes_per_day', 'from_hm', 'to_hm', 'disabled']);
  function updateUser(id, fields) {
    const keys = Object.keys(fields).filter((k) => COLS.has(k));
    if (!keys.length) return;
    db.prepare(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => fields[k]), id);
  }

  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  return { raw: db, s, updateUser, tx, close: () => db.close() };
}
