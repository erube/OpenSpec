import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create tasks table',
    up: `
      CREATE TABLE IF NOT EXISTS tasks (
        change_name TEXT NOT NULL,
        task_id TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (change_name, task_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (change_name, status);
    `,
  },
  {
    version: 2,
    description: 'Add project_id column for cross-project support',
    up: `
      CREATE TABLE IF NOT EXISTS tasks_v2 (
        project_id TEXT NOT NULL DEFAULT 'unknown',
        change_name TEXT NOT NULL,
        task_id TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, change_name, task_id)
      );
      INSERT OR IGNORE INTO tasks_v2 (project_id, change_name, task_id, section, title, status, updated_at)
        SELECT 'unknown', change_name, task_id, section, title, status, updated_at FROM tasks;
      DROP TABLE IF EXISTS tasks;
      ALTER TABLE tasks_v2 RENAME TO tasks;
      DROP INDEX IF EXISTS idx_tasks_status;
      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project_id, change_name, status);
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM migrations').all().map((row: any) => row.version)
  );

  const pending = migrations.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;

  const applyMigration = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.up);
      db.prepare('INSERT INTO migrations (version, description) VALUES (?, ?)').run(
        migration.version,
        migration.description
      );
    }
  });

  applyMigration();
}
