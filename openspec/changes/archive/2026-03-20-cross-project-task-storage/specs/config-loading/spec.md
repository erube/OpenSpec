## ADDED Requirements

### Requirement: Task storage mode configuration

The system SHALL support a `taskStorage` field in `openspec/config.yaml` that determines how tasks are managed.

#### Scenario: Valid taskStorage value "sqlite"

- **WHEN** `openspec/config.yaml` contains `taskStorage: "sqlite"`
- **THEN** the parsed config SHALL include `taskStorage: "sqlite"`

#### Scenario: Valid taskStorage value "markdown"

- **WHEN** `openspec/config.yaml` contains `taskStorage: "markdown"`
- **THEN** the parsed config SHALL include `taskStorage: "markdown"`

#### Scenario: Missing taskStorage field

- **WHEN** `openspec/config.yaml` does not contain a `taskStorage` field
- **THEN** the parsed config SHALL not include `taskStorage`
- **AND** consumers SHALL treat the absence as `"markdown"` (the default)

#### Scenario: Invalid taskStorage value

- **WHEN** `openspec/config.yaml` contains `taskStorage: "redis"`
- **THEN** the system SHALL log a warning: `Invalid 'taskStorage' field in config (must be "markdown" or "sqlite")`
- **AND** the field SHALL be excluded from the parsed config

### Requirement: Project identity override configuration

The system SHALL support a `projectId` field in `openspec/config.yaml` that overrides the auto-detected project name.

#### Scenario: Valid projectId value

- **WHEN** `openspec/config.yaml` contains `projectId: "my-api"`
- **THEN** the parsed config SHALL include `projectId: "my-api"`

#### Scenario: Missing projectId field

- **WHEN** `openspec/config.yaml` does not contain a `projectId` field
- **THEN** the parsed config SHALL not include `projectId`

#### Scenario: Empty string projectId

- **WHEN** `openspec/config.yaml` contains `projectId: ""`
- **THEN** the system SHALL log a warning: `Invalid 'projectId' field in config (must be non-empty string)`
- **AND** the field SHALL be excluded from the parsed config

#### Scenario: Non-string projectId

- **WHEN** `openspec/config.yaml` contains `projectId: 123`
- **THEN** the system SHALL log a warning and exclude the field from the parsed config
