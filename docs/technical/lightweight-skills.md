# Lightweight Skills

This build removes MCP and RAG tool injection and replaces them with a local Skills runtime.

## Discovery

Skills are discovered from:

- `userData/skills/**/SKILL.md`
- Optional extra roots: `.agents/skills`, `.cursor/skills`, `~/.agents/skills`, `~/.cursor/skills`

Each skill folder contains a `SKILL.md` file with YAML frontmatter (`name`, `description`).

## Progressive disclosure

1. `buildToolsForSession()` injects `<available_skills>` metadata for enabled skills.
2. Models with tool use receive `load_skill` to fetch the full markdown body on demand.
3. `run_skill_script` executes scripts from a skill's `scripts/` directory.

## Security model

This is intentionally lightweight:

- **Allow/deny lists** in Settings → Skills for skill names and script names.
- **Session sandbox directory** — one stable folder per conversation at `{parent}/chatbox-skills/<sessionId>` (or a user-picked path). Parent defaults to system temp; configurable in Settings → Skills. Unchanged when starting a new topic in the same conversation.
- **Interpreter control**: `.py` runs via configured Python path; `.js/.mjs/.cjs` via Node path.
- **Independent env**: JSON file at `envFilePath` merged into the child process environment.
- No shell execution (`shell: false`).

Scripts outside `.py` / `.js` / `.mjs` / `.cjs` are rejected.

## Settings schema

`settings.skills` stores:

- `enabledSkillNames`
- `allowSkillNames`, `denySkillNames`
- `allowScriptNames`, `denyScriptNames`
- `pythonInterpreter`, `nodeInterpreter`
- `envFilePath` — path to a JSON file merged into script env
- `sandboxParentDir` — default parent for per-session workspace folders
- `globalMemoryEnabled`, `globalMemoryPath` — persistent identity/tone text file

## IPC surface

Main process handlers:

- `skills:discover`
- `skills:load`
- `skills:run-script`
- `skills:cleanup-session`
- `skills:get-directory`
- `skills:open-directory`

## Removed capabilities

- MCP server management and tool merge
- Knowledge Base RAG toolset
- Session Attachment RAG indexing and retrieval tools

Attachments are always inlined or read through the file toolset.
