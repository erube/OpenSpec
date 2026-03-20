## 1. Setup & Dependencies

- [x] 1.1 Add `better-sqlite3` and `@types/better-sqlite3` to project dependencies via pnpm
- [x] 1.2 Add `openspec/.openspec.db` to `.gitignore`
- [x] 1.3 Create `src/core/task-storage/` module directory with `index.ts` barrel export

## 2. Parser Extension

- [x] 2.1 Extend `src/utils/task-progress.ts` with `parseTasksDetailed()` — extract dotted ID, section name, title, and checkbox state per task
- [x] 2.2 Add regex for section headers (`## N. Section Name`) and dotted task IDs (`X.Y`)
- [x] 2.3 Unit tests for detailed parser: sections, dotted IDs, mixed `[x]`/`[ ]` states, edge cases

## 3. Database Layer

- [x] 3.1 Implement database connection manager (`src/core/task-storage/database.ts`) — open/create DB at `path.join(projectRoot, 'openspec', '.openspec.db')`, enable WAL mode
- [x] 3.2 Implement migration system (`src/core/task-storage/migrations.ts`) — versioned migrations with `migrations` tracking table, transaction-wrapped execution
- [x] 3.3 Create initial migration: `tasks` table with composite PK (`change_name`, `task_id`), `section`, `title`, `status`, `updated_at`
- [x] 3.4 Implement task queries module (`src/core/task-storage/queries.ts`) — atomic claim (UPDATE...RETURNING), mark done, list by status, progress counts
- [x] 3.5 Unit tests for database init, migrations, and all query functions

## 4. Sync & Writeback

- [x] 4.1 Implement initial sync (`src/core/task-storage/sync.ts`) — parse `tasks.md` via extended parser, populate SQLite, triggered when DB has no tasks for a change
- [x] 4.2 Implement markdown writeback — on `task done`, locate line by dotted ID in `tasks.md` and flip `[ ]` to `[x]`
- [x] 4.3 Unit tests for sync (initial population, reconstruction after DB delete) and writeback (checkbox update, missing file handling)

## 5. CLI Commands

- [x] 5.1 Register `openspec task` command group in Commander.js (`src/commands/task.ts`)
- [x] 5.2 Implement `openspec task claim --change <name> [--json]` — auto-sync if needed, atomic claim, compact output
- [x] 5.3 Implement `openspec task done <id> --change <name>` — update DB + writeback to markdown, show progress
- [x] 5.4 Implement `openspec task list --change <name> [--status <s>] [--json]` — auto-sync if needed, compact grouped output
- [x] 5.5 Implement `openspec task progress --change <name> [--all] [--json]` — single-line summary
- [x] 5.6 Implement `openspec task release <id> --change <name>` — unclaim stuck task
- [x] 5.7 Integration tests for all CLI commands

## 6. Cross-Platform Verification

- [x] 6.1 Verify all file paths use `path.join()` — no hardcoded separators in source or tests
- [x] 6.2 Test database creation and access on Windows-style paths (CI or manual)
