# Chatbox Lightweight Skills Fork

A fork of [Chatbox Community Edition](https://github.com/chatboxai/chatbox) that removes MCP and RAG in favor of a **lightweight local Skills runtime** — progressive skill disclosure, session workspaces, optional sandbox shell tools, and configurable third-party skill directories.

> Upstream README (downloads, badges, contribution guide): [README_OLD.md](./README_OLD.md)

---

## What This Fork Does

### Removed

| Capability | Notes |
|------------|--------|
| **MCP** | Settings, tool injection, `@modelcontextprotocol/sdk`, etc. |
| **Knowledge Base RAG** | Persistent KB, retrieval tools, UI |
| **Session Attachment RAG** | Vector indexing and retrieval on attachments |
| **Skills marketplace / GitHub install** | Local `SKILL.md` discovery only |

### Added: Lightweight Skills (desktop)

| Tool | Purpose |
|------|---------|
| `load_skill` | Load full `SKILL.md` body on demand |
| `run_skill_script` | Run scripts from a skill's `scripts/` folder (Python / Node, `shell: false`) |
| `run_ai_bin` | Run `ai_bin_*` launchers from a configured **tool environment root** (`BINS/`, optional `env.sh`) |
| `workspace_read` / `workspace_write` / `workspace_ls` | Session workspace file I/O without sandbox |
| `sandbox_*` | When workspace sandbox initializes successfully: `sandbox_bash`, `sandbox_read`, `sandbox_write`, `sandbox_ls`, etc. |

Built-in skill: **`workspace-files`** (read/write helpers in the session workspace).

---

## Configuring Skills

Open **Settings → Skills**.

### Third-party skill paths

One directory per line. Each path is scanned recursively for `SKILL.md` trees. **No path is hardcoded** — configure your own layout, for example:

```text
~/my-tools/SKILLS
~/.cursor/skills
~/AI_Envirionment/SKILLS
```

Also scanned automatically (no config needed): `~/.cursor/skills`, `~/.agents/skills`, and project `.cursor/skills` / `.agents/skills`.

App user skills: `userData/skills/` (open from Settings).

### Tool environment root (optional)

Directory that contains `BINS/` (with `ai_bin_*` launchers) and optionally `env.sh`. When set, enables `run_ai_bin` and injects tool-environment hints into the model prompt. Leave **empty** to disable `ai_bin` tools.

Example layout:

```text
my-tool-environment/
├── SKILLS/          ← add this path under "Third-party skill paths"
├── BINS/
│   └── ai_bin_valyu
└── env.sh
```

### Other settings

- **Global workspace parent** — parent for per-session folders (`{parent}/chatbox-skills/{YYYYMMDD_HHmmss}`)
- **Script environment file** — optional JSON merged into child-process env
- **Global Memory** — identity / tone template (`userData/global-memory.txt` by default)
- **Allow/deny lists** — skill names, script names, `ai_bin` names
- **Sandbox Debug** — diagnose `sandbox-runtime` loading in packaged builds

See [docs/technical/lightweight-skills.md](./docs/technical/lightweight-skills.md) for implementation notes.

---

## Security & Sandbox Disclaimer

**Read this before enabling Skills, shell, or sandbox tools.**

This fork adds **local script execution** and optional **OS-level sandboxing** (`@anthropic-ai/sandbox-runtime`). These mechanisms are designed primarily to **reduce accidental damage** — wrong paths, mistaken `rm`, writing outside the session workspace, etc. They are **not** a substitute for anti-malware, intrusion prevention, or protection against a **malicious** model, skill author, or user who deliberately bypasses policy.

| Layer | What it helps with | What it does **not** guarantee |
|-------|-------------------|-------------------------------|
| **Allow/deny lists** | Block disallowed skill/script/bin names | A determined caller or confused model may still misuse *allowed* tools |
| **Session workspace** | Keeps default file tools scoped to one folder per chat | Does not sandbox the whole OS; other paths may still be reachable via misconfiguration or shell |
| **`run_skill_script`** | Fixed interpreters, `shell: false`, timeout/output caps | Running **untrusted** Python/Node code can still exfiltrate data or harm files the process can access |
| **`run_ai_bin`** | Only `ai_bin_*` under `{environmentRoot}/BINS/` | You are responsible for what those launchers execute |
| **`sandbox_bash` / `sandbox_*`** | Seatbelt/bubblewrap-style boundaries when init succeeds | **Not exploit-proof**; packaged-app module layout, network, and dependency issues can break init; malicious commands may still abuse allowed network or write rules |
| **Model tool use** | Policy is enforced at invocation time | Models can hallucinate tool args or chain allowed steps into harmful outcomes |

**You are responsible for:**

- Only installing skills and `ai_bin` launchers you trust  
- Reviewing allow/deny lists and workspace paths  
- Not exposing API keys in skills, env files, or chat logs  
- Understanding that **GPLv3 source is provided as-is, without warranty**

If you need strong isolation, use a dedicated VM or container and treat this client as **helper software**, not a security boundary.

---

## Development & Build

**Requirements:** Node.js `>=22.12.0 <25`, pnpm `>=10.17`

```bash
pnpm install
pnpm dev
pnpm run build
pnpm run package    # → release/build/
pnpm run test
pnpm run check
```

**Key paths:**

```text
src/main/skills/              discovery, IPC, runner, built-in skills
src/shared/skills/            policy, paths, settings migration
src/renderer/packages/skills/
src/renderer/stores/session/tools-builder.ts
src/renderer/components/settings/skills/
```

**Packaged sandbox note:** `electron-builder.yml` unpacks `@anthropic-ai/sandbox-runtime` and its ESM dependencies (`lodash-es`, etc.) so dynamic import works outside `app.asar`.

---

## Relationship to Upstream

- Based on **Chatbox Community Edition** ([GPLv3](./LICENSE))
- Experimental fork; not affiliated with or endorsed by the Chatbox team
- Not guaranteed to track upstream or Chatbox Pro

---

## Publishing This Fork

If you mirror this repository publicly:

1. Keep the GPLv3 license and state your changes  
2. Scan git history for secrets before the first public push  
3. Do not imply this is an official Chatbox release  
4. Include this security disclaimer in release notes  

---

## License

Same as upstream — see [LICENSE](./LICENSE).
