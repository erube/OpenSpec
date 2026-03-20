## Context

OpenSpec's task management currently stores tasks in a per-project SQLite database at `openspec/.openspec.db`. This works well for single-project workflows but provides no visibility across projects. Users working on multiple projects simultaneously (common with AI-assisted development using parallel agents) have no unified view of task progress.

The existing infrastructure includes:
- `src/core/task-storage/` — database connection, migrations, queries, sync
- `src/core/global-config.ts` — XDG-compliant global config dir at `~/.config/openspec/`
- `src/core/project-config.ts` — per-project config via `openspec/config.yaml` with Zod validation
- `src/commands/task.ts` — CLI commands that currently assume SQLite is always available

## Goals / Non-Goals

**Goals:**
- Enable cross-project task visibility through a single global database
- Let users choose between markdown-only and SQLite-powered task management per project
- Maintain backward compatibility — existing markdown-only workflows continue unchanged
- Reuse existing `getGlobalConfigDir()` for database path resolution

**Non-Goals:**
- Dashboard UI (CLI or web) — this change provides the database infrastructure only
- Task synchronization between markdown and SQLite (markdown writeback on `done` is sufficient)
- Multi-user or networked task sharing
- Migration of existing per-project databases to the global database

## Decisions

### Decision 1: Database location — global config directory

**Choice**: Store the database at `path.join(getGlobalConfigDir(), 'tasks.db')` → `~/.config/openspec/tasks.db`

**Why**: The `getGlobalConfigDir()` function already handles XDG compliance and cross-platform resolution (Windows `%APPDATA%`, macOS/Linux `~/.config`). Reusing it avoids duplicating path logic and keeps all OpenSpec user data in one location.

**Alternative considered**: `~/.openspec/tasks.db` — simpler but creates a new dot-directory, diverging from the existing XDG pattern. Would require new path resolution logic.

### Decision 2: Project identity — basename with override

**Choice**: Default `project_id` is `path.basename(projectRoot)`. Users can override via `projectId` in `openspec/config.yaml`.

**Why**: Directory basename is intuitive and immediately human-readable in dashboard queries. Override handles edge cases (renamed directories, multiple checkouts of the same repo).

**Mechanism**: A new `resolveProjectId(projectRoot)` function in `src/core/task-storage/project-identity.ts`:
1. Read `openspec/config.yaml` for `projectId` field
2. If present and non-empty, use it
3. Otherwise, use `path.basename(projectRoot)`

### Decision 3: Dual storage mode via config

**Choice**: New `taskStorage` field in `openspec/config.yaml` with values `"markdown"` (default) or `"sqlite"`.

**Why**: SQLite adds a native dependency (`better-sqlite3`) and operational complexity. Projects that don't need concurrent agents or cross-project monitoring should not pay this cost. Making markdown the default preserves the simple, git-friendly workflow.

**Code path branching**: The `task` command handler checks config before routing:

```
task command received
  → readProjectConfig(projectRoot)
  → if taskStorage === "sqlite"
      → openDatabase() using global path
      → execute via SQLite queries
  → else (default: "markdown")
      → execute via direct tasks.md file operations
```

### Decision 4: Schema migration for project_id

**Choice**: New migration (version 2) adds `project_id` column. Since SQLite cannot alter primary keys, the migration recreates the table.

**Migration strategy**:
1. Create new table `tasks_v2` with `(project_id, change_name, task_id)` primary key
2. Copy existing rows with `project_id = 'unknown'`
3. Drop old `tasks` table
4. Rename `tasks_v2` to `tasks`

This handles the case where a user has an existing per-project database that gets migrated to the global location.

### Decision 5: openDatabase() signature change

**Choice**: `openDatabase()` drops the `projectRoot` parameter and always opens the global database path. A separate `resolveProjectId()` function provides the project context to queries.

**Why**: Separating "where is the DB" from "which project am I" makes the API cleaner. All queries that need project scoping receive `projectId` as a parameter (already the pattern for `changeName`).

## Risks / Trade-offs

**[Risk] Existing per-project databases become orphaned** → Users with existing `openspec/.openspec.db` files won't see those tasks in the global DB. Mitigation: document in release notes; no automatic migration (tasks can be re-synced from `tasks.md`).

**[Risk] Directory basename collision** → Two projects named "api" in different parent directories would share a `project_id`. → Mitigation: `projectId` override in config. Collision is detectable at query time if unexpected tasks appear.

**[Risk] Global database file permissions** → On shared machines, `~/.config/openspec/tasks.db` could be readable by other users. → Mitigation: inherits user's umask. Not a concern for single-user machines (primary use case).

**[Trade-off] Markdown mode has no atomic claiming** → When `taskStorage: "markdown"`, concurrent agents can't safely claim tasks. This is acceptable — users who need concurrency opt into `"sqlite"` mode.

**[Trade-off] Global DB is always created when sqlite mode is used** → Even for a single project, the DB lives in `~/.config/` rather than the project. This keeps the architecture simple at the cost of discoverability — the database isn't visible in the project tree.
