export { openDatabase, closeDatabase } from './database.js';
export { runMigrations } from './migrations.js';
export {
  claimNextTask,
  markTaskDone,
  releaseTask,
  listTasks,
  getTaskProgress,
  getTask,
  hasTasksForChange,
  insertTask,
  getChangesWithTasks,
  type TaskRecord,
  type TaskProgressSummary,
} from './queries.js';
export { syncTasksFromMarkdown, writebackTaskDone } from './sync.js';
export { resolveProjectId } from './project-identity.js';
export {
  listTasksMarkdown,
  markTaskDoneMarkdown,
  getTaskProgressMarkdown,
} from './markdown-ops.js';
