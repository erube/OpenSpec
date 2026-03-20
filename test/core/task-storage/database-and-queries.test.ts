import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { openDatabase, closeDatabase } from '../../../src/core/task-storage/database.js';
import {
  claimNextTask,
  markTaskDone,
  releaseTask,
  listTasks,
  getTaskProgress,
  getTask,
  hasTasksForChange,
  insertTask,
  getChangesWithTasks,
} from '../../../src/core/task-storage/queries.js';

describe('task-storage', () => {
  let tempDir: string;
  let originalXdg: string | undefined;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-task-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tempDir;
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

  const PROJECT_ID = 'test-project';

  describe('openDatabase', () => {
    it('should create database file and run migrations', () => {
      const db = openDatabase();
      expect(db).toBeDefined();

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('migrations');
    });

    it('should enable WAL mode', () => {
      const db = openDatabase();
      const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(result[0].journal_mode).toBe('wal');
    });

    it('should return same instance on repeated calls', () => {
      const db1 = openDatabase();
      const db2 = openDatabase();
      expect(db1).toBe(db2);
    });

    it('should create database in global config directory', () => {
      openDatabase();
      const dbPath = path.join(tempDir, 'openspec', 'tasks.db');
      // File should exist
      expect(() => require('fs').statSync(dbPath)).not.toThrow();
    });
  });

  describe('migrations', () => {
    it('should record applied migrations', () => {
      const db = openDatabase();
      const migrations = db.prepare('SELECT * FROM migrations').all() as Array<{ version: number; description: string }>;
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations.some((m) => m.version === 2)).toBe(true);
    });

    it('should be idempotent on re-open', () => {
      openDatabase();
      closeDatabase();
      const db = openDatabase();
      const migrations = db.prepare('SELECT * FROM migrations').all();
      expect(migrations).toHaveLength(2);
    });

    it('should have project_id column in tasks table', () => {
      const db = openDatabase();
      const columns = db.prepare("PRAGMA table_info('tasks')").all() as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain('project_id');
    });
  });

  describe('queries', () => {
    function seedTasks() {
      const db = openDatabase();
      insertTask(db, PROJECT_ID, 'my-change', '1.1', 'Setup', 'Install deps', 'pending');
      insertTask(db, PROJECT_ID, 'my-change', '1.2', 'Setup', 'Configure project', 'pending');
      insertTask(db, PROJECT_ID, 'my-change', '2.1', 'Core', 'Build feature', 'pending');
      return db;
    }

    describe('insertTask & listTasks', () => {
      it('should insert and list tasks', () => {
        const db = seedTasks();
        const tasks = listTasks(db, PROJECT_ID, 'my-change');
        expect(tasks).toHaveLength(3);
        expect(tasks[0].task_id).toBe('1.1');
        expect(tasks[0].section).toBe('Setup');
        expect(tasks[0].project_id).toBe(PROJECT_ID);
      });

      it('should filter by status', () => {
        const db = seedTasks();
        markTaskDone(db, PROJECT_ID, 'my-change', '1.1');
        const pending = listTasks(db, PROJECT_ID, 'my-change', 'pending');
        expect(pending).toHaveLength(2);
        const done = listTasks(db, PROJECT_ID, 'my-change', 'done');
        expect(done).toHaveLength(1);
      });
    });

    describe('claimNextTask', () => {
      it('should claim the first pending task', () => {
        const db = seedTasks();
        const claimed = claimNextTask(db, PROJECT_ID, 'my-change');
        expect(claimed).not.toBeNull();
        expect(claimed!.task_id).toBe('1.1');
        expect(claimed!.status).toBe('in-progress');
      });

      it('should claim different tasks on sequential calls', () => {
        const db = seedTasks();
        const first = claimNextTask(db, PROJECT_ID, 'my-change');
        const second = claimNextTask(db, PROJECT_ID, 'my-change');
        expect(first!.task_id).toBe('1.1');
        expect(second!.task_id).toBe('1.2');
      });

      it('should return null when no pending tasks', () => {
        const db = seedTasks();
        claimNextTask(db, PROJECT_ID, 'my-change');
        claimNextTask(db, PROJECT_ID, 'my-change');
        claimNextTask(db, PROJECT_ID, 'my-change');
        const result = claimNextTask(db, PROJECT_ID, 'my-change');
        expect(result).toBeNull();
      });
    });

    describe('markTaskDone', () => {
      it('should mark a task as done', () => {
        const db = seedTasks();
        const result = markTaskDone(db, PROJECT_ID, 'my-change', '1.1');
        expect(result).not.toBeNull();
        expect(result!.status).toBe('done');
      });

      it('should return null for non-existent task', () => {
        const db = seedTasks();
        const result = markTaskDone(db, PROJECT_ID, 'my-change', '99.1');
        expect(result).toBeNull();
      });
    });

    describe('releaseTask', () => {
      it('should release an in-progress task back to pending', () => {
        const db = seedTasks();
        claimNextTask(db, PROJECT_ID, 'my-change');
        const released = releaseTask(db, PROJECT_ID, 'my-change', '1.1');
        expect(released).not.toBeNull();
        expect(released!.status).toBe('pending');
      });

      it('should return null if task is not in-progress', () => {
        const db = seedTasks();
        const result = releaseTask(db, PROJECT_ID, 'my-change', '1.1');
        expect(result).toBeNull();
      });
    });

    describe('getTaskProgress', () => {
      it('should return correct counts by status', () => {
        const db = seedTasks();
        markTaskDone(db, PROJECT_ID, 'my-change', '1.1');
        claimNextTask(db, PROJECT_ID, 'my-change');

        const progress = getTaskProgress(db, PROJECT_ID, 'my-change');
        expect(progress).toEqual({
          done: 1,
          inProgress: 1,
          pending: 1,
          total: 3,
        });
      });
    });

    describe('getTask', () => {
      it('should return a specific task', () => {
        const db = seedTasks();
        const task = getTask(db, PROJECT_ID, 'my-change', '2.1');
        expect(task).not.toBeNull();
        expect(task!.title).toBe('Build feature');
      });

      it('should return null for non-existent task', () => {
        const db = seedTasks();
        expect(getTask(db, PROJECT_ID, 'my-change', '99.1')).toBeNull();
      });
    });

    describe('hasTasksForChange', () => {
      it('should return true when tasks exist', () => {
        const db = seedTasks();
        expect(hasTasksForChange(db, PROJECT_ID, 'my-change')).toBe(true);
      });

      it('should return false when no tasks exist', () => {
        const db = openDatabase();
        expect(hasTasksForChange(db, PROJECT_ID, 'nonexistent')).toBe(false);
      });
    });

    describe('getChangesWithTasks', () => {
      it('should return distinct project/change pairs', () => {
        const db = seedTasks();
        insertTask(db, PROJECT_ID, 'other-change', '1.1', 'Setup', 'Task', 'pending');
        const changes = getChangesWithTasks(db, PROJECT_ID);
        expect(changes).toEqual([
          { project_id: PROJECT_ID, change_name: 'my-change' },
          { project_id: PROJECT_ID, change_name: 'other-change' },
        ]);
      });

      it('should return all projects when no projectId filter', () => {
        const db = seedTasks();
        insertTask(db, 'other-project', 'some-change', '1.1', 'Setup', 'Task', 'pending');
        const changes = getChangesWithTasks(db);
        expect(changes).toHaveLength(2);
        expect(changes.map((c) => c.project_id)).toContain('other-project');
        expect(changes.map((c) => c.project_id)).toContain(PROJECT_ID);
      });

      it('should isolate tasks between projects', () => {
        const db = seedTasks();
        insertTask(db, 'other-project', 'my-change', '1.1', 'Setup', 'Other task', 'pending');

        const projectTasks = listTasks(db, PROJECT_ID, 'my-change');
        const otherTasks = listTasks(db, 'other-project', 'my-change');

        expect(projectTasks).toHaveLength(3);
        expect(otherTasks).toHaveLength(1);
        expect(otherTasks[0].title).toBe('Other task');
      });
    });
  });
});
