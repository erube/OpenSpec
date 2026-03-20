import type Database from 'better-sqlite3';

export interface TaskRecord {
  project_id: string;
  change_name: string;
  task_id: string;
  section: string;
  title: string;
  status: string;
  updated_at: string;
}

export interface TaskProgressSummary {
  done: number;
  inProgress: number;
  pending: number;
  total: number;
}

export function claimNextTask(db: Database.Database, projectId: string, changeName: string): TaskRecord | null {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = 'in-progress', updated_at = datetime('now')
    WHERE rowid = (
      SELECT rowid FROM tasks
      WHERE project_id = ? AND change_name = ? AND status = 'pending'
      ORDER BY task_id
      LIMIT 1
    )
    RETURNING *
  `);
  const row = stmt.get(projectId, changeName) as TaskRecord | undefined;
  return row ?? null;
}

export function markTaskDone(db: Database.Database, projectId: string, changeName: string, taskId: string): TaskRecord | null {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = 'done', updated_at = datetime('now')
    WHERE project_id = ? AND change_name = ? AND task_id = ?
    RETURNING *
  `);
  const row = stmt.get(projectId, changeName, taskId) as TaskRecord | undefined;
  return row ?? null;
}

export function releaseTask(db: Database.Database, projectId: string, changeName: string, taskId: string): TaskRecord | null {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = 'pending', updated_at = datetime('now')
    WHERE project_id = ? AND change_name = ? AND task_id = ? AND status = 'in-progress'
    RETURNING *
  `);
  const row = stmt.get(projectId, changeName, taskId) as TaskRecord | undefined;
  return row ?? null;
}

export function listTasks(db: Database.Database, projectId: string, changeName: string, status?: string): TaskRecord[] {
  if (status) {
    return db
      .prepare('SELECT * FROM tasks WHERE project_id = ? AND change_name = ? AND status = ? ORDER BY task_id')
      .all(projectId, changeName, status) as TaskRecord[];
  }
  return db
    .prepare('SELECT * FROM tasks WHERE project_id = ? AND change_name = ? ORDER BY task_id')
    .all(projectId, changeName) as TaskRecord[];
}

export function getTaskProgress(db: Database.Database, projectId: string, changeName: string): TaskProgressSummary {
  const rows = db
    .prepare('SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? AND change_name = ? GROUP BY status')
    .all(projectId, changeName) as Array<{ status: string; count: number }>;

  const counts: TaskProgressSummary = { done: 0, inProgress: 0, pending: 0, total: 0 };
  for (const row of rows) {
    if (row.status === 'done') counts.done = row.count;
    else if (row.status === 'in-progress') counts.inProgress = row.count;
    else if (row.status === 'pending') counts.pending = row.count;
    counts.total += row.count;
  }
  return counts;
}

export function getTask(db: Database.Database, projectId: string, changeName: string, taskId: string): TaskRecord | null {
  const row = db
    .prepare('SELECT * FROM tasks WHERE project_id = ? AND change_name = ? AND task_id = ?')
    .get(projectId, changeName, taskId) as TaskRecord | undefined;
  return row ?? null;
}

export function hasTasksForChange(db: Database.Database, projectId: string, changeName: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM tasks WHERE project_id = ? AND change_name = ? LIMIT 1')
    .get(projectId, changeName);
  return row !== undefined;
}

export function insertTask(
  db: Database.Database,
  projectId: string,
  changeName: string,
  taskId: string,
  section: string,
  title: string,
  status: string,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO tasks (project_id, change_name, task_id, section, title, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(projectId, changeName, taskId, section, title, status);
}

export function getChangesWithTasks(db: Database.Database, projectId?: string): Array<{ project_id: string; change_name: string }> {
  if (projectId) {
    return db
      .prepare('SELECT DISTINCT project_id, change_name FROM tasks WHERE project_id = ? ORDER BY change_name')
      .all(projectId) as Array<{ project_id: string; change_name: string }>;
  }
  return db
    .prepare('SELECT DISTINCT project_id, change_name FROM tasks ORDER BY project_id, change_name')
    .all() as Array<{ project_id: string; change_name: string }>;
}
