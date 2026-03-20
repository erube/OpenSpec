import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const CLI = path.resolve('bin/openspec.js');

const SAMPLE_TASKS = `## 1. Setup

- [ ] 1.1 Install dependencies
- [ ] 1.2 Configure project

## 2. Core

- [ ] 2.1 Build feature
- [x] 2.2 Write tests
`;

function run(...args: string[]): string {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    cwd: tmpDir,
    env: { ...process.env, NO_COLOR: '1' },
  }).trim();
}

let tmpDir: string;

describe('openspec task commands', () => {
  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `openspec-task-cli-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(path.join(tmpDir, 'openspec', 'changes', 'test-change'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'openspec', 'changes', 'test-change', 'tasks.md'),
      SAMPLE_TASKS,
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('task claim', () => {
    it('should claim the first pending task', () => {
      const output = run('task', 'claim', '--change', 'test-change');
      expect(output).toBe('1.1 Install dependencies');
    });

    it('should claim different tasks on sequential calls', () => {
      const first = run('task', 'claim', '--change', 'test-change');
      const second = run('task', 'claim', '--change', 'test-change');
      expect(first).toContain('1.1');
      expect(second).toContain('1.2');
    });

    it('should output JSON when requested', () => {
      const output = run('task', 'claim', '--change', 'test-change', '--json');
      const parsed = JSON.parse(output);
      expect(parsed.taskId).toBe('1.1');
      expect(parsed.title).toBe('Install dependencies');
      expect(parsed.section).toBe('Setup');
    });

    it('should report no pending tasks when all claimed or done', () => {
      // Claim all 3 pending tasks (2.2 is already done)
      run('task', 'claim', '--change', 'test-change');
      run('task', 'claim', '--change', 'test-change');
      run('task', 'claim', '--change', 'test-change');
      const output = run('task', 'claim', '--change', 'test-change');
      expect(output).toContain('No pending tasks');
    });
  });

  describe('task done', () => {
    it('should mark a task as done and show progress', () => {
      const output = run('task', 'done', '1.1', '--change', 'test-change');
      expect(output).toContain('1.1 done');
      expect(output).toMatch(/\d+\/\d+ complete/);
    });

    it('should update tasks.md checkbox', async () => {
      run('task', 'done', '1.1', '--change', 'test-change');
      const content = await fs.readFile(
        path.join(tmpDir, 'openspec', 'changes', 'test-change', 'tasks.md'),
        'utf-8',
      );
      expect(content).toContain('- [x] 1.1 Install dependencies');
    });

    it('should report already-done tasks', () => {
      const output = run('task', 'done', '2.2', '--change', 'test-change');
      expect(output).toContain('already done');
    });
  });

  describe('task list', () => {
    it('should list all tasks grouped by section', () => {
      const output = run('task', 'list', '--change', 'test-change');
      expect(output).toContain('Setup');
      expect(output).toContain('Core');
      expect(output).toContain('1.1');
      expect(output).toContain('2.2');
    });

    it('should filter by status', () => {
      const output = run('task', 'list', '--change', 'test-change', '--status', 'done');
      expect(output).toContain('2.2');
      expect(output).not.toContain('1.1');
    });

    it('should output JSON', () => {
      const output = run('task', 'list', '--change', 'test-change', '--json');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(4);
    });
  });

  describe('task progress', () => {
    it('should show progress summary', () => {
      const output = run('task', 'progress', '--change', 'test-change');
      expect(output).toContain('1/4 done');
      expect(output).toContain('3 pending');
    });

    it('should output JSON', () => {
      const output = run('task', 'progress', '--change', 'test-change', '--json');
      const parsed = JSON.parse(output);
      expect(parsed.done).toBe(1);
      expect(parsed.pending).toBe(3);
      expect(parsed.total).toBe(4);
    });
  });

  describe('task release', () => {
    it('should release a claimed task', () => {
      run('task', 'claim', '--change', 'test-change');
      const output = run('task', 'release', '1.1', '--change', 'test-change');
      expect(output).toContain('released');
    });

    it('should report non-in-progress tasks', () => {
      const output = run('task', 'release', '1.1', '--change', 'test-change');
      expect(output).toContain('not in-progress');
    });
  });
});
