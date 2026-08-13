---
type: Architecture overview
title: ArgusWiki Architecture Overview
description: Explains ArgusWiki's layered CLI, agent, provider, connector, authentication, and ingestion architecture, including runtime execution and persistence. Identifies core source modules, extension points, and operational considerations for maintaining ArgusWiki.
tags: [architecture, cli, agent, providers, connectors, ingestion]
---

# Architecture overview

ArgusWiki has a small but layered architecture:

1. `src/cli.tsx` provides the interactive terminal application and orchestrates runs, including auto-exit for init/update.
2. `src/commands.ts` parses argv and defines help text and supported options, including `auth`, `ngrok`, `cron`, and `ingest` subcommands.
3. `src/credentials.tsx` manages interactive onboarding. It still contains the generic provider-selection/API-key/model-selection/LangSmith-tracing UI scaffolding from the upstream multi-provider version, but that path is effectively dead: `SELECTABLE_ARGUSWIKI_PROVIDERS` is empty and the sole provider (`claude-cli`) is keyless, so there is nothing to prompt for except the optional LangSmith key.
4. `src/env.ts` reads and writes `~/.arguswiki/.env` and surfaces credential diagnostics for every managed key — including a long list of legacy provider API-key/OAuth-token keys (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, Vertex, ChatGPT OAuth) that are still tracked for env-file hygiene/diagnostics but are not read by any active provider.
5. `src/agent/index.ts` runs the documentation agent: loads env, syncs bundled skills, checks the update-noop condition, collects Git context, and always dispatches to the `claude-cli` backend (there is no other provider to resolve to).
6. `src/agent/prompt.ts` builds the system and user prompts that tell the model how to behave.
7. `src/agent/utils.ts` gathers Git evidence, computes an ArgusWiki content snapshot, and records `.last-update.json` after successful init/update runs.
8. `src/agent/skills.ts` syncs the bundled `skills/` directory (`migrate-wiki-to-okf`, `write-connector`) into `~/.arguswiki/skills` on every run.
9. `src/auth/` contains the connector OAuth system: `oauth.ts` (generic runner), `providers.ts` (provider configs), `configure.ts` (`openwiki auth configure`), `ngrok.ts` (Slack HTTPS tunnel), `tokens.ts` (refresh/validation), and `types.ts`. This is connector auth (Gmail/Notion/Slack/X), unrelated to model-provider auth.
10. `src/connectors/` contains the connector registry, MCP client/runtime, source-specific ingestion modules (git-repo, gmail, hackernews, slack, web-search, x), and tool definitions exposed to the agent.
11. `src/ingestion.ts` orchestrates source ingestion runs across configured connectors.
12. `src/code-mode.ts` handles `openwiki code` setup: writes a GitHub Actions workflow and AGENTS.md/CLAUDE.md snippets.
13. `src/constants.ts` centralizes the (now single-provider) provider config, model options, environment keys, validation helpers, and the wiki directory names.
14. `src/agent/types.ts` defines shared types: `ArgusWikiCommand`, `RunContext`, `UpdateMetadata`, and run option/event interfaces.

## Runtime shape

The CLI starts in `src/cli.tsx`, parses the command, and then either:

- prints help and exits,
- opens the interactive chat UI,
- runs an init/update command against the current repository, or
- performs a dry-run in development mode.

For non-chat runs, the agent receives a `RunContext` that includes last-update metadata and a Git summary generated from:

- `git status --short`
- `git rev-parse HEAD`
- `git log --max-count=20 --name-status --oneline` (init, or update without prior metadata)
- `git log <lastHead>..HEAD --name-status --oneline` (update with a recorded `gitHead`)
- `git log --since <updatedAt> --name-status --oneline` (update with only a timestamp)
- `git diff --name-status HEAD`

### Provider resolution (single provider only)

This fork removed the upstream multi-provider stack. `resolveConfiguredProvider()` in `src/constants.ts` still exists but is now trivial: it normalizes `ARGUSWIKI_PROVIDER` and falls back to `DEFAULT_PROVIDER`, and both resolve to the same value because `ArgusWikiProvider` has exactly one member — `"claude-cli"`. There is no fallback chain over provider API keys anymore (the old OpenAI/OpenRouter/Anthropic/Baseten/Fireworks/NVIDIA order is gone from source, even though some docs and `README.md` still describe it).

`src/agent/index.ts` has no `createModel()` function and no per-provider model-creation branches. It always calls `runClaudeCliAgent()` (`src/agent/claude-cli/claude-cli-backend.ts`), which spawns the operator's already-authenticated `claude` CLI binary as a subprocess. It has its own prompt builder (`src/agent/claude-cli/prompt.ts`) and enforces the docs-only write restriction via a `PreToolUse` hook (`write-guard-hook.ts` / `write-guard.ts`). It is keyless (no API key/OAuth) — `resolveConfiguredProvider()` is called only for debug logging — and v1 scope supports only `repository` output mode; passing `local-wiki` throws. See [Agent workflow](../agent/workflow.md) for the full flow.

### No DeepAgents backend

There is no DeepAgents `LocalShellBackend`, virtual filesystem, or SQLite-checkpointed conversation thread in this fork's run path — those were part of the removed LangChain/LangGraph execution core. The spawned `claude` CLI subprocess uses its own native filesystem tools (Read/Write/Edit/Bash/Grep/Glob) against real repository paths instead. A `resolveCheckpointTarget()` helper and an `arguswiki.sqlite` checkpoint path still exist in `src/agent/index.ts`, but nothing in the current run path calls it — treat it as unused legacy code, not an active mechanism, unless a source change proves otherwise.

### Content snapshot and metadata writes

After a non-chat run completes, `src/agent/utils.ts` computes a SHA-256 snapshot of the `openwiki/` directory (excluding `.last-update.json`). Metadata is written **only if the snapshot changed** — a no-op update that leaves docs untouched will not update `.last-update.json`. This prevents endless update loops in scheduled workflows.

### Auto-exit behavior

`shouldAutoExitStartupRun()` in `src/cli.tsx` determines whether a startup run should exit automatically on success. This applies to `--init` and `--update` commands (without `--print`) when run in a TTY: the CLI launches the run, renders streaming output, and exits with code 0 on success. Chat runs and `--print` runs are unaffected.

## Why the architecture is shaped this way

The current design reflects a documentation product rather than a general-purpose agent framework:

- The CLI owns user experience and credential bootstrap so the tool is install-and-run friendly.
- Git evidence is collected in the host process before the agent starts so the model sees stable repository context.
- The provider abstraction (`ArgusWikiProvider`, `PROVIDER_CONFIGS`) is kept in `src/constants.ts` even with a single member, so the codebase still has a defined seam if a provider were ever reintroduced — but doing so today means restoring the removed model-client code, not just a config edit.
- Model execution goes through a single subprocess CLI call: `claude` handles its own retry/model behavior internally, and ArgusWiki surfaces the final `claude` CLI result (or error) rather than retrying across model clients itself.
- The content-snapshot check prevents metadata churn when an update run produces no documentation changes, which is important for scheduled CI workflows.
- Auto-exit for init/update makes the CLI usable in both interactive and one-shot contexts without requiring `--print`.

## Major extension points

- Add or refine CLI commands in `src/commands.ts` and the corresponding UI behavior in `src/cli.tsx`.
- Change onboarding or local credential storage in `src/credentials.tsx` and `src/env.ts` (note: the interactive provider-selection UI in `src/credentials.tsx` is currently unreachable — there is nothing to select).
- Extend the documentation prompt or Git evidence in `src/agent/claude-cli/prompt.ts` and `src/agent/utils.ts`.
- Modify run persistence or snapshot behavior in `src/agent/utils.ts`.
- Add or change a bundled skill under `skills/` and `src/agent/skills.ts`.

## Things to watch when editing

- `src/cli.tsx` and `src/commands.ts` must stay aligned; help text and parser behavior are intentionally coupled.
- Credential setup writes to a real home-directory file, so permission handling matters.
- `openwiki/` in the target repository is both the docs output location and the metadata location for `.last-update.json`.
- The content-snapshot logic excludes `.last-update.json`; if new metadata files are added under `openwiki/`, decide whether they should be excluded too.
- **`local-wiki` output mode (personal/connector-synthesis mode) currently throws.** `runClaudeCliAgent()` unconditionally rejects any `outputMode` other than `"repository"`, but `openwiki personal --init/--update` and the synthesis step of `openwiki ingest` both request `local-wiki`. Confirm this is still the case (`src/agent/claude-cli/claude-cli-backend.ts`) before relying on personal-mode or ingestion-synthesis docs elsewhere in this wiki as descriptions of currently-working behavior; they describe the intended/upstream design, not a verified-working path under this fork.

## Source map

- `src/cli.tsx`
- `src/commands.ts`
- `src/credentials.tsx`
- `src/env.ts`
- `src/agent/index.ts`
- `src/agent/utils.ts`
- `src/agent/types.ts`
- `src/agent/skills.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/agent/claude-cli/prompt.ts`
- `src/agent/claude-cli/write-guard.ts`
- `src/agent/claude-cli/write-guard-hook.ts`
- `src/auth/oauth.ts`
- `src/auth/providers.ts`
- `src/auth/configure.ts`
- `src/auth/ngrok.ts`
- `src/auth/tokens.ts`
- `src/auth/types.ts`
- `src/connectors/registry.ts`
- `src/connectors/tools.ts`
- `src/connectors/types.ts`
- `src/ingestion.ts`
- `src/code-mode.ts`
- `src/constants.ts`
- `package.json`
