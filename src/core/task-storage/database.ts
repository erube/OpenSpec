import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { getGlobalConfigDir } from '../global-config.js';
import { runMigrations } from './migrations.js';

let db: Database.Database | null = null;

export function openDatabase(): Database.Database {
  if (db) return db;

  const dir = getGlobalConfigDir();
  mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, 'tasks.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDatabase(): Database.Database | null {
  return db;
}
