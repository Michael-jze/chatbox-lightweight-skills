---
name: workspace-files
description: Read and write text files in the current conversation workspace directory. Use for saving outputs, reading prior results, or editing workspace artifacts. Paths are relative to the session workspace root.
---

# Workspace Files (built-in)

Scripts run in the **session workspace** (`SKILL_SANDBOX_DIR`). Use paths **relative to the workspace root** only.

## Preferred tools (multi-line / long content)

Use **`workspace_write`** / **`workspace_read`** (or **`sandbox_write`** / **`sandbox_read`** when sandbox is available).

```text
workspace_write relative_path=notes.md content="# Title\n\nBody..."
workspace_read relative_path=notes.md
```

Do **not** put large markdown bodies inside `run_skill_script` `arguments` — JSON tool calls will fail.

## read_file (short reads via script)

```text
run_skill_script skill_name=workspace-files script_name=read_file.js arguments=["notes.md"]
```

Prefer `workspace_read` for most cases.

## write_file (single-line only via script)

```text
run_skill_script skill_name=workspace-files script_name=write_file.js arguments=["notes.md", "Hello world"]
```

For anything longer than one line, use **`workspace_write`**.

## If write is unavailable

- Reply with the full text in chat for the user to save manually.
- For structured handoff, write markdown under `{session_workspace}/search_requests/` (search-relay skill).
- For document output, use `ai_bin_pandoc` or other AI_Envirionment bins after `load_skill`.
