import { promises as fs } from 'fs';
import path from 'path';

const TASK_PATTERN = /^[-*]\s+\[[\sx]\]/i;
const COMPLETED_TASK_PATTERN = /^[-*]\s+\[x\]/i;
const SECTION_PATTERN = /^##\s+\d+\.\s+(.+)$/;
const DOTTED_ID_PATTERN = /^[-*]\s+\[[\sx]\]\s+(\d+\.\d+)\s+(.+)$/i;

export interface TaskProgress {
  total: number;
  completed: number;
}

export interface DetailedTask {
  taskId: string;
  section: string;
  title: string;
  done: boolean;
  lineNumber: number;
}

export function countTasksFromContent(content: string): TaskProgress {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (line.match(TASK_PATTERN)) {
      total++;
      if (line.match(COMPLETED_TASK_PATTERN)) {
        completed++;
      }
    }
  }
  return { total, completed };
}

export async function getTaskProgressForChange(changesDir: string, changeName: string): Promise<TaskProgress> {
  const tasksPath = path.join(changesDir, changeName, 'tasks.md');
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    return countTasksFromContent(content);
  } catch {
    return { total: 0, completed: 0 };
  }
}

export function parseTasksDetailed(content: string): DetailedTask[] {
  const lines = content.split('\n');
  const tasks: DetailedTask[] = [];
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const idMatch = line.match(DOTTED_ID_PATTERN);
    if (idMatch) {
      const done = COMPLETED_TASK_PATTERN.test(line);
      tasks.push({
        taskId: idMatch[1],
        section: currentSection,
        title: idMatch[2].trim(),
        done,
        lineNumber: i + 1,
      });
    }
  }

  return tasks;
}

export async function parseTasksForChange(changesDir: string, changeName: string): Promise<DetailedTask[]> {
  const tasksPath = path.join(changesDir, changeName, 'tasks.md');
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    return parseTasksDetailed(content);
  } catch {
    return [];
  }
}

export function formatTaskStatus(progress: TaskProgress): string {
  if (progress.total === 0) return 'No tasks';
  if (progress.completed === progress.total) return '✓ Complete';
  return `${progress.completed}/${progress.total} tasks`;
}
