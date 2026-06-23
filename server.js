const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_DIR = process.env.RENDER ? '/data' : __dirname;
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'pipeline.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT,
    contact TEXT,
    status TEXT DEFAULT 'Reached Out',
    pops TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ai_events (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT,
    type TEXT,
    attendance INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

app.get('/api/logs/:profileId', (req, res) => {
  const logs = db.prepare('SELECT * FROM logs WHERE profile_id = ? ORDER BY date ASC').all(req.params.profileId);
  res.json(logs);
});

app.post('/api/logs', (req, res) => {
  const { id, profile_id, name, date, location, contact, status, pops, notes } = req.body;
  try {
    db.prepare(`INSERT OR REPLACE INTO logs (id, profile_id, name, date, location, contact, status, pops, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, profile_id, name, date, location, contact, status, pops, notes);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/logs/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE logs SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/logs/:id', (req, res) => {
  db.prepare('DELETE FROM logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/ai-events/:profileId', (req, res) => {
  const events = db.prepare('SELECT * FROM ai_events WHERE profile_id = ? ORDER BY date ASC').all(req.params.profileId);
  res.json(events);
});

app.post('/api/ai-events', (req, res) => {
  const events = req.body;
  const insert = db.prepare(`INSERT OR IGNORE INTO ai_events (id, profile_id, name, date, state, city, type, attendance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertMany = db.transaction((evts) => {
    for (const e of evts) insert.run(e.id, e.profile_id, e.name, e.date, e.state, e.city, e.type, e.attendance);
  });
  insertMany(events);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
