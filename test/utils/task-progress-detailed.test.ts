import { describe, it, expect } from 'vitest';
import { parseTasksDetailed } from '../../src/utils/task-progress.js';

describe('parseTasksDetailed', () => {
  it('should parse tasks with dotted IDs and sections', () => {
    const content = `## 1. Setup

- [ ] 1.1 Install dependencies
- [ ] 1.2 Configure project

## 2. Implementation

- [ ] 2.1 Build the thing
- [x] 2.2 Write tests
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks).toHaveLength(4);
    expect(tasks[0]).toEqual({
      taskId: '1.1',
      section: 'Setup',
      title: 'Install dependencies',
      done: false,
      lineNumber: 3,
    });
    expect(tasks[1]).toEqual({
      taskId: '1.2',
      section: 'Setup',
      title: 'Configure project',
      done: false,
      lineNumber: 4,
    });
    expect(tasks[2]).toEqual({
      taskId: '2.1',
      section: 'Implementation',
      title: 'Build the thing',
      done: false,
      lineNumber: 8,
    });
    expect(tasks[3]).toEqual({
      taskId: '2.2',
      section: 'Implementation',
      title: 'Write tests',
      done: true,
      lineNumber: 9,
    });
  });

  it('should handle mixed done/pending states', () => {
    const content = `## 1. Tasks

- [x] 1.1 First done
- [ ] 1.2 Second pending
- [x] 1.3 Third done
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks[0].done).toBe(true);
    expect(tasks[1].done).toBe(false);
    expect(tasks[2].done).toBe(true);
  });

  it('should return empty array for content with no tasks', () => {
    const content = `# Just a heading

Some text but no tasks.
`;
    expect(parseTasksDetailed(content)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseTasksDetailed('')).toEqual([]);
  });

  it('should handle tasks with backticks and special characters in titles', () => {
    const content = `## 1. Setup

- [ ] 1.1 Add \`better-sqlite3\` and \`@types/better-sqlite3\` to project dependencies via pnpm
- [ ] 1.2 Add \`openspec/.openspec.db\` to \`.gitignore\`
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Add `better-sqlite3` and `@types/better-sqlite3` to project dependencies via pnpm');
  });

  it('should handle sections with varying numbering', () => {
    const content = `## 3. Late Section

- [ ] 3.1 Task in section three
- [ ] 3.2 Another task

## 10. High Number

- [ ] 10.1 High numbered task
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].section).toBe('Late Section');
    expect(tasks[2].section).toBe('High Number');
    expect(tasks[2].taskId).toBe('10.1');
  });

  it('should handle tasks before any section header', () => {
    const content = `- [ ] 1.1 Orphan task without section
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].section).toBe('');
  });

  it('should preserve correct line numbers with blank lines', () => {
    const content = `## 1. Setup

- [ ] 1.1 First task

- [ ] 1.2 Second task after blank line
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks[0].lineNumber).toBe(3);
    expect(tasks[1].lineNumber).toBe(5);
  });

  it('should handle asterisk bullet markers', () => {
    const content = `## 1. Setup

* [ ] 1.1 Asterisk task
* [x] 1.2 Done asterisk task
`;
    const tasks = parseTasksDetailed(content);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].taskId).toBe('1.1');
    expect(tasks[1].done).toBe(true);
  });
});
