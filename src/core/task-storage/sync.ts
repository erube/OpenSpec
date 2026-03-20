import type Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import path from 'path';
import { parseTasksDetailed } from '../../utils/task-progress.js';
import { insertTask, hasTasksForChange } from './queries.js';

export function syncTasksFromMarkdown(
  db: Database.Database,
  projectId: string,
  projectRoot: string,
  changeName: string,
): { synced: number } {
  if (hasTasksForChange(db, projectId, changeName)) {
    return { synced: 0 };
  }

  const tasksPath = path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md');
  let content: string;
  try {
    content = readFileSync(tasksPath, 'utf-8');
  } catch {
    return { synced: 0 };
  }

  const tasks = parseTasksDetailed(content);
  if (tasks.length === 0) return { synced: 0 };

  const insertMany = db.transaction(() => {
    for (const task of tasks) {
      insertTask(
        db,
        projectId,
        changeName,
        task.taskId,
        task.section,
        task.title,
        task.done ? 'done' : 'pending',
      );
    }
  });

  insertMany();
  return { synced: tasks.length };
}

export async function writebackTaskDone(
  projectRoot: string,
  changeName: string,
  taskId: string,
): Promise<boolean> {
  const tasksPath = path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md');

  let content: string;
  try {
    content = await fs.readFile(tasksPath, 'utf-8');
  } catch {
    return false;
  }

  const lines = content.split('\n');
  const pattern = new RegExp(`^([-*]\\s+)\\[[ ]\\](\\s+${escapeRegex(taskId)}\\s)`);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      lines[i] = lines[i].replace(/\[[ ]\]/, '[x]');
      changed = true;
      break;
    }
  }

  if (changed) {
    await fs.writeFile(tasksPath, lines.join('\n'), 'utf-8');
  }

  return changed;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
