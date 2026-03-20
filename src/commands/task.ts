import { Command } from 'commander';
import ora from 'ora';
import { readProjectConfig } from '../core/project-config.js';
import {
  openDatabase,
  closeDatabase,
  claimNextTask,
  markTaskDone,
  releaseTask,
  listTasks,
  getTaskProgress,
  getTask,
  getChangesWithTasks,
  syncTasksFromMarkdown,
  writebackTaskDone,
  hasTasksForChange,
  resolveProjectId,
  listTasksMarkdown,
  markTaskDoneMarkdown,
  getTaskProgressMarkdown,
} from '../core/task-storage/index.js';

function getStorageMode(): 'markdown' | 'sqlite' {
  const config = readProjectConfig(process.cwd());
  return config?.taskStorage ?? 'markdown';
}

function ensureSync(projectId: string, changeName: string): void {
  const projectRoot = process.cwd();
  const db = openDatabase();
  if (!hasTasksForChange(db, projectId, changeName)) {
    syncTasksFromMarkdown(db, projectId, projectRoot, changeName);
  }
}

export function registerTaskCommand(program: Command): void {
  const taskCmd = program
    .command('task')
    .description('Manage change implementation tasks');

  taskCmd
    .command('claim')
    .description('Atomically claim the next pending task')
    .requiredOption('--change <name>', 'Change name')
    .option('--json', 'Output as JSON')
    .action(async (options: { change: string; json?: boolean }) => {
      try {
        const mode = getStorageMode();
        if (mode === 'markdown') {
          ora().fail('Task claiming requires taskStorage: sqlite in openspec/config.yaml');
          process.exit(1);
        }

        const projectRoot = process.cwd();
        const projectId = resolveProjectId(projectRoot);
        ensureSync(projectId, options.change);
        const db = openDatabase();
        const task = claimNextTask(db, projectId, options.change);

        if (!task) {
          if (options.json) {
            console.log(JSON.stringify({ claimed: null, message: `No pending tasks for change '${options.change}'` }));
          } else {
            console.log(`No pending tasks for change '${options.change}'`);
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify({ taskId: task.task_id, title: task.title, section: task.section, projectId }));
        } else {
          console.log(`${task.task_id} ${task.title}`);
        }
      } catch (error) {
        ora().fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        closeDatabase();
      }
    });

  taskCmd
    .command('done <taskId>')
    .description('Mark a task as done')
    .requiredOption('--change <name>', 'Change name')
    .action(async (taskId: string, options: { change: string }) => {
      try {
        const mode = getStorageMode();
        const projectRoot = process.cwd();

        if (mode === 'markdown') {
          const result = await markTaskDoneMarkdown(projectRoot, options.change, taskId);
          if (!result.found) {
            ora().fail(`Task ${taskId} not found in change '${options.change}'`);
            process.exit(1);
          }
          if (result.alreadyDone) {
            console.log(`Task ${taskId} is already done`);
            return;
          }
          console.log(`✓ ${taskId} done (${result.progress.done}/${result.progress.total} complete)`);
          return;
        }

        const projectId = resolveProjectId(projectRoot);
        ensureSync(projectId, options.change);
        const db = openDatabase();

        const existing = getTask(db, projectId, options.change, taskId);
        if (!existing) {
          ora().fail(`Task ${taskId} not found in change '${options.change}'`);
          process.exit(1);
        }

        if (existing.status === 'done') {
          console.log(`Task ${taskId} is already done`);
          return;
        }

        markTaskDone(db, projectId, options.change, taskId);
        await writebackTaskDone(projectRoot, options.change, taskId);

        const progress = getTaskProgress(db, projectId, options.change);
        console.log(`✓ ${taskId} done (${progress.done}/${progress.total} complete)`);
      } catch (error) {
        ora().fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        closeDatabase();
      }
    });

  taskCmd
    .command('list')
    .description('List tasks for a change')
    .requiredOption('--change <name>', 'Change name')
    .option('--status <status>', 'Filter by status (pending, in-progress, done)')
    .option('--json', 'Output as JSON')
    .action(async (options: { change: string; status?: string; json?: boolean }) => {
      try {
        const mode = getStorageMode();
        const projectRoot = process.cwd();

        let tasks;
        if (mode === 'markdown') {
          tasks = await listTasksMarkdown(projectRoot, options.change, options.status);
        } else {
          const projectId = resolveProjectId(projectRoot);
          ensureSync(projectId, options.change);
          const db = openDatabase();
          tasks = listTasks(db, projectId, options.change, options.status);
        }

        if (options.json) {
          console.log(JSON.stringify(tasks.map((t) => ({
            taskId: t.task_id,
            section: t.section,
            title: t.title,
            status: t.status,
          }))));
          return;
        }

        if (tasks.length === 0) {
          console.log(`No tasks found for change '${options.change}'${options.status ? ` with status '${options.status}'` : ''}`);
          return;
        }

        let currentSection = '';
        for (const task of tasks) {
          if (task.section !== currentSection) {
            currentSection = task.section;
            if (currentSection) console.log(`\n${currentSection}`);
          }
          const indicator = task.status === 'done' ? 'x' : task.status === 'in-progress' ? '>' : ' ';
          console.log(`  [${indicator}] ${task.task_id} ${task.title}`);
        }
      } catch (error) {
        ora().fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        closeDatabase();
      }
    });

  taskCmd
    .command('progress')
    .description('Show task progress summary')
    .option('--change <name>', 'Change name')
    .option('--all', 'Show progress for all changes')
    .option('--global', 'Show progress across all projects (sqlite only)')
    .option('--json', 'Output as JSON')
    .action(async (options: { change?: string; all?: boolean; global?: boolean; json?: boolean }) => {
      try {
        const mode = getStorageMode();
        const projectRoot = process.cwd();

        if (mode === 'markdown') {
          if (!options.change) {
            ora().fail('Specify --change <name> (--all requires taskStorage: sqlite)');
            process.exit(1);
          }
          const progress = await getTaskProgressMarkdown(projectRoot, options.change);
          if (options.json) {
            console.log(JSON.stringify(progress));
          } else {
            console.log(`${progress.done}/${progress.total} done, ${progress.inProgress} in-progress, ${progress.pending} pending`);
          }
          return;
        }

        const projectId = resolveProjectId(projectRoot);
        const db = openDatabase();

        if (options.all || options.global) {
          const changes = options.global
            ? getChangesWithTasks(db)
            : getChangesWithTasks(db, projectId);

          if (changes.length === 0) {
            console.log('No tasks tracked in database');
            return;
          }

          if (options.json) {
            const result: Record<string, any> = {};
            for (const entry of changes) {
              const key = options.global ? `${entry.project_id}/${entry.change_name}` : entry.change_name;
              result[key] = getTaskProgress(db, entry.project_id, entry.change_name);
            }
            console.log(JSON.stringify(result));
            return;
          }

          for (const entry of changes) {
            const p = getTaskProgress(db, entry.project_id, entry.change_name);
            const prefix = options.global ? `${entry.project_id}/${entry.change_name}` : entry.change_name;
            console.log(`${prefix}: ${p.done}/${p.total} done, ${p.inProgress} in-progress, ${p.pending} pending`);
          }
          return;
        }

        if (!options.change) {
          ora().fail('Specify --change <name> or --all');
          process.exit(1);
        }

        ensureSync(projectId, options.change);
        const progress = getTaskProgress(db, projectId, options.change);

        if (options.json) {
          console.log(JSON.stringify(progress));
          return;
        }

        console.log(`${progress.done}/${progress.total} done, ${progress.inProgress} in-progress, ${progress.pending} pending`);
      } catch (error) {
        ora().fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        closeDatabase();
      }
    });

  taskCmd
    .command('release <taskId>')
    .description('Release a claimed task back to pending')
    .requiredOption('--change <name>', 'Change name')
    .action(async (taskId: string, options: { change: string }) => {
      try {
        const mode = getStorageMode();
        if (mode === 'markdown') {
          ora().fail('Task release requires taskStorage: sqlite in openspec/config.yaml');
          process.exit(1);
        }

        const projectRoot = process.cwd();
        const projectId = resolveProjectId(projectRoot);
        ensureSync(projectId, options.change);
        const db = openDatabase();

        const existing = getTask(db, projectId, options.change, taskId);
        if (!existing) {
          ora().fail(`Task ${taskId} not found in change '${options.change}'`);
          process.exit(1);
        }

        if (existing.status !== 'in-progress') {
          console.log(`Task ${taskId} is not in-progress`);
          return;
        }

        releaseTask(db, projectId, options.change, taskId);
        console.log(`Task ${taskId} released back to pending`);
      } catch (error) {
        ora().fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      } finally {
        closeDatabase();
      }
    });
}
