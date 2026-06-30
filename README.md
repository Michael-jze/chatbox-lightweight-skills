# Chatbox Community Edition (Lightweight Skills Fork)

A local fork of [Chatbox Community Edition](https://github.com/chatboxai/chatbox) that removes MCP and RAG in favor of a **lightweight local Skills runtime** for controlled desktop script execution and progressive skill disclosure.

> For the upstream README (downloads, full feature list, contribution guide), see [README_OLD.md](./README_OLD.md).

---

## What Changed in This Fork

### Removed

| Capability | Notes |
|------------|--------|
| **MCP** | Settings, input menus, tool injection, and dependencies such as `@modelcontextprotocol/sdk` |
| **Knowledge Base RAG** | Persistent knowledge base, retrieval tools, UI, and main-process logic |
| **Session Attachment RAG** | Session attachment vector indexing and retrieval tools |
| **Skills marketplace / GitHub install** | Local `SKILL.md` discovery and execution only |

Chat tools that remain: **file reading** (large attachments), **web search**, **Task-mode sandbox** (when enabled), and the new **Skills** stack.

### Added: Lightweight Skills Runtime

On desktop (`featureFlags.skills`), models interact with local skills via tools:

| Tool | Purpose |
|------|---------|
| `load_skill` | Load full `SKILL.md` body by name (progressive disclosure) |
| `run_skill_script` | Run scripts from a skill’s `scripts/` folder inside the session workspace (Python / Node) |

**Built-in system skill**

- `workspace-files` — read/write text files in the current session workspace (`read_file.js` / `write_file.js`); no user install required.

**Skill discovery paths**

- `userData/skills/**/SKILL.md` (app data directory; open from Settings)
- Optional scan: `~/.agents/skills`, `~/.cursor/skills`, project `.agents/skills` / `.cursor/skills`

**Safety and control (accident prevention, not anti-malware)**

- Allow/deny lists for skill names and script names
- **Fixed workspace directory per conversation** (unchanged when starting a new topic in the same session)
- Configurable **global workspace parent path**, or pick a folder when creating a chat
- Scripts run only via configured **Python / Node** interpreters; `shell: false`
- Environment variables loaded from an external **JSON file path** (`envFilePath`); no secrets embedded in the UI

**Global Memory**

- Editable under **Settings → Skills** (default file: `userData/global-memory.txt`)
- Describes user identity and assistant tone; injected as `<global_memory>` on every conversation when enabled

See [docs/technical/lightweight-skills.md](./docs/technical/lightweight-skills.md) for implementation details.

### Dependency changes (summary)

Removed from `package.json`, for example:

- `@ai-sdk/mcp`, `@modelcontextprotocol/sdk`
- `@mastra/core`, `@mastra/rag`, `@mastra/libsql`, `@libsql/client`
- Session RAG eval scripts

`@anthropic-ai/sandbox-runtime` remains for Task mode (macOS `sandbox-exec` / Linux bubblewrap). Skills script execution uses a separate, lighter path.

---

## Configuring Skills (Desktop)

1. Open **Settings → Skills**
2. **Global workspace parent directory** — parent for per-session temp folders (empty = system temp)
3. **Script environment file** — path to a JSON file (key/value pairs merged into the child process env)
4. **Global Memory** — edit and save identity / tone template
5. Enable skills under **User Skills**; **Built-in Skills** are on by default
6. User skill folder: open from Settings, or place skills under `~/.cursor/skills`, etc.

**Example user skill layout**

```
my-skill/
├── SKILL.md          # required; name / description in YAML frontmatter
└── scripts/
    └── run.py        # invoked via run_skill_script
```

**Conversation workspace**

- **Skill workspace** above the input on the home page or in a session — pick a folder before the first message
- If unset: `{parent}/chatbox-skills/{sessionId}`

---

## Development & Build

### Requirements

- Node.js `>=22.12.0 <25`
- pnpm `>=10.17`

### Common commands

```bash
pnpm install
pnpm dev              # development with hot reload
pnpm run build        # compile to release/app/dist/
pnpm run package      # platform installer → release/build/
pnpm run test         # unit tests
pnpm run check        # TypeScript check
```

### Key code locations

```
src/main/skills/          # discovery, IPC, runner, built-in skills, Global Memory
src/shared/skills/        # policy, workspace path resolution
src/renderer/packages/skills/
src/renderer/stores/session/tools-builder.ts   # tool injection
src/renderer/components/settings/skills/       # settings UI
```

---

## Relationship to Upstream

- Upstream: **Chatbox Community Edition** (GPLv3)
- This repo is an **experimental / personal fork** (feature trim + Skills runtime); **not** guaranteed to stay in sync with upstream or pro
- Original badges, download links, Star History, etc.: [README_OLD.md](./README_OLD.md)

---

## License

Same as upstream — see [LICENSE](./LICENSE).
