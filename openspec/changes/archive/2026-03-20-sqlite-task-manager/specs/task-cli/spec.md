## ADDED Requirements

### Requirement: Task claim command

The system SHALL provide an `openspec task claim` command that atomically assigns the next pending task to the calling agent.

#### Scenario: Claim next task

- **WHEN** executing `openspec task claim --change my-change`
- **THEN** the system SHALL atomically find and claim the next pending task
- **AND** output the task ID and title in a compact format: `"3.2 Implement sync logic"`

#### Scenario: Claim with JSON output

- **WHEN** executing `openspec task claim --change my-change --json`
- **THEN** the system SHALL output the claimed task as JSON: `{"taskId": "3.2", "title": "Implement sync logic", "section": "Core Implementation"}`

#### Scenario: Claim when no tasks pending

- **WHEN** executing `openspec task claim --change my-change`
- **AND** all tasks are `in-progress` or `done`
- **THEN** the system SHALL output: "No pending tasks for change 'my-change'"

#### Scenario: Claim triggers initial sync

- **WHEN** executing `openspec task claim --change my-change`
- **AND** no tasks exist in the database for that change
- **THEN** the system SHALL sync from `tasks.md` first
- **AND** then claim the first pending task

### Requirement: Task done command

The system SHALL provide an `openspec task done` command to mark a task as completed.

#### Scenario: Mark task done by ID

- **WHEN** executing `openspec task done 3.2 --change my-change`
- **THEN** the system SHALL update task 3.2's status to `done` in SQLite
- **AND** update the corresponding checkbox in `tasks.md` from `- [ ]` to `- [x]`
- **AND** output a confirmation with progress: `"✓ 3.2 done (14/20 complete)"`

#### Scenario: Done with non-existent task

- **WHEN** executing `openspec task done 99.1 --change my-change`
- **AND** task 99.1 does not exist
- **THEN** the system SHALL display an error: "Task 99.1 not found in change 'my-change'"

#### Scenario: Done with already-done task

- **WHEN** executing `openspec task done 3.2 --change my-change`
- **AND** task 3.2 already has status `done`
- **THEN** the system SHALL output: "Task 3.2 is already done"

### Requirement: Task list command

The system SHALL provide an `openspec task list` command that displays tasks with filtering options, optimized for low token output.

#### Scenario: List all tasks for a change

- **WHEN** executing `openspec task list --change my-change`
- **THEN** the system SHALL display tasks grouped by section
- **AND** show task ID, status indicator, and title per line
- **AND** use compact formatting: `[x] 3.1 Parse markdown` / `[ ] 3.2 Implement sync` / `[>] 3.3 Build CLI` (where `>` indicates in-progress)

#### Scenario: List tasks filtered by status

- **WHEN** executing `openspec task list --change my-change --status pending`
- **THEN** the system SHALL display only tasks matching the specified status

#### Scenario: List tasks as JSON

- **WHEN** executing `openspec task list --change my-change --json`
- **THEN** the system SHALL output the task list as a JSON array to stdout

#### Scenario: List with no database (auto-sync)

- **WHEN** executing `openspec task list --change my-change`
- **AND** no tasks exist in the database for that change
- **THEN** the system SHALL sync from `tasks.md` first
- **AND** display the synced tasks

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
- **THEN** the system SHALL output progress for each active change that has tasks in the database

### Requirement: Task release command

The system SHALL provide an `openspec task release` command to unclaim a task that was claimed but not completed (e.g., after an agent crash).

#### Scenario: Release a claimed task

- **WHEN** executing `openspec task release 3.2 --change my-change`
- **AND** task 3.2 has status `in-progress`
- **THEN** the system SHALL update task 3.2's status back to `pending`

#### Scenario: Release a non-in-progress task

- **WHEN** executing `openspec task release 3.2 --change my-change`
- **AND** task 3.2 has status `pending` or `done`
- **THEN** the system SHALL output: "Task 3.2 is not in-progress"
