# Project Custom Requirements

## Project Overview

This project maintains and manages Claude Code Skills, using the standard Claude Code Plugin architecture.

## Project Architecture

```
doc-smith-skill/
├── skills/                    # Skills directory (user-invocable)
│   ├── doc-smith/
│   │   └── SKILL.md          # /doc-smith command
│   ├── doc-smith-images/
│   │   └── SKILL.md          # /doc-smith-images command
│   └── {skill-name}/
│       └── SKILL.md
├── agents/                    # Sub-agents directory (called by Skills)
│   ├── doc-smith-content.md  # Document content generation sub-agent
│   ├── generate-slot-image.md # Image generation sub-agent
│   └── {agent-name}.md
├── skills-entry/              # [Deprecated] AIGNE entry, for reference only
├── utils/                     # [Deprecated] Shared modules, for reference only
└── CLAUDE.md
```

## Core Rules

1. **Skill Structure**
   - Each Skill is a standalone folder under `skills/`
   - Must contain `SKILL.md` as the entry file
   - Users invoke via `/{skill-name}`

2. **Sub-agent Structure**
   - Sub-agents are placed in the `agents/` directory
   - Defined using Markdown files (`{agent-name}.md`)
   - Called by Skills via the Task tool, not directly exposed to users

3. **Language Requirements**
   - All prompts must be written in Chinese
   - Code comments and log messages should be in English

4. **Development Guidelines**
   - Use `/skill-creator` for guidance when creating or modifying Skills
   - Do not include `Co-Authored-By` information when committing

5. **Deprecated Code Handling**
   - `skills-entry/`, `utils/` and other AIGNE-related code is for reference only
   - Do not modify files in these directories
   - Will be gradually removed in the future

## Skill File Structure

### SKILL.md Basic Structure

```markdown
---
name: skill-name
description: Skill description for trigger matching
---

# Skill Title

Brief description.

## Usage

Usage examples (command-line format).

## Options

Options table.

## Workflow

Detailed execution steps.

## Error Handling

Common errors and how to handle them.
```

### Sub-agent Basic Structure

```markdown
---
name: agent-name
description: Agent description
tools: Read, Write, Bash, Glob, Task
model: inherit
---

# Agent Title

## Input Parameters

Parameters required when calling.

## Output

Return result format.

## Workflow

Execution steps.

## Responsibility Boundaries

What must be done and what should not be done.
```

## Call Relationships

```
User → /doc-smith → SKILL.md
                      ↓
                   Task tool calls Sub-agent
                      ↓
              agents/doc-smith-content.md
              agents/generate-slot-image.md
```

**Skill calling Sub-agent example**:

```markdown
Use generate-slot-image sub-agent to generate image:
- docPath=/overview
- slotId=architecture
- slotDesc="System architecture diagram"
```

**Calling multiple Sub-agents in parallel**:

```markdown
Use separate generate-slot-image sub-agents to generate the following images in parallel:
- docPath=/overview, slotId=arch, slotDesc="Architecture diagram"
- docPath=/api, slotId=flow, slotDesc="Flowchart"
```

## Design Principles

### KISS Principle

- Prefer the simplest solution
- Complexity is a sign of immature design
- If extensive edge case handling is needed, reconsider the abstraction

### Separation of Concerns

- Skill: User-facing, handles input parsing and workflow orchestration
- Sub-agent: Task-focused, concentrates on a single responsibility
- Each component does one thing only

### Output Design

- Return natural language summaries, not structured data
- Return only necessary information to avoid context bloat
- Use the `message` field to return execution result descriptions

## Workflows

### Creating a New Skill

1. Use `/skill-creator` for guidance
2. Create `SKILL.md` in `skills/{skill-name}/`
3. If Sub-agent is needed, create the corresponding file in `agents/`

### Creating a New Sub-agent

1. Create `{agent-name}.md` in `agents/`
2. Define frontmatter (name, description, tools, model)
3. Write workflow and responsibility boundaries
4. Call via the Task tool in the parent Skill

### Modifying Existing Components

1. Directly edit the corresponding `.md` file
2. Do not modify deprecated code in `skills-entry/` or `utils/`
