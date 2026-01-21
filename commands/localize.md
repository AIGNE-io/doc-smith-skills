---
description: Translate documents to multiple languages, supports batch translation and image translation
---

# Document Translation Command

Invoke the doc-smith-translate skill to execute document translation tasks.

## Usage

```
/doc-smith:localize                           # Start translation workflow
/doc-smith:localize translate all docs to English  # Natural language description
/doc-smith:localize --lang en                 # Translate to English
/doc-smith:localize --lang en --lang ja       # Translate to multiple languages
/doc-smith:localize --lang en --path /overview # Translate specific document
```

## Execution

Immediately invoke the `/doc-smith-translate` skill to begin document translation.

If the user provides additional arguments: "$ARGUMENTS", pass them as task description to the skill.
