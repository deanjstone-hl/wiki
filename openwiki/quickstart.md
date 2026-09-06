---
type: Quickstart Guide
title: ArgusWiki Quickstart
description: Quickstart reference for the ArgusWiki TypeScript CLI, including documentation-generation workflows, the single keyless claude-cli model provider, and the primary source files. Use it to navigate the repository's architecture, commands, agent runtime, operations, and connectors.
tags: [arguswiki, quickstart, cli, documentation]
---

# ArgusWiki quickstart

ArgusWiki is a TypeScript CLI that writes and maintains documentation for a repository using an agent-driven workflow. The package exposes a single `openwiki` binary (the command name itself was not renamed in the OpenWiki→ArgusWiki rebrand), stores local credentials in `~/.arguswiki/.env`, and records successful update metadata in `openwiki/.last-update.json`.

## What this repository does

- Launches an interactive Ink-based terminal app for chatting with the ArgusWiki agent.
- Supports one-shot documentation runs with `--init`, `--update`, and `--print`.
- Runs on a single, keyless model provider: `claude-cli` spawns the operator's already-authenticated `claude` CLI binary as a subprocess. This fork removed the upstream multi-provider stack (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, Vertex AI, ChatGPT OAuth) and its DeepAgents/LangGraph execution core entirely — see [Agent workflow](./agent/workflow.md) and [deanjstone/argus-wiki#35](https://github.com/deanjstone/argus-wiki/issues/35). `README.md` and parts of `src/credentials.tsx` still describe the old multi-provider onboarding; treat those as stale relative to `src/constants.ts`, where `ArgusWikiProvider` is now narrowed to `"claude-cli"` only.
- Uses the spawned `claude` CLI's own native filesystem tools (Read/Write/Edit/Bash/Grep/Glob) operating on real repository paths, not a virtual filesystem — there is no DeepAgents `LocalShellBackend` in this fork.
- Creates or refreshes documentation under the target repository's `arguswiki/` directory by default (`OPEN_WIKI_DIR`, overridable via `ARGUSWIKI_OUTPUT_DIR`); this repository's own docs stay under `openwiki/` via an explicit override — see [Credentials and updates](./operations/credentials-and-updates.md).
- Auto-exits after successful `--init` or `--update` runs in an interactive terminal, so the CLI works as both a one-shot and interactive tool.
- Optionally schedules automated updates through GitHub Actions (see `examples/arguswiki-update.yml`).

## Start here

- [Architecture overview](./architecture/overview.md) — runtime structure, major modules, and execution flow.
- [CLI usage](./cli/usage.md) — commands, options, model/provider selection, and credential bootstrap.
- [Agent workflow](./agent/workflow.md) — how documentation runs are assembled and persisted.
- [Credentials and updates](./operations/credentials-and-updates.md) — local env storage, metadata, and scheduled updates.
- [Connectors](./integrations/connectors.md) — built-in connector architecture, the seven connectors, and ingestion orchestration.

## Key source files

- `README.md` — user-facing installation and usage summary.
- `package.json` — bin entrypoint, scripts, and dependencies.
- `src/cli.tsx` — Ink UI, command execution, auto-exit, and run lifecycle.
- `src/commands.ts` — CLI parsing and help content.
- `src/agent/index.ts` — agent runtime entrypoint: loads env, syncs bundled skills, checks the update-noop condition, then always dispatches to the `claude-cli` backend.
- `src/agent/prompt.ts` — prompt assembly, documentation-run instructions, and AGENTS.md/CLAUDE.md insertion rules.
- `src/agent/utils.ts` — git evidence collection, content snapshot, and `.last-update.json` handling.
- `src/agent/types.ts` — shared agent types (`ArgusWikiCommand`, `RunContext`, `UpdateMetadata`, run options/events).
- `src/agent/skills.ts` — syncs the bundled `skills/` directory (`migrate-wiki-to-okf`, `write-connector`) into `~/.arguswiki/skills` on every run.
- `src/agent/claude-cli/` — the sole provider backend: spawns the operator's authenticated `claude` CLI as a subprocess instead of calling a hosted API, with its own prompt builder and an out-of-band `PreToolUse` write guard. See [Agent workflow](./agent/workflow.md#claude-code-cli-provider).
- `src/auth/oauth.ts` — generic OAuth runner for connector providers (Gmail, Notion, Slack, X).
- `src/auth/providers.ts` — connector OAuth provider configs (scopes, token URLs, env-key mappings).
- `src/auth/configure.ts` — `openwiki auth configure <provider>` flow for creating local connector configs.
- `src/auth/ngrok.ts` — Slack HTTPS callback tunnel via ngrok.
- `src/auth/tokens.ts` — token refresh and validation helpers for connector OAuth.
- `src/connectors/` — connector registry, MCP client/runtime, source-specific ingestion (git-repo, gmail, hackernews, slack, web-search, x), and tool definitions.
- `src/ingestion.ts` — orchestrates source ingestion runs across configured connectors.
- `src/code-mode.ts` — `openwiki code` setup: writes GitHub Actions workflow and AGENTS.md/CLAUDE.md snippets.
- `src/env.ts` — `~/.arguswiki/.env` persistence and credential diagnostics; base directory is overridable via `ARGUSWIKI_HOME`.
- `src/credentials.tsx` — interactive onboarding flow for provider selection, API keys, and model selection.
- `src/constants.ts` — provider configs, model options, env keys, and validation helpers.
- `examples/arguswiki-update.yml` — GitHub Actions scheduled automation example.

## Documentation map

- [Architecture](./architecture/overview.md)
- [CLI](./cli/usage.md)
- [Agent](./agent/workflow.md)
- [Operations](./operations/credentials-and-updates.md)
- [Connectors](./integrations/connectors.md)

## Notes for future agents

- The repository is intentionally focused: the main product surface is the CLI plus the documentation-generation agent.
- This package now lives at `apps/wiki` inside the `deanjstone/argus` monorepo; it was subtree-split-merged out of `deanjstone/argus-context` (see the `!apps/wiki` exclusion and its comment in the monorepo's root `pnpm-workspace.yaml`). The package keeps its own nested pnpm workspace and lockfile, so install/build/test run from `apps/wiki`, not from the root workspace. The package's own `CLAUDE.md` still describes it as `packages/wiki` inside `argus-context` — treat that location claim as stale.
- Treat `openwiki/` in this repo as generated documentation output from a future ArgusWiki run, not as application source (this repo overrides the default output directory name — see [Credentials and updates](./operations/credentials-and-updates.md)).
- When changing behavior, verify both the CLI parser and the agent prompt/runtime, because user-visible semantics are split across `src/commands.ts`, `src/cli.tsx`, and `src/agent/*`.
- Provider config lives in `src/constants.ts`, but `ArgusWikiProvider` is narrowed to the single `"claude-cli"` member and `PROVIDER_CONFIGS` has one entry — there is no model-creation branch to extend in `src/agent/index.ts` anymore. Re-adding another provider would mean restoring the removed multi-provider stack, not just editing a config table.

## Source map

- `README.md`
- `package.json`
- `src/cli.tsx`
- `src/commands.ts`
- `src/agent/index.ts`
- `src/agent/prompt.ts`
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
- `src/connectors/mcp-client.ts`
- `src/connectors/mcp-runtime.ts`
- `src/connectors/io.ts`
- `src/connectors/sources/git-repo.ts`
- `src/connectors/sources/gmail.ts`
- `src/connectors/sources/hackernews.ts`
- `src/connectors/sources/mcp.ts`
- `src/connectors/sources/slack.ts`
- `src/connectors/sources/web-search.ts`
- `src/connectors/sources/x.ts`
- `src/ingestion.ts`
- `src/code-mode.ts`
- `src/env.ts`
- `src/arguswiki-home.ts`
- `src/credentials.tsx`
- `src/constants.ts`
- `examples/arguswiki-update.yml`
- Git evidence: commits `ceded10`, `f89b05d`, `a82759f`, `dfa73cc`, `fd3a702`, `8278c36`, `0fa1430`, `070a382`, `5210cc4`, `9f2c252`, `7c3d1df`
