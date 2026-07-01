# Lightweight Skills

This build removes MCP and RAG tool injection and replaces them with a local Skills runtime and optional workspace sandbox.

## Discovery

Skills are discovered from:

- Built-in `workspace-files`
- `userData/skills/**/SKILL.md`
- **Configured third-party paths** (`settings.skills.externalSkillRoots`, one directory per line)
- Implicit extra roots: `.agents/skills`, `.cursor/skills` (project cwd and home)

Each skill folder contains `SKILL.md` with YAML frontmatter (`name`, `description`). Optional `disable: true` excludes a skill from auto-enable.

Skills found under `externalSkillRoots` are tagged `source.type = external` in the UI.

## Tool environment (optional)

`settings.skills.environmentRoot` points to a directory with:

- `BINS/ai_bin_*` — executed via `run_ai_bin`
- `env.sh` — sourced by launchers when present (override path via `envShPath`)

When empty, `run_ai_bin` is not registered and no `<tool_environment>` block is injected.

Legacy settings `aiEnvRoot` / `aiEnvSkillsEnabled` are migrated automatically into `externalSkillRoots` + `environmentRoot`.

## Progressive disclosure

1. `buildToolsForSession()` injects `<available_skills>` and optional `<tool_environment>`.
2. `load_skill` fetches full markdown (`$AI_ENV_ROOT` placeholders use `environmentRoot`).
3. `run_ai_bin` runs whitelisted launchers under `{environmentRoot}/BINS/`.
4. `run_skill_script` runs skill `scripts/` via configured interpreters.
5. Workspace and sandbox tools operate on the per-session directory.

## Security model

See README **Security & Sandbox Disclaimer**. Policy lists and workspace scoping target **accident prevention**, not malicious-code containment.

## Settings schema (`settings.skills`)

- `externalSkillRoots`, `environmentRoot`, `envShPath`
- `enabledSkillNames`, allow/deny lists for skills, scripts, bins
- `revisionAuthor`, `pythonInterpreter`, `nodeInterpreter`, `envFilePath`
- `sandboxParentDir`, `globalMemoryEnabled`, `globalMemoryPath`
- `timeoutMs`, `maxOutputBytes`

## IPC surface

- `skills:discover`, `skills:load`, `skills:run-script`, `skills:run-ai-bin`
- `skills:resolve-ai-env-root` (resolves `environmentRoot`), workspace + global memory helpers
- `sandbox:diagnose` (debug packaged sandbox-runtime loading)

## Removed capabilities

- MCP server management and tool merge
- Knowledge Base RAG toolset
- Session Attachment RAG indexing and retrieval tools
