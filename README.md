# doc-smith-skills

English | [中文](./README.zh.md)

Claude Code Skills for AI-powered documentation generation, translation, and publishing.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed
- AIGNE CLI installed: `npm i -g @aigne/cli`

## Installation

### Quick Install (Recommended)

```bash
npx skills add AIGNE-io/doc-smith-skills
```

### Register as Plugin Marketplace

Run the following command in Claude Code:

```bash
/plugin marketplace add AIGNE-io/doc-smith-skills
```

### Install Skills

**Option 1: Via Browse UI**

1. Select **Browse and install plugins**
2. Select **doc-smith-skills**
3. Select the plugin(s) you want to install
4. Select **Install now**

**Option 2: Direct Install**

```bash
# Install specific plugin
/plugin install doc-smith@doc-smith-skills
```

**Option 3: Ask the Agent**

Simply tell Claude Code:

> Please install Skills from github.com/ArcBlock/doc-smith-skills

## Available Skills

| Skill | Description |
|-------|-------------|
| [doc-smith-create](#doc-smith-create) | Generate and update structured documentation from project data sources |
| [doc-smith-localize](#doc-smith-localize) | Translate documents to multiple languages |
| [doc-smith-publish](#doc-smith-publish) | Publish documents to DocSmith Cloud for online preview |

Internal skills (called automatically by the above, not invoked directly):

| Skill | Description |
|-------|-------------|
| doc-smith-build | Build Markdown documentation into static HTML |
| doc-smith-check | Validate document structure and content integrity |
| doc-smith-images | Generate images using AI (diagrams, flowcharts, architecture diagrams) |

---

### doc-smith-create

Generate comprehensive documentation from code repositories, text files, and media resources.

```bash
# Generate English documentation for current project
/doc-smith-create Generate English documentation for the current project

# Generate Chinese documentation
/doc-smith-create 为当前项目生成中文文档
```

**Features:**
- Analyzes source code and project structure
- Infers user intent and target audience
- Plans document structure with user confirmation
- Generates organized documentation with HTML output
- AI-generated images for diagrams and architecture charts
- Supports technical docs, user guides, API references, and tutorials

---

### doc-smith-localize

Translate documents to multiple languages with batch processing and terminology consistency.

```bash
# Translate all docs to English
/doc-smith-localize --lang en

# Translate to multiple languages
/doc-smith-localize --lang en --lang ja

# Translate specific document
/doc-smith-localize --lang en --path /overview

# Force re-translate
/doc-smith-localize --lang en --force
```

**Features:**
- HTML-to-HTML translation (no intermediate Markdown step)
- Batch translation with progress tracking
- Terminology consistency across documents
- Image text translation support
- Incremental translation with hash-based change detection

---

### doc-smith-publish

Publish generated documents to DocSmith Cloud for online preview.

```bash
# Publish with default settings
/doc-smith-publish

# Publish specific directory
/doc-smith-publish --dir .aigne/doc-smith/dist

# Publish to custom hub
/doc-smith-publish --hub https://custom.hub.io
```

**Features:**
- One-click publish to DocSmith Cloud
- Automatic asset upload and optimization
- Returns online preview URL

## Workspace Structure

DocSmith creates a workspace in `.aigne/doc-smith/` directory with its own git repository:

```
my-project/                            # Your project directory (cwd)
├── .aigne/
│   └── doc-smith/                     # DocSmith workspace (independent git repo)
│       ├── config.yaml                # Workspace configuration
│       ├── intent/
│       │   └── user-intent.md         # User intent description
│       ├── planning/
│       │   └── document-structure.yaml # Document structure plan
│       ├── docs/                      # Document metadata
│       │   └── overview/
│       │       └── .meta.yaml         # Metadata (kind/source/default)
│       ├── dist/                      # Built HTML output
│       │   ├── index.html             # Redirect to default language
│       │   ├── zh/
│       │   │   ├── index.html
│       │   │   └── docs/
│       │   │       └── overview.html
│       │   ├── en/
│       │   │   ├── index.html
│       │   │   └── docs/
│       │   │       └── overview.html
│       │   └── assets/
│       │       ├── docsmith.css       # Built-in styles
│       │       ├── theme.css          # User theme
│       │       └── nav.js            # Navigation data (sidebar + language switcher)
│       ├── assets/                    # Generated image assets
│       │   └── architecture/
│       │       ├── .meta.yaml
│       │       └── images/
│       │           ├── zh.png
│       │           └── en.png
│       └── cache/                     # Temporary data (not in git)
├── src/                               # Project source code (data source)
└── ...
```

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

Elastic-2.0 License
