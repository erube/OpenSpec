## ADDED Requirements

### Requirement: SQLite database initialization

The system SHALL create and manage a SQLite database at `openspec/.openspec.db` within the project root using `better-sqlite3`. The database SHALL be initialized automatically on first use by any `openspec task` command.

#### Scenario: First-time database creation

- **WHEN** any `openspec task` subcommand is invoked
- **AND** no `openspec/.openspec.db` file exists
- **THEN** the system SHALL create the database file at the path constructed via `path.join(projectRoot, 'openspec', '.openspec.db')`
- **AND** run all pending migrations to create the schema
- **AND** enable WAL journal mode for concurrent access

#### Scenario: Database already exists

- **WHEN** any `openspec task` subcommand is invoked
- **AND** `openspec/.openspec.db` already exists
- **THEN** the system SHALL open the existing database
- **AND** run any pending migrations that have not yet been applied

#### Scenario: Database reconstruction from markdown

- **WHEN** any `openspec task` subcommand is invoked
- **AND** the database was deleted or is empty
- **THEN** the system SHALL populate the `tasks` table by parsing `tasks.md` for the specified change
- **AND** derive status from markdown checkboxes: `- [ ]` → `pending`, `- [x]` → `done`

### Requirement: Task table schema

The system SHALL store tasks in a `tasks` table with columns for identity, content, and status.

#### Scenario: Task record structure

- **WHEN** a task is stored in SQLite
- **THEN** the record SHALL contain the following fields:
  - `task_id` (TEXT, NOT NULL — dotted numbering from `tasks.md`, e.g., `"3.2"`)
  - `change_name` (TEXT, NOT NULL — the owning change)
  - `section` (TEXT, NOT NULL — section header, e.g., `"Core Implementation"`)
  - `title` (TEXT, NOT NULL — task title text from markdown)
  - `status` (TEXT, NOT NULL — one of: `pending`, `in-progress`, `done`)
  - `updated_at` (TEXT, ISO 8601 timestamp)
- **AND** the primary key SHALL be the composite of (`change_name`, `task_id`)

#### Scenario: Unique constraint on claim

- **WHEN** two concurrent processes attempt to claim the same task
- **THEN** SQLite's row-level locking via WAL mode SHALL ensure only one succeeds

### Requirement: Atomic task claiming

The system SHALL provide an atomic claim operation that finds the next pending task and marks it `in-progress` in a single SQL statement.

#### Scenario: Claim next pending task

- **WHEN** `openspec task claim --change my-change` is executed
- **THEN** the system SHALL execute a single SQL statement that:
  - Finds the first task with `status = 'pending'` ordered by `task_id`
  - Updates its status to `in-progress`
  - Returns the claimed task's `task_id` and `title`

#### Scenario: Concurrent claim by two agents

- **WHEN** Agent A and Agent B both execute `openspec task claim --change my-change` simultaneously
- **THEN** each agent SHALL receive a different task
- **AND** no task SHALL be claimed by more than one agent

#### Scenario: No pending tasks available

- **WHEN** `openspec task claim --change my-change` is executed
- **AND** no tasks have `status = 'pending'`
- **THEN** the system SHALL output a message: "No pending tasks for change 'my-change'"

### Requirement: Markdown writeback on completion

The system SHALL update the corresponding `tasks.md` checkbox when a task is marked `done`.

#### Scenario: Mark task done updates markdown

- **WHEN** a task is marked `done` via `openspec task done`
- **THEN** the system SHALL locate the task line in `tasks.md` by its dotted ID
- **AND** change `- [ ]` to `- [x]` on that line
- **AND** use `path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md')` to construct the file path

#### Scenario: Writeback with non-existent tasks.md

- **WHEN** a task is marked `done`
- **AND** `tasks.md` does not exist for the change
- **THEN** the system SHALL skip the writeback without error
- **AND** update only the SQLite record

### Requirement: Schema migration system

The system SHALL use a versioned migration approach to manage database schema changes over time.

#### Scenario: Migration tracking

- **WHEN** migrations are applied
- **THEN** the system SHALL record each applied migration version in a `migrations` table
- **AND** only run migrations that have not yet been recorded

#### Scenario: Migration execution order

- **WHEN** multiple pending migrations exist
- **THEN** the system SHALL execute them in ascending version order within a transaction

### Requirement: Initial sync from tasks.md

The system SHALL parse `tasks.md` to populate the database when no tasks exist for a change.

#### Scenario: Parse dotted task format

- **WHEN** syncing from `tasks.md`
- **THEN** the system SHALL extract:
  - Section headers from `## N. Section Name` lines
  - Task dotted IDs from `- [ ] X.Y` or `- [x] X.Y` patterns
  - Task titles from the text following the dotted ID
  - Checkbox state: `[ ]` → `pending`, `[x]` → `done`

#### Scenario: Sync uses existing parser

- **WHEN** parsing `tasks.md`
- **THEN** the system SHALL extend the existing `src/utils/task-progress.ts` module with per-task extraction
- **AND** reuse existing `TASK_PATTERN` and `COMPLETED_TASK_PATTERN` regex patterns

#### Scenario: Sync with missing tasks.md

- **WHEN** a sync is triggered for change `my-change`
- **AND** `tasks.md` does not exist at `path.join(projectRoot, 'openspec', 'changes', changeName, 'tasks.md')`
- **THEN** the system SHALL display a warning: "No tasks.md found for change 'my-change'"
- **AND** not modify the database
