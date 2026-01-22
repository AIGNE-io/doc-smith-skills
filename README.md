# doc-smith-skills

English | [中文](./README.zh.md)

Claude Code Skills for AI-powered documentation generation and management.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed
- AIGNE CLI installed: `npm i -g @aigne/cli`

## Installation

### Quick Install (Recommended)

```bash
npx add-skill AIGNE-io/doc-smith-skills
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
/plugin install doc-smith-skills@doc-smith
```

**Option 3: Ask the Agent**

Simply tell Claude Code:

> Please install Skills from github.com/ArcBlock/doc-smith-skills

## Available Skills

| Skill | Description |
|-------|-------------|
| [doc-smith-create](#doc-smith-create) | Generate and update comprehensive documentation from workspace data sources |
| [doc-smith-images](#doc-smith-images) | Generate images using AI (diagrams, flowcharts, architecture diagrams) |
| [doc-smith-check](#doc-smith-check) | Validate documentation structure and content integrity |
| [doc-smith-localize](#doc-smith-localize) | Translate documents to multiple languages |
| [doc-smith-publish](#doc-smith-publish) | Publish documents to online platforms |
| [doc-smith-clear](#doc-smith-clear) | Clear site authorization and deployment configuration |

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
- Generates organized Markdown documentation
- Supports technical docs, user guides, API references, and tutorials

---

### doc-smith-localize

Translate documents to multiple languages with batch processing and terminology consistency.

```bash
# Translate all docs to English
/doc-smith-localize --lang en

# Translate to multiple languages
/doc-smith-localize --lang en --lang ja
```

**Features:**
- Batch translation with progress tracking
- Terminology consistency across documents
- Image text translation support
- Incremental translation (skip already translated)

---

### doc-smith-publish

Publish generated documents to online platforms.

```bash
# Publish to last used target (reads appUrl from config.yaml)
/doc-smith-publish

# Publish to specific URL
/doc-smith-publish --url https://example.com/docs
```

**Features:**
- Publish to ArcBlock-powered documentation sites
- Automatic asset upload and optimization
- Version management support

## Workspace Structure

DocSmith creates a workspace in `.aigne/doc-smith/` directory:

```
my-project/                            # Your project directory (cwd)
├── .aigne/
│   └── doc-smith/                     # DocSmith workspace
│       ├── config.yaml                # Workspace configuration
│       ├── intent/
│       │   └── user-intent.md         # User intent description
│       ├── planning/
│       │   └── document-structure.yaml # Document structure plan
│       ├── docs/                      # Generated documentation
│       │   ├── overview/
│       │   │   ├── .meta.yaml         # Metadata (kind/source/default)
│       │   │   ├── zh.md              # Chinese version
│       │   │   └── en.md              # English version
│       │   └── api/
│       │       └── authentication/
│       │           ├── .meta.yaml
│       │           ├── zh.md
│       │           └── en.md
│       ├── assets/                    # Generated images
│       │   └── architecture/
│       │       ├── .meta.yaml
│       │       └── images/
│       │           ├── zh.png         # Chinese version
│       │           └── en.png         # English version
│       └── cache/                     # Temporary data (not in git)
├── src/                               # Project source code (data source)
└── ...
```

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

Elastic-2.0 License
