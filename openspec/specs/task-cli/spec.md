# task-cli Specification

## Purpose
Define `openspec task` CLI subcommands for token-efficient task lifecycle management, optimized for AI agent consumption with atomic concurrency support and dual-mode routing (markdown vs sqlite).

## Requirements
### Requirement: Task storage mode routing

The system SHALL check the `taskStorage` field in project config before executing any task subcommand, routing to the appropriate implementation.

#### Scenario: SQLite mode routes to database operations

- **WHEN** executing any `openspec task` subcommand
- **AND** `openspec/config.yaml` contains `taskStorage: "sqlite"`
- **THEN** the system SHALL open the global database
- **AND** resolve the project identity
- **AND** execute the command via SQLite query functions

#### Scenario: Markdown mode routes to file operations

- **WHEN** executing any `openspec task` subcommand
- **AND** `openspec/config.yaml` does not contain `taskStorage` or contains `taskStorage: "markdown"`
- **THEN** the system SHALL execute the command by directly reading and writing `tasks.md`
- **AND** SHALL NOT open or create any database

### Requirement: Task claim command

The system SHALL provide an `openspec task claim` command that atomically assigns the next pending task to the calling agent.

#### Scenario: Claim next task (sqlite mode)

- **WHEN** executing `openspec task claim --change my-change`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL atomically find and claim the next pending task scoped to the current project
- **AND** output the task ID and title in a compact format: `"3.2 Implement sync logic"`

#### Scenario: Claim next task (markdown mode)

- **WHEN** executing `openspec task claim --change my-change`
- **AND** `taskStorage` is `"markdown"` or unset
- **THEN** the system SHALL output an error: `"Task claiming requires taskStorage: sqlite in openspec/config.yaml"`
- **AND** exit with a non-zero status code

#### Scenario: Claim with JSON output

- **WHEN** executing `openspec task claim --change my-change --json`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL output the claimed task as JSON: `{"taskId": "3.2", "title": "Implement sync logic", "section": "Core Implementation", "projectId": "my-project"}`

#### Scenario: Claim when no tasks pending

- **WHEN** executing `openspec task claim --change my-change`
- **AND** all tasks are `in-progress` or `done`
- **THEN** the system SHALL output: `"No pending tasks for change 'my-change'"`

#### Scenario: Claim triggers initial sync

- **WHEN** executing `openspec task claim --change my-change`
- **AND** `taskStorage` is `"sqlite"`
- **AND** no tasks exist in the database for the current project and change
- **THEN** the system SHALL sync from `tasks.md` first
- **AND** then claim the first pending task

### Requirement: Task done command

The system SHALL provide an `openspec task done` command to mark a task as completed.

#### Scenario: Mark task done by ID (sqlite mode)

- **WHEN** executing `openspec task done 3.2 --change my-change`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL update task 3.2's status to `done` in SQLite
- **AND** update the corresponding checkbox in `tasks.md` from `- [ ]` to `- [x]`
- **AND** output a confirmation with progress: `"✓ 3.2 done (14/20 complete)"`

#### Scenario: Mark task done by ID (markdown mode)

- **WHEN** executing `openspec task done 3.2 --change my-change`
- **AND** `taskStorage` is `"markdown"` or unset
- **THEN** the system SHALL locate task 3.2 in `tasks.md` and change `- [ ]` to `- [x]`
- **AND** output a confirmation with progress

#### Scenario: Done with non-existent task

- **WHEN** executing `openspec task done 99.1 --change my-change`
- **AND** task 99.1 does not exist
- **THEN** the system SHALL display an error: `"Task 99.1 not found in change 'my-change'"`

### Requirement: Task list command

The system SHALL provide an `openspec task list` command that displays tasks with filtering options.

#### Scenario: List all tasks for a change (sqlite mode)

- **WHEN** executing `openspec task list --change my-change`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL display tasks from the database scoped to the current project
- **AND** show task ID, status indicator, and title per line

#### Scenario: List all tasks for a change (markdown mode)

- **WHEN** executing `openspec task list --change my-change`
- **AND** `taskStorage` is `"markdown"` or unset
- **THEN** the system SHALL parse `tasks.md` and display tasks with status from checkboxes

#### Scenario: List tasks filtered by status

- **WHEN** executing `openspec task list --change my-change --status pending`
- **THEN** the system SHALL display only tasks matching the specified status

#### Scenario: List tasks as JSON

- **WHEN** executing `openspec task list --change my-change --json`
- **THEN** the system SHALL output the task list as a JSON array

### Requirement: Task progress command

The system SHALL provide an `openspec task progress` command that outputs a compact progress summary.

#### Scenario: Show progress for a change

- **WHEN** executing `openspec task progress --change my-change`
- **THEN** the system SHALL output a single-line summary: `"14/20 done, 3 in-progress, 3 pending"`

#### Scenario: Show progress as JSON

- **WHEN** executing `openspec task progress --change my-change --json`
- **THEN** the system SHALL output: `{"done": 14, "inProgress": 3, "pending": 3, "total": 20}`

#### Scenario: Show progress for all changes

- **WHEN** executing `openspec task progress --all`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL output progress for each active change across the current project

#### Scenario: Show progress across all projects

- **WHEN** executing `openspec task progress --all --global`
- **AND** `taskStorage` is `"sqlite"`
- **THEN** the system SHALL output progress for all changes across all projects in the global database

### Requirement: Task release command

The system SHALL provide an `openspec task release` command to unclaim a task.

#### Scenario: Release a claimed task (sqlite mode)

- **WHEN** executing `openspec task release 3.2 --change my-change`
- **AND** `taskStorage` is `"sqlite"`
- **AND** task 3.2 has status `in-progress`
- **THEN** the system SHALL update task 3.2's status back to `pending`

#### Scenario: Release in markdown mode

- **WHEN** executing `openspec task release 3.2 --change my-change`
- **AND** `taskStorage` is `"markdown"` or unset
- **THEN** the system SHALL output an error: `"Task release requires taskStorage: sqlite in openspec/config.yaml"`

#### Scenario: Release a non-in-progress task

- **WHEN** executing `openspec task release 3.2 --change my-change`
- **AND** task 3.2 has status `pending` or `done`
- **THEN** the system SHALL output: `"Task 3.2 is not in-progress"`
