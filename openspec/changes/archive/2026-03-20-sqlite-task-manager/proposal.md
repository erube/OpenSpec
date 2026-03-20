## Why

AI agents working on OpenSpec changes waste significant tokens on task management. Every time an agent checks what's next or marks a task done, it must read the entire `tasks.md` file (~600-2200 tokens) and edit it (~200 tokens). Over a 20-task change, that's 16,000-48,000 tokens spent just on bookkeeping. For a 90-task change like `simplify-skill-installation`, the cost is far higher.

The problem compounds with parallel subagents. When multiple agents work on the same change concurrently, `tasks.md` becomes a race condition: two agents read the file, both see task 3.1 as next, both start it. Worse, concurrent file edits can clobber each other — Agent A marks 3.1 done while Agent B overwrites the file marking 3.2 done, silently losing A's update.

## What Changes

- Add SQLite as a concurrency-safe task store with atomic claim semantics
- Introduce `openspec task` CLI subcommands optimized for agent use (~50-100 tokens per call vs ~2400 for file read+edit)
- SQLite becomes source of truth for task state; `tasks.md` is synced on completion
- Support atomic task claiming for parallel subagent workflows

## Capabilities

### New Capabilities
- `task-storage`: SQLite database with WAL mode, schema migrations, and atomic task claiming for concurrent agent access
- `task-cli`: Token-efficient CLI subcommands (`openspec task claim`, `openspec task done`, `openspec task list`, `openspec task progress`) designed for agent consumption

### Modified Capabilities

_(none — this is additive functionality)_

## Impact

- **New dependency**: `better-sqlite3` (synchronous SQLite bindings for Node.js)
- **Database location**: `openspec/.openspec.db` (local to project, gitignored)
- **Token savings**: ~80-90% reduction in task management overhead for agents
- **Concurrency**: Enables parallel subagent workflows without file-level race conditions
- **Cross-platform**: `better-sqlite3` provides prebuilt binaries for macOS, Linux, and Windows
- **File system**: New `.openspec.db` file; needs `.gitignore` entry
- **Degradation**: DB is reconstructible from `tasks.md` — safe to delete
