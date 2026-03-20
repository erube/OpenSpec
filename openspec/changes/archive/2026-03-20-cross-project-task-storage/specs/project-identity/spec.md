## ADDED Requirements

### Requirement: Resolve project identity

The system SHALL resolve a human-readable `project_id` string for the current project, used as a namespace in the global task database.

#### Scenario: Default project identity from directory basename

- **WHEN** `resolveProjectId(projectRoot)` is called
- **AND** `openspec/config.yaml` does not contain a `projectId` field
- **THEN** the system SHALL return `path.basename(projectRoot)`

#### Scenario: Override project identity from config

- **WHEN** `resolveProjectId(projectRoot)` is called
- **AND** `openspec/config.yaml` contains `projectId: "my-custom-name"`
- **THEN** the system SHALL return `"my-custom-name"`

#### Scenario: Empty projectId in config falls back to basename

- **WHEN** `resolveProjectId(projectRoot)` is called
- **AND** `openspec/config.yaml` contains `projectId: ""`
- **THEN** the system SHALL return `path.basename(projectRoot)`

#### Scenario: Cross-platform path handling

- **WHEN** `resolveProjectId(projectRoot)` is called with `C:\Users\dev\my-project` on Windows
- **THEN** the system SHALL return `"my-project"` (using `path.basename()` which handles platform separators)

#### Scenario: No config file exists

- **WHEN** `resolveProjectId(projectRoot)` is called
- **AND** `openspec/config.yaml` does not exist
- **THEN** the system SHALL return `path.basename(projectRoot)`
