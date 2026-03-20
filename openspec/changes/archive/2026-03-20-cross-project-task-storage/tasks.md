## 1. Config Schema Extension

- [x] 1.1 Add `taskStorage` field (enum: "markdown" | "sqlite") to ProjectConfigSchema in `src/core/project-config.ts`
- [x] 1.2 Add `projectId` field (optional non-empty string) to ProjectConfigSchema in `src/core/project-config.ts`
- [x] 1.3 Add resilient field-by-field parsing for `taskStorage` and `projectId` in `readProjectConfig()`
- [x] 1.4 Write unit tests for new config fields (valid, invalid, missing)

## 2. Project Identity

- [x] 2.1 Create `src/core/task-storage/project-identity.ts` with `resolveProjectId(projectRoot)` function
- [x] 2.2 Implement basename default with config override logic
- [x] 2.3 Write unit tests for project identity resolution (basename, override, empty override, no config, Windows paths)

## 3. Database Path Migration

- [x] 3.1 Update `openDatabase()` in `database.ts` to use `getGlobalConfigDir()` instead of project-local path
- [x] 3.2 Remove `projectRoot` parameter from `openDatabase()` — resolve global path internally
- [x] 3.3 Create global config directory with `mkdirSync({ recursive: true })` if it does not exist
- [x] 3.4 Update `.gitignore` to remove `openspec/.openspec.db` entry

## 4. Schema Migration v2

- [x] 4.1 Add migration v2 in `migrations.ts` that recreates `tasks` table with `project_id` column and new primary key `(project_id, change_name, task_id)`
- [x] 4.2 Migration copies existing rows with `project_id = 'unknown'`
- [x] 4.3 Add index on `(project_id, change_name, status)` for query performance
- [x] 4.4 Write tests for migration from v1 to v2 (fresh DB and existing data)

## 5. Query Layer Updates

- [x] 5.1 Add `projectId` parameter to `claimNextTask`, `markTaskDone`, `releaseTask`, `listTasks`, `getTaskProgress`, `getTask`, `hasTasksForChange`, `insertTask`
- [x] 5.2 Update all SQL queries to include `project_id` in WHERE clauses
- [x] 5.3 Update `getChangesWithTasks()` to support optional `projectId` filter and return `project_id` in results
- [x] 5.4 Update `TaskRecord` interface to include `project_id` field
- [x] 5.5 Write unit tests for project-scoped queries (isolation between projects, cross-project listing)

## 6. Sync Layer Updates

- [x] 6.1 Update `syncTasksFromMarkdown()` to accept and pass `projectId` to `insertTask()`
- [x] 6.2 Update `writebackTaskDone()` — no changes needed (operates on file path, not project_id)
- [x] 6.3 Write tests verifying sync inserts tasks with correct `project_id`

## 7. Storage Mode Routing

- [x] 7.1 Create markdown-mode task operations: `listTasksMarkdown()`, `markTaskDoneMarkdown()`, `getTaskProgressMarkdown()` in a new `src/core/task-storage/markdown-ops.ts`
- [x] 7.2 Update `src/commands/task.ts` to read `taskStorage` from config and branch execution path
- [x] 7.3 In sqlite path: call `openDatabase()`, `resolveProjectId()`, then existing query functions
- [x] 7.4 In markdown path: call markdown-ops functions directly on `tasks.md`
- [x] 7.5 Return clear error for `claim` and `release` commands in markdown mode
- [x] 7.6 Write integration tests for both storage mode paths

## 8. Module Exports and Cleanup

- [x] 8.1 Export `resolveProjectId` from `src/core/task-storage/index.ts`
- [x] 8.2 Update all callers of `openDatabase(projectRoot)` to use new parameterless signature
- [x] 8.3 Update all callers of query functions to pass `projectId`

## 9. Cross-Platform Verification

- [x] 9.1 Verify `path.basename()` handles Windows and Unix paths correctly in project identity tests
- [x] 9.2 Verify global config directory creation works with `path.join()` across platforms
- [x] 9.3 Ensure test expected paths use `path.join()` not hardcoded separators
