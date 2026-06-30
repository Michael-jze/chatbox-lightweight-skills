---
name: workspace-files
description: Read and write text files in the current conversation workspace directory. Use for saving outputs, reading prior results, or editing workspace artifacts. Paths are relative to the session workspace root.
---

# Workspace Files (built-in)

Scripts run in the **session workspace** (`SKILL_SANDBOX_DIR`). Use paths **relative to the workspace root** only.

Requires `run_skill_script` (session must have a workspace directory — pick one in the input area or use the default sandbox).

## read_file

```text
run_skill_script skill_name=workspace-files script_name=read_file.js arguments=["notes.md"]
run_skill_script skill_name=workspace-files script_name=read_file.js arguments=["subdir/report.txt", "100", "50"]
```

Optional args: `path`, `line_offset` (default 0), `max_lines` (default 500).

## write_file

```text
run_skill_script skill_name=workspace-files script_name=write_file.js arguments=["notes.md", "Hello world"]
run_skill_script skill_name=workspace-files script_name=write_file.js arguments=["notes.md", "append line", "append"]
```

Third arg `mode`: `overwrite` (default) or `append`.

## If write is unavailable

- Reply with the full text in chat for the user to save manually.
- For structured handoff, write markdown under `{session_workspace}/search_requests/` (search-relay skill).
- For document output, use `ai_bin_pandoc` or other AI_Envirionment bins after `load_skill`.
