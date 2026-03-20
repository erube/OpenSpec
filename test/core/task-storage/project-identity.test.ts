import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import path from 'path';
import os from 'os';
import { resolveProjectId } from '../../../src/core/task-storage/project-identity.js';

describe('resolveProjectId', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-projid-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return directory basename when no config exists', () => {
    const projectRoot = path.join(tempDir, 'my-project');
    fs.mkdirSync(projectRoot, { recursive: true });

    expect(resolveProjectId(projectRoot)).toBe('my-project');
  });

  it('should return directory basename when config has no projectId', () => {
    const projectRoot = path.join(tempDir, 'my-project');
    fs.mkdirSync(path.join(projectRoot, 'openspec'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'openspec', 'config.yaml'),
      'schema: spec-driven\n',
    );

    expect(resolveProjectId(projectRoot)).toBe('my-project');
  });

  it('should return projectId from config when set', () => {
    const projectRoot = path.join(tempDir, 'my-project');
    fs.mkdirSync(path.join(projectRoot, 'openspec'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'openspec', 'config.yaml'),
      'schema: spec-driven\nprojectId: custom-name\n',
    );

    expect(resolveProjectId(projectRoot)).toBe('custom-name');
  });

  it('should fall back to basename when projectId is empty', () => {
    const projectRoot = path.join(tempDir, 'my-project');
    fs.mkdirSync(path.join(projectRoot, 'openspec'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'openspec', 'config.yaml'),
      'schema: spec-driven\nprojectId: ""\n',
    );

    // Empty string fails min(1) validation, so config.projectId is undefined
    expect(resolveProjectId(projectRoot)).toBe('my-project');
  });

  it('should handle paths with platform separators via path.basename()', () => {
    // path.basename handles platform-specific separators
    const projectRoot = path.join(tempDir, 'nested', 'deep', 'my-app');
    fs.mkdirSync(projectRoot, { recursive: true });

    expect(resolveProjectId(projectRoot)).toBe('my-app');
  });
});
