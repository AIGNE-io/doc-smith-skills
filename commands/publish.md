---
description: Publish documents to online platforms, supports publishing to existing websites or creating new ones
---

# Document Publishing Command

Invoke the doc-smith-publish skill to execute document publishing tasks.

## Usage

```
/doc-smith:publish                              # Publish to configured target
/doc-smith:publish publish docs to website      # Natural language description
/doc-smith:publish --url https://example.com    # Publish to specified URL
/doc-smith:publish --new-website                # Create new website and publish
```

## Execution

Immediately invoke the `/doc-smith-publish` skill to begin document publishing.

If the user provides additional arguments: "$ARGUMENTS", pass them as task description to the skill.
