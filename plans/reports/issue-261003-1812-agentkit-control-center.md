# Control Center: "Kit list unavailable" without ./kits, and native global installs show 0 kits / 0 skills / 0 MCP servers

## Environment

- ak CLI and Control Center app: 2.19.1-beta.1 (channel: beta)
- OS: macOS (darwin/arm64), zsh
- Kits: `engineer` and `marketing`, remote and licensed (`/api/account/licenses` reports both `active`)
- Install mode: native, global, target `claude-code` (`ak kit init <kit> --remote --target claude-code --global --force`)
- Dashboard started with `ak config` (HTTP mode, 127.0.0.1:8766)

## Bug 1: Kit list fails when `./kits` does not exist

The Kits page shows a red "Kit list unavailable" banner and `GET /api/kits` returns:

```json
{"error":"list kits: gui kits: open kits dir \"./kits\": kitsource: resolving root \"./kits\": lstat kits: no such file or directory"}
```

The CLI fails the same way from any directory:

```
$ ak kit list-kits --verbose
Error: list-kits: cannot open kit source "./kits": kitsource: resolving root "./kits": lstat kits: no such file or directory
```

The local kits directory defaults to `$AGENTKIT_KITS_DIR` or `./kits`. Users who install remote, licensed kits have no local kit-source directory, so the dashboard should skip local kits instead of failing the whole list.

**Workaround:** create an empty directory and point the variable at it before starting the dashboard:

```bash
mkdir -p ~/.agentkit/kits
AGENTKIT_KITS_DIR="$HOME/.agentkit/kits" ak config
```

With this, `/api/kits` returns `{"kits":[],"total":0}` and the banner disappears.

**Expected:** a missing local kits directory is treated as "no local kits", not as an error.

## Bug 2: Native global installs are not detected, so the dashboard shows 0 kits, 0 skills and 0 MCP servers

After the workaround, the dashboard loads, but:

- Kits page: "Global: 0 installed / No global kit installs detected". Both licensed kits still show an **Install** button.
- Sidebar: Skills = 0, MCP Servers = 0.
- `GET /api/browsers/mcp-servers` returns `{"mcp_servers":[],"total":0}`.

Yet on the same machine:

- `~/.agentkit/adapters/claude-code/` contains `engineer` (1109 files) and `marketing` (696 files), written by `ak kit init ... --global`.
- `~/.claude/skills/` contains 193 skills, and the `ak-*` skills load and work in Claude Code.
- `claude mcp list` reports 17 connected MCP servers.
- `ak update --global` succeeds: "global update complete: 2 kit(s) ... updated".
- `ak doctor` reports `[OK] install provenance  marker matches installed kit` and `[OK] mixed install mode`, but also `[i] Installed kits: no kits installed`.

Subagents (76), Commands (2), Sessions and Usage do show data, so the dashboard can read `~/.claude` in general. Only kit, skill and MCP detection is empty.

**Expected:** native global installs appear under "Global", the skills and MCP servers are listed, and Install is not offered for kits that are already installed. Pressing Install today re-runs a forced install that overwrites user-modified files.

## Related: `ak update` from a non-AgentKit directory

Running `ak update --channel beta --yes` inside a project that has no AgentKit manifest fails with:

```
Error: update: cannot infer kits from this project: ownership: manifest not found; run `ak init` first, or pass `--kits <id>` for an explicit project kit refresh
```

It should update the global kits and skip the project step, as the interactive wizard does ("current directory is not an AgentKit project; skipped"). `ak update --global` works.

## Related: misleading message when the session has expired

With an expired login, `ak update` reported "the registry has no package on the requested channel for this kit/runtime, and the local cache is on a different channel". The real cause only appears in the support report: `Session refresh expired. Run 'ak login' again.` The main message should say to run `ak login`.

## Related: forced reinstall overwrites user rules

`ak kit init engineer --remote --target claude-code --global --force` overwrote `~/.claude/rules/development-rules.md` and removed user-added rules. The pre-overwrite backup (`ak backups`) only covered `~/.agentkit/...`, so the file could not be restored from it. Other user-modified files were preserved ("preserving modified owned native file ..."), but this one was not.
