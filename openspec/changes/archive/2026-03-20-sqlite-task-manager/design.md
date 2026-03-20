## Context

OpenSpec tracks change implementation through `tasks.md` files — flat markdown with checkbox-style task lists. AI agents interact with these via Read and Edit tool calls, costing ~2400 tokens per read+edit cycle. An existing parser at `src/utils/task-progress.ts` already counts tasks and checkboxes but doesn't expose per-task data or CLI access.

The critical problem is concurrency. When multiple subagents work in parallel on the same change, `tasks.md` has no locking mechanism. Two agents can claim the same task, and concurrent file writes can silently clobber each other.

The codebase follows a clean separation: `src/commands/` for CLI entry points, `src/core/` for business logic, `src/utils/` for shared helpers. All modules use ESM with TypeScript.

## Goals / Non-Goals

**Goals:**
- Reduce agent token cost for task management by ~80-90% (CLI calls vs file read+edit)
- Provide atomic task claiming for concurrent subagent workflows
- Offer a minimal CLI surface optimized for agent consumption (`claim`, `done`, `progress`, `list`)
- Use SQLite with WAL mode as the concurrency-safe task store
- Sync task completion state back to `tasks.md` for human readability and archive compatibility

**Non-Goals:**
- General-purpose task management (assignment, scheduling, notifications)
- Web UI or TUI — CLI-only, optimized for agent callers
- Bidirectional sync — SQLite is source of truth for state, `tasks.md` is updated on completion
- Status history or audit trail — not needed for the token-saving goal
- `in-progress`/`skipped` annotations in markdown — unnecessary format complexity

## Decisions

### Decision 1: SQLite is source of truth for task state

**Choice**: SQLite owns task status. `tasks.md` is synced on task completion (writeback), not the other way around.

**Rationale**: The previous design had `tasks.md` as source of truth with SQLite as a derived view. This fails under concurrency — two agents reading the same markdown file will see the same "next" task. SQLite with WAL mode handles concurrent reads/writes natively. Task state lives in the DB; `tasks.md` checkboxes are updated when tasks complete, preserving compatibility with the archive workflow and human readability.

**Alternative considered**: Markdown as source of truth with file locking — rejected because cross-platform file locking is unreliable and adds complexity (`flock` on Linux, different API on Windows). SQLite's locking is battle-tested on all platforms.

### Decision 2: `better-sqlite3` over `sql.js`

**Choice**: Use `better-sqlite3` for SQLite bindings.

**Rationale**: Synchronous API fits the CLI execution model. Native SQLite provides WAL mode for concurrent access. Prebuilt binaries for macOS, Linux, Windows. Most popular Node.js SQLite library.

**Alternative considered**: `sql.js` (Wasm) — portable but no true file-level locking, defeating the concurrency purpose. Drizzle/Knex — unnecessary ORM layer for a 2-table schema.

### Decision 3: Atomic `claim` operation

**Choice**: Single SQL statement that finds the next pending task and atomically marks it `in-progress`.

**Rationale**: This is the core concurrency primitive. `UPDATE ... WHERE status = 'pending' ... LIMIT 1 RETURNING *` ensures two agents calling `claim` simultaneously will never get the same task. No application-level locking needed.

**Alternative considered**: Separate read-then-update with advisory locks — more complex, same result, more failure modes.

### Decision 4: Database location at `openspec/.openspec.db`

**Choice**: Store the database at `openspec/.openspec.db` inside the project.

**Rationale**: Co-locating with `openspec/` keeps data project-scoped. Reconstructible from `tasks.md` — safe to delete. `.gitignore` prevents accidental commits.

**Alternative considered**: `~/.openspec/tasks.db` (global) — rejected because tasks are project-specific.

### Decision 5: Initial sync from `tasks.md`, writeback on completion

**Choice**: On first use (or when DB is missing), populate SQLite from `tasks.md`. On `task done`, update the corresponding markdown checkbox.

**Rationale**: This gives the best of both worlds — agents work against SQLite for speed and concurrency, but `tasks.md` stays up-to-date for humans and the archive workflow. No file watchers, no bidirectional sync complexity.

### Decision 6: Task identity uses dotted numbering

**Choice**: Use the `X.Y` dotted string from `tasks.md` (e.g., `"3.2"`) as the task identifier, not an integer index.

**Rationale**: Real `tasks.md` files use dotted numbering (`1.1`, `2.3`, `5.6`) under `## N. Section` headers. Agents refer to tasks by these IDs. Storing them as-is avoids translation overhead and matches what agents see in task output.

### Decision 7: Extend existing parser

**Choice**: Extend `src/utils/task-progress.ts` to extract per-task data (dotted ID, title, section, checkbox state), rather than building a separate parser.

**Rationale**: The existing parser already handles the regex matching for `- [ ]` / `- [x]`. Extending it avoids duplication and keeps a single place for markdown task parsing logic.

### Decision 8: Module structure

**Choice**: `src/core/task-storage/` for database logic, `src/commands/task.ts` for CLI entry point.

**Rationale**: Follows existing patterns (`src/core/` for logic, `src/commands/` for CLI).

## Risks / Trade-offs

- **[Native dependency]** `better-sqlite3` requires compilation on some systems → Mitigate with prebuilt binaries (covers >95% of users); document build-from-source fallback.
- **[Package size]** `better-sqlite3` adds ~10MB to install → Acceptable for a dev tool; justified by concurrency safety.
- **[DB deletion]** If someone deletes `.openspec.db`, state is lost → Mitigate by re-syncing from `tasks.md` on next command (tasks revert to pending/done based on checkboxes; in-progress state is lost).
- **[Cross-platform paths]** Database path must use `path.join()` → Enforced by existing codebase conventions.
- **[Stale markdown]** If an agent crashes after `claim` but before `done`, `tasks.md` won't reflect in-progress state → Acceptable; agent restart will see the task as `in-progress` in SQLite and can resume or release it.
