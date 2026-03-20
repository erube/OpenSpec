import { promises as fs } from 'fs';
import path from 'path';
import { parseTasksDetailed, countTasksFromContent } from '../../utils/task-progress.js';
import type { TaskRecord, TaskProgressSummary } from './queries.js';

function tasksPath(projectRoot: string, changeName: string): string {
  return path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md');
}

export async function listTasksMarkdown(
  projectRoot: string,
  changeName: string,
  status?: string,
): Promise<TaskRecord[]> {
  const filePath = tasksPath(projectRoot, changeName);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const tasks = parseTasksDetailed(content);
  const records: TaskRecord[] = tasks.map((t) => ({
    project_id: '',
    change_name: changeName,
    task_id: t.taskId,
    section: t.section,
    title: t.title,
    status: t.done ? 'done' : 'pending',
    updated_at: '',
  }));

  if (status) {
    return records.filter((r) => r.status === status);
  }
  return records;
}

export async function markTaskDoneMarkdown(
  projectRoot: string,
  changeName: string,
  taskId: string,
): Promise<{ found: boolean; alreadyDone: boolean; progress: TaskProgressSummary }> {
  const filePath = tasksPath(projectRoot, changeName);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { found: false, alreadyDone: false, progress: { done: 0, inProgress: 0, pending: 0, total: 0 } };
  }

  const tasks = parseTasksDetailed(content);
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) {
    const p = countTasksFromContent(content);
    return { found: false, alreadyDone: false, progress: { done: p.completed, inProgress: 0, pending: p.total - p.completed, total: p.total } };
  }

  if (task.done) {
    const p = countTasksFromContent(content);
    return { found: true, alreadyDone: true, progress: { done: p.completed, inProgress: 0, pending: p.total - p.completed, total: p.total } };
  }

  const lines = content.split('\n');
  const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^([-*]\\s+)\\[[ ]\\](\\s+${escapedId}\\s)`);

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      lines[i] = lines[i].replace(/\[[ ]\]/, '[x]');
      break;
    }
  }

  const newContent = lines.join('\n');
  await fs.writeFile(filePath, newContent, 'utf-8');

  const p = countTasksFromContent(newContent);
  return { found: true, alreadyDone: false, progress: { done: p.completed, inProgress: 0, pending: p.total - p.completed, total: p.total } };
}

export async function getTaskProgressMarkdown(
  projectRoot: string,
  changeName: string,
): Promise<TaskProgressSummary> {
  const filePath = tasksPath(projectRoot, changeName);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { done: 0, inProgress: 0, pending: 0, total: 0 };
  }

  const p = countTasksFromContent(content);
  return { done: p.completed, inProgress: 0, pending: p.total - p.completed, total: p.total };
}
