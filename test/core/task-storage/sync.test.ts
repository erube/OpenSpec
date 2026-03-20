import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { openDatabase, closeDatabase } from '../../../src/core/task-storage/database.js';
import { syncTasksFromMarkdown, writebackTaskDone } from '../../../src/core/task-storage/sync.js';
import { listTasks } from '../../../src/core/task-storage/queries.js';

const SAMPLE_TASKS = `## 1. Setup

- [ ] 1.1 Install dependencies
- [x] 1.2 Configure project

## 2. Core

- [ ] 2.1 Build feature
- [ ] 2.2 Write tests
`;

const PROJECT_ID = 'test-project';

describe('sync', () => {
  let tempDir: string;
  let projectDir: string;
  let originalXdg: string | undefined;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    projectDir = path.join(tempDir, 'project');
    await fs.mkdir(path.join(projectDir, 'openspec', 'changes', 'my-change'), { recursive: true });
    // Point global config dir to temp for DB isolation
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = path.join(tempDir, 'config');
  });

  afterEach(async () => {
    closeDatabase();
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('syncTasksFromMarkdown', () => {
    it('should populate database from tasks.md', async () => {
      await fs.writeFile(
        path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md'),
        SAMPLE_TASKS,
      );

      const db = openDatabase();
      const result = syncTasksFromMarkdown(db, PROJECT_ID, projectDir, 'my-change');

      expect(result.synced).toBe(4);

      const tasks = listTasks(db, PROJECT_ID, 'my-change');
      expect(tasks).toHaveLength(4);
      expect(tasks[0].task_id).toBe('1.1');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].project_id).toBe(PROJECT_ID);
      expect(tasks[1].task_id).toBe('1.2');
      expect(tasks[1].status).toBe('done');
    });

    it('should not re-sync if tasks already exist', async () => {
      await fs.writeFile(
        path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md'),
        SAMPLE_TASKS,
      );

      const db = openDatabase();
      syncTasksFromMarkdown(db, PROJECT_ID, projectDir, 'my-change');
      const result = syncTasksFromMarkdown(db, PROJECT_ID, projectDir, 'my-change');

      expect(result.synced).toBe(0);
    });

    it('should handle missing tasks.md gracefully', () => {
      const db = openDatabase();
      const result = syncTasksFromMarkdown(db, PROJECT_ID, projectDir, 'nonexistent');
      expect(result.synced).toBe(0);
    });

    it('should handle empty tasks.md', async () => {
      await fs.writeFile(
        path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md'),
        '# Empty\n',
      );

      const db = openDatabase();
      const result = syncTasksFromMarkdown(db, PROJECT_ID, projectDir, 'my-change');
      expect(result.synced).toBe(0);
    });

    it('should insert tasks with correct project_id', async () => {
      await fs.writeFile(
        path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md'),
        SAMPLE_TASKS,
      );

      const db = openDatabase();
      syncTasksFromMarkdown(db, 'custom-project', projectDir, 'my-change');

      const tasks = listTasks(db, 'custom-project', 'my-change');
      expect(tasks).toHaveLength(4);
      expect(tasks.every((t) => t.project_id === 'custom-project')).toBe(true);

      // Same change name but different project should have no tasks
      const otherTasks = listTasks(db, PROJECT_ID, 'my-change');
      expect(otherTasks).toHaveLength(0);
    });
  });

  describe('writebackTaskDone', () => {
    it('should update checkbox in tasks.md', async () => {
      const tasksPath = path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md');
      await fs.writeFile(tasksPath, SAMPLE_TASKS);

      const result = await writebackTaskDone(projectDir, 'my-change', '1.1');
      expect(result).toBe(true);

      const content = await fs.readFile(tasksPath, 'utf-8');
      expect(content).toContain('- [x] 1.1 Install dependencies');
    });

    it('should not change already-done tasks', async () => {
      const tasksPath = path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md');
      await fs.writeFile(tasksPath, SAMPLE_TASKS);

      // 1.2 is already [x]
      const result = await writebackTaskDone(projectDir, 'my-change', '1.2');
      expect(result).toBe(false);
    });

    it('should return false for missing tasks.md', async () => {
      const result = await writebackTaskDone(projectDir, 'nonexistent', '1.1');
      expect(result).toBe(false);
    });

    it('should return false for non-existent task ID', async () => {
      const tasksPath = path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md');
      await fs.writeFile(tasksPath, SAMPLE_TASKS);

      const result = await writebackTaskDone(projectDir, 'my-change', '99.1');
      expect(result).toBe(false);
    });

    it('should only change the targeted task line', async () => {
      const tasksPath = path.join(projectDir, 'openspec', 'changes', 'my-change', 'tasks.md');
      await fs.writeFile(tasksPath, SAMPLE_TASKS);

      await writebackTaskDone(projectDir, 'my-change', '2.1');

      const content = await fs.readFile(tasksPath, 'utf-8');
      expect(content).toContain('- [x] 2.1 Build feature');
      expect(content).toContain('- [ ] 2.2 Write tests');
    });
  });
});
