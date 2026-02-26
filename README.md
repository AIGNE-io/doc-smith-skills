# DocSmith Skills

<p align="center">
  <img src="./logo/logo.svg" alt="DocSmith Skills" width="120">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FAIGNE-io%2Fdoc-smith-skills%2Fmain%2F.claude-plugin%2Fmarketplace.json&query=%24.metadata.version&label=version&style=for-the-badge&color=blue" alt="Version">
  <img src="https://img.shields.io/badge/Agent_Skill-blueviolet?style=for-the-badge" alt="Agent Skill">
  <img src="https://img.shields.io/badge/MCP-Compatible-blue?style=for-the-badge" alt="MCP Compatible">
  <img src="https://img.shields.io/badge/license-Elastic--2.0-green?style=for-the-badge" alt="License">
  <a href="https://github.com/AIGNE-io/doc-smith-skills/stargazers">
    <img src="https://img.shields.io/github/stars/AIGNE-io/doc-smith-skills?style=for-the-badge" alt="GitHub Stars">
  </a>
</p>

<p align="center">
  English | <a href="./README.zh.md">中文</a>
</p>

AI-powered documentation generation, translation, and publishing — all from your coding agent.
Analyze your project, plan document structure, generate beautiful HTML docs, translate to any language, and publish online.

## How it Works

```mermaid
flowchart LR
    A[Analyze Project] --> B[Plan Structure]
    B --> C[Generate Docs]
    C --> D[Translate]
    D --> E[Publish]

    A -.- A1[Source code & project files]
    B -.- B1[User confirms outline]
    C -.- C1[HTML with AI images]
    D -.- D1[Multi-language support]
    E -.- E1[DocSmith Cloud URL]
```

## Features

| Feature | Description |
|---------|-------------|
| **Smart Analysis** | Scans source code, README, configs to understand your project |
| **Structured Planning** | Generates document outline for user review before writing |
| **HTML Generation** | Produces clean, navigable HTML documentation |
| **AI Images** | Auto-generates diagrams, flowcharts, and architecture charts |
| **Multi-language** | Translates docs to any language with terminology consistency |
| **Incremental Updates** | Hash-based change detection — only re-translates what changed |
| **One-click Publish** | Deploy to DocSmith Cloud and get a shareable preview URL |

## Installation

```bash
npx skills add AIGNE-io/doc-smith-skills
```

> Powered by [skills](https://github.com/vercel-labs/skills) — supports Claude Code, Cursor, Codex, Gemini CLI, and [35+ more agents](https://github.com/vercel-labs/skills#supported-agents).

Or simply tell your AI coding agent:

> Please install Skills from github.com/AIGNE-io/doc-smith-skills

<details>
<summary><b>Via Claude Code Plugin Marketplace</b></summary>

```bash
# Register marketplace
/plugin marketplace add AIGNE-io/doc-smith-skills

# Install plugin
/plugin install doc-smith@doc-smith-skills
```

</details>

## Quick Start

```bash
# Generate documentation for your project
/doc-smith-create Generate English documentation for the current project

# Translate to other languages
/doc-smith-localize --lang en --lang ja

# Publish online
/doc-smith-publish
```

That's it! DocSmith handles analysis, generation, translation, and publishing automatically.

## Available Skills

| Skill | Description |
|-------|-------------|
| [doc-smith-create](#doc-smith-create) | Generate structured documentation from project sources |
| [doc-smith-localize](#doc-smith-localize) | Translate documents to multiple languages |
| [doc-smith-publish](#doc-smith-publish) | Publish to DocSmith Cloud for online preview |

Internal skills (called automatically, not invoked directly):

| Skill | Description |
|-------|-------------|
| doc-smith-build | Build Markdown into static HTML |
| doc-smith-check | Validate document structure and content integrity |
| doc-smith-images | Generate AI images (diagrams, flowcharts, architecture) |

---

### doc-smith-create

Generate comprehensive documentation from code repositories, text files, and media resources.

```bash
/doc-smith-create Generate English documentation for the current project
/doc-smith-create 为当前项目生成中文文档
```

<details>
<summary><b>Features & Details</b></summary>

- Analyzes source code and project structure
- Infers user intent and target audience
- Plans document structure with user confirmation
- Generates organized documentation with HTML output
- AI-generated images for diagrams and architecture charts
- Supports technical docs, user guides, API references, and tutorials

</details>

---

### doc-smith-localize

Translate documents to multiple languages with batch processing and terminology consistency.

```bash
/doc-smith-localize --lang en
/doc-smith-localize --lang en --lang ja
```

<details>
<summary><b>Options</b></summary>

| Option | Description |
|--------|-------------|
| `--lang <code>` | Target language code (repeatable) |
| `--path <path>` | Translate specific document only |
| `--force` | Force re-translate all documents |

</details>

<details>
<summary><b>Features & Details</b></summary>

- HTML-to-HTML translation (no intermediate Markdown step)
- Batch translation with progress tracking
- Terminology consistency across documents
- Image text translation support
- Incremental translation with hash-based change detection

</details>

---

### doc-smith-publish

Publish generated documents to DocSmith Cloud for online preview.

```bash
/doc-smith-publish
```

<details>
<summary><b>Options</b></summary>

| Option | Description |
|--------|-------------|
| `--dir <path>` | Publish specific directory (default: `.aigne/doc-smith/dist`) |
| `--hub <url>` | Custom hub URL |

</details>

<details>
<summary><b>Features & Details</b></summary>

- One-click publish to DocSmith Cloud
- Automatic asset upload and optimization
- Returns online preview URL

</details>

## Workspace Structure

DocSmith creates a workspace in `.aigne/doc-smith/` with its own git repository:

<details>
<summary><b>View directory layout</b></summary>

```
my-project/
├── .aigne/
│   └── doc-smith/                     # DocSmith workspace (independent git repo)
│       ├── config.yaml                # Workspace configuration
│       ├── intent/
│       │   └── user-intent.md         # User intent description
│       ├── planning/
│       │   └── document-structure.yaml # Document structure plan
│       ├── docs/                      # Document metadata
│       ├── dist/                      # Built HTML output
│       │   ├── zh/                    # Chinese docs
│       │   ├── en/                    # English docs
│       │   └── assets/               # Styles, scripts, images
│       ├── assets/                    # Generated image assets
│       └── cache/                     # Temporary data (not in git)
```

</details>

## FAQ

<details>
<summary><b>What project types does DocSmith support?</b></summary>

DocSmith works with any project — it analyzes source code, configuration files, README, and other project files regardless of language or framework.

</details>

<details>
<summary><b>Where is the workspace located?</b></summary>

All DocSmith data lives in `.aigne/doc-smith/` under your project root. It uses its own git repository, so it won't interfere with your project's version control.

</details>

<details>
<summary><b>How does incremental translation work?</b></summary>

DocSmith uses content hashing to detect changes. When you run `/doc-smith-localize`, only documents that have changed since the last translation will be re-translated. Use `--force` to override this behavior.

</details>

<details>
<summary><b>Can I customize the output theme?</b></summary>

Yes. DocSmith generates a `theme.css` file in the dist assets directory. You can modify it to customize colors, fonts, and layout.

</details>

## Contributing

Contributions are welcome! Please feel free to submit a [Pull Request](https://github.com/AIGNE-io/doc-smith-skills/pulls).

## Support

- [GitHub Issues](https://github.com/AIGNE-io/doc-smith-skills/issues) — Bug reports and feature requests
- [ArcBlock](https://www.arcblock.io) — Learn more about ArcBlock

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

Elastic-2.0
