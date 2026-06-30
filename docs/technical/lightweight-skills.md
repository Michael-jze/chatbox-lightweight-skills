# Lightweight Skills

This build removes MCP and RAG tool injection and replaces them with a local Skills runtime integrated with `~/AI_Envirionment/`.

## Discovery

Skills are discovered from:

- Built-in `workspace-files`
- `userData/skills/**/SKILL.md`
- `{aiEnvRoot}/SKILLS/**/SKILL.md` when AI Environment mount is enabled (default `~/AI_Envirionment`)
- Optional extra roots: `.agents/skills`, `.cursor/skills`, `~/.agents/skills`, `~/.cursor/skills`

Each skill folder contains a `SKILL.md` file with YAML frontmatter (`name`, `description`). Optional `disable: true` excludes a skill from auto-enable.

## Progressive disclosure

1. `buildToolsForSession()` injects `<available_skills>` metadata for enabled skills plus `<ai_environment>` tool hints.
2. Models with tool use receive `load_skill` to fetch the full markdown body on demand (with `$AI_ENV_ROOT` and WorkBuddy placeholders expanded).
3. `run_ai_bin` executes `AI_Envirionment/BINS/ai_bin_*` launchers (they source `env.sh` internally).
4. `run_skill_script` executes scripts from a skill's `scripts/` directory (built-in workspace-files).

## Security model

- **Allow/deny lists** in Settings → Skills for skill names, script names, and ai_bin names.
- **Session sandbox directory** — one stable folder per conversation.
- **ai_bin whitelist** — only `ai_bin_*` files under `{aiEnvRoot}/BINS/`.
- No arbitrary shell execution (`shell: false`, bash invokes known launcher path only).

## Settings schema

`settings.skills` stores:

- `aiEnvRoot`, `aiEnvSkillsEnabled`, `envShPath`
- `enabledSkillNames`, allow/deny lists for skills, scripts, bins
- `revisionAuthor` (Word track changes, replaces WorkBuddy)
- `pythonInterpreter`, `nodeInterpreter`, optional `envFilePath` (JSON, for run_skill_script only)
- `sandboxParentDir`, `globalMemoryEnabled`, `globalMemoryPath`
- `timeoutMs` (default 120s for paper tooling), `maxOutputBytes`

## IPC surface

- `skills:discover`, `skills:load`, `skills:run-script`, `skills:run-ai-bin`
- `skills:resolve-ai-env-root`, `skills:ensure-workspace`, `skills:cleanup-session`
- Global memory and directory helpers

## Removed capabilities

- MCP server management and tool merge
- Knowledge Base RAG toolset
- Session Attachment RAG indexing and retrieval tools
