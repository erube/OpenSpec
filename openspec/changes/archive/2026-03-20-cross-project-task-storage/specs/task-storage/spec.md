## MODIFIED Requirements

### Requirement: SQLite database initialization

The system SHALL create and manage a SQLite database at the global config directory path `path.join(getGlobalConfigDir(), 'tasks.db')` using `better-sqlite3`. The database SHALL be initialized automatically on first use by any `openspec task` command when `taskStorage` is `"sqlite"`.

#### Scenario: First-time database creation

- **WHEN** any `openspec task` subcommand is invoked
- **AND** `taskStorage` is `"sqlite"` in project config
- **AND** no `tasks.db` file exists in the global config directory
- **THEN** the system SHALL create the global config directory if it does not exist
- **AND** create the database file at `path.join(getGlobalConfigDir(), 'tasks.db')`
- **AND** run all pending migrations to create the schema
- **AND** enable WAL journal mode for concurrent access

#### Scenario: Database already exists

- **WHEN** any `openspec task` subcommand is invoked
- **AND** `taskStorage` is `"sqlite"` in project config
- **AND** `tasks.db` already exists in the global config directory
- **THEN** the system SHALL open the existing database
- **AND** run any pending migrations that have not yet been applied

#### Scenario: Database reconstruction from markdown

- **WHEN** any `openspec task` subcommand is invoked
- **AND** `taskStorage` is `"sqlite"` in project config
- **AND** no tasks exist in the database for the current `project_id` and `change_name`
- **THEN** the system SHALL populate the `tasks` table by parsing `tasks.md` for the specified change
- **AND** derive status from markdown checkboxes: `- [ ]` → `pending`, `- [x]` → `done`
- **AND** set `project_id` to the resolved project identity

#### Scenario: taskStorage is markdown (no database)

- **WHEN** any `openspec task` subcommand is invoked
- **AND** `taskStorage` is `"markdown"` or unset in project config
- **THEN** the system SHALL NOT open or create any database
- **AND** task operations SHALL read and write `tasks.md` directly

### Requirement: Task table schema

The system SHALL store tasks in a `tasks` table with columns for project identity, change identity, content, and status.

#### Scenario: Task record structure

- **WHEN** a task is stored in SQLite
- **THEN** the record SHALL contain the following fields:
  - `project_id` (TEXT, NOT NULL — resolved project identity)
  - `change_name` (TEXT, NOT NULL — the owning change)
  - `task_id` (TEXT, NOT NULL — dotted numbering from `tasks.md`, e.g., `"3.2"`)
  - `section` (TEXT, NOT NULL — section header, e.g., `"Core Implementation"`)
  - `title` (TEXT, NOT NULL — task title text from markdown)
  - `status` (TEXT, NOT NULL — one of: `pending`, `in-progress`, `done`)
  - `updated_at` (TEXT, ISO 8601 timestamp)
- **AND** the primary key SHALL be the composite of (`project_id`, `change_name`, `task_id`)

#### Scenario: Unique constraint on claim

- **WHEN** two concurrent processes attempt to claim the same task
- **THEN** SQLite's row-level locking via WAL mode SHALL ensure only one succeeds

### Requirement: Atomic task claiming

The system SHALL provide an atomic claim operation that finds the next pending task and marks it `in-progress` in a single SQL statement, scoped to a specific project.

#### Scenario: Claim next pending task

- **WHEN** `claimNextTask(db, projectId, changeName)` is called
- **THEN** the system SHALL execute a single SQL statement that:
  - Finds the first task with `status = 'pending'` for the given `project_id` and `change_name`, ordered by `task_id`
  - Updates its status to `in-progress`
  - Returns the claimed task record

#### Scenario: Concurrent claim by two agents

- **WHEN** Agent A and Agent B both call `claimNextTask` simultaneously for the same project and change
- **THEN** each agent SHALL receive a different task
- **AND** no task SHALL be claimed by more than one agent

#### Scenario: No pending tasks available

- **WHEN** `claimNextTask(db, projectId, changeName)` is called
- **AND** no tasks have `status = 'pending'` for that project and change
- **THEN** the system SHALL return null

### Requirement: Markdown writeback on completion

The system SHALL update the corresponding `tasks.md` checkbox when a task is marked `done` in SQLite mode.

#### Scenario: Mark task done updates markdown

- **WHEN** a task is marked `done` via the SQLite path
- **THEN** the system SHALL locate the task line in `tasks.md` by its dotted ID
- **AND** change `- [ ]` to `- [x]` on that line

#### Scenario: Writeback with non-existent tasks.md

- **WHEN** a task is marked `done`
- **AND** `tasks.md` does not exist for the change
- **THEN** the system SHALL skip the writeback without error

### Requirement: Schema migration system

The system SHALL use a versioned migration approach to manage database schema changes over time.

#### Scenario: Migration tracking

- **WHEN** migrations are applied
- **THEN** the system SHALL record each applied migration version in a `migrations` table
- **AND** only run migrations that have not yet been recorded

#### Scenario: Migration from v1 to v2 adds project_id

- **WHEN** the database was created with migration v1 (per-project schema without `project_id`)
- **AND** migration v2 is pending
- **THEN** the system SHALL recreate the `tasks` table with the new primary key `(project_id, change_name, task_id)`
- **AND** copy existing rows with `project_id` set to `'unknown'`

### Requirement: openDatabase uses global path

The system SHALL open the database from the global config directory, not from a project-specific path.

#### Scenario: Open database resolves global path

- **WHEN** `openDatabase()` is called
- **THEN** the system SHALL resolve the database path as `path.join(getGlobalConfigDir(), 'tasks.db')`
- **AND** create the directory via `fs.mkdirSync(dir, { recursive: true })` if it does not exist

#### Scenario: Cross-platform database path

- **WHEN** `openDatabase()` is called on Windows with `%APPDATA%` set to `C:\Users\User\AppData\Roaming`
- **THEN** the database path SHALL be `C:\Users\User\AppData\Roaming\openspec\tasks.db`

### Requirement: All queries accept project_id parameter

The system SHALL require a `projectId` parameter on all query functions that access the tasks table.

#### Scenario: Query functions signature

- **WHEN** calling any task query function (`claimNextTask`, `markTaskDone`, `releaseTask`, `listTasks`, `getTaskProgress`, `getTask`, `hasTasksForChange`, `insertTask`)
- **THEN** the function SHALL accept `projectId` as its second parameter (after `db`)
- **AND** use it in the WHERE clause to scope results to the specified project

#### Scenario: Cross-project task listing

- **WHEN** calling `getChangesWithTasks(db)` without a project filter
- **THEN** the function SHALL return all changes across all projects
- **AND** include the `project_id` in returned results

#### Scenario: Project-scoped task listing

- **WHEN** calling `getChangesWithTasks(db, projectId)` with a project filter
- **THEN** the function SHALL return only changes for the specified project

### Requirement: Initial sync from tasks.md

The system SHALL parse `tasks.md` to populate the database when no tasks exist for a project and change combination.

#### Scenario: Parse dotted task format with project_id

- **WHEN** syncing from `tasks.md`
- **THEN** the system SHALL insert tasks with the resolved `project_id`
- **AND** extract section headers, task IDs, titles, and checkbox state as before

#### Scenario: Sync scoped to project

- **WHEN** a sync is triggered for a change in project "my-app"
- **AND** the same change name exists for project "other-app" in the database
- **THEN** the sync SHALL only check for existing tasks where `project_id = 'my-app'`
- **AND** not affect tasks belonging to "other-app"
