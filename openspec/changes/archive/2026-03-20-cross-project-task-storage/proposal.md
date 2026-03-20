## Why

Task management currently uses a per-project SQLite database at `openspec/.openspec.db`. When working across multiple projects simultaneously in separate terminals, there is no way to monitor overall progress or get a unified view of active tasks. A global database enables cross-project visibility and lays the groundwork for dashboards and monitoring tools.

Additionally, the current system always requires SQLite — users should be able to choose between simple markdown-only task tracking and the full SQLite-powered task management with concurrency support.

## What Changes

- Move task database from per-project `openspec/.openspec.db` to global `~/.config/openspec/tasks.db`
- Add `project_id` column to the tasks table to distinguish tasks across projects
- Add `taskStorage` setting to `openspec/config.yaml` allowing users to choose `"markdown"` (default) or `"sqlite"` mode
- Add `projectId` setting to `openspec/config.yaml` to override the auto-detected project name (defaults to directory basename)
- When `taskStorage: "markdown"`, task commands operate directly on `tasks.md` checkboxes — no database involved
- When `taskStorage: "sqlite"`, the global database is the source of truth with writeback to `tasks.md` for human readability
- **BREAKING**: Database location changes from `openspec/.openspec.db` to `~/.config/openspec/tasks.db`

## Capabilities

### New Capabilities
- `project-identity`: Resolve project identity from directory basename with optional override via `projectId` in `openspec/config.yaml`

### Modified Capabilities
- `task-storage`: Database moves to global path, schema adds `project_id` column, all queries require project context
- `task-cli`: Commands check `taskStorage` config to decide markdown vs sqlite code path
- `config-loading`: Add `taskStorage` and `projectId` fields to project config schema

## Impact

- `src/core/task-storage/database.ts` — path resolution changes from project-local to global
- `src/core/task-storage/migrations.ts` — new migration adds `project_id` column and recreates primary key
- `src/core/task-storage/queries.ts` — all queries gain `project_id` parameter
- `src/commands/task.ts` — branch on `taskStorage` config before choosing execution path
- `src/core/config-loading.ts` — extend Zod schema with new fields
- `openspec/config.yaml` — new optional fields: `taskStorage`, `projectId`
- `.gitignore` — remove `openspec/.openspec.db` entry, no longer project-local
- `better-sqlite3` dependency remains unchanged
