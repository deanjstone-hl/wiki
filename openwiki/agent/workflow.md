---
type: Technical documentation
title: Agent workflow
description: Explains the ArgusWiki documentation agent's command flow, provider and model setup, prompting rules, and update metadata behavior. Documents the agent's Git-grounded workflow, content snapshot safeguards, and source implementation map for maintaining agent behavior.
tags: [agent, workflow, documentation, providers, update-metadata]
---

# Agent workflow

The documentation agent is implemented in `src/agent/`. It takes a command (`chat`, `init`, or `update`), gathers repository context, builds prompts, spawns the `claude` CLI as a subprocess, and records successful update metadata — but only if the documentation content actually changed.

This fork removed the upstream multi-provider DeepAgents/LangGraph execution core (`deanjstone/argus-wiki#35`): there is no `createModel()`, no `ChatAnthropic`/`ChatOpenAI`/`ChatOpenRouter` client, and no DeepAgents `LocalShellBackend`. `src/agent/index.ts` and `src/agent/claude-cli/` are the entire current agent runtime.

## Main flow

`src/agent/index.ts` follows this sequence for every run (`chat`, `init`, and `update` alike):

1. Load `~/.arguswiki/.env` into `process.env`.
2. Sync the bundled `skills/` directory into `~/.arguswiki/skills` (`syncBundledSkills()`, `src/agent/skills.ts`).
3. For `update` runs without an explicit user message, check the update-noop condition (`getUpdateNoopStatus()`) and skip the run entirely if nothing changed since the last successful update.
4. Resolve the provider via `resolveConfiguredProvider()` — purely for a debug log line; it always resolves to `"claude-cli"`, the only member of `ArgusWikiProvider`.
5. Call `runClaudeCliAgent()` (`src/agent/claude-cli/claude-cli-backend.ts`). There is no other branch: every command, including `chat`, goes through this one function.

`runClaudeCliAgent()` then:

1. Rejects any `outputMode` other than `"repository"` (see [Claude Code CLI provider](#claude-code-cli-provider) below for what this breaks).
2. Builds a `RunContext` (`createRunContext()`) and a pre-run content snapshot (`createArgusWikiContentSnapshot()`), both from `src/agent/utils.ts`.
3. Builds the system/user prompt via `createClaudeCliSystemPrompt()`/`createClaudeCliUserPrompt()` (`src/agent/claude-cli/prompt.ts`).
4. Writes a temporary Claude Code `--settings` file registering the `PreToolUse` write-guard hook, then spawns `claude` as a subprocess with `--output-format json --permission-mode acceptEdits`.
5. On success, compares the post-run content snapshot to the pre-run one and writes `openwiki/.last-update.json` **only if the content changed** (`persistRunMetadataIfChanged()`).

Chat runs skip metadata writes because `persistRunMetadataIfChanged()` short-circuits on `command === "chat"`.

## Claude Code CLI provider

`claude-cli` is not a special-cased branch alongside other providers anymore — it **is** the agent runtime, implemented entirely in `src/agent/claude-cli/`:

- `claude-cli-backend.ts` (`runClaudeCliAgent()`) spawns the operator's already-authenticated `claude` CLI binary as a subprocess (`spawn("claude", [...])`) with `--output-format json`, `--permission-mode acceptEdits`, and a `--system-prompt`/user prompt built by the dedicated prompt module, reusing the run-context, content-snapshot, and metadata bookkeeping (`src/agent/utils.ts`) that the removed multi-provider path used to share.
- `prompt.ts` (`createClaudeCliSystemPrompt`/`createClaudeCliUserPrompt`) is a self-contained prompt builder targeting the spawned CLI's own native tools (Read/Write/Edit/Bash/Grep/Glob) operating on real filesystem paths. It does **not** import from `src/agent/prompt.ts` — that file (with its `local-wiki`/`repository` `OutputPromptConfig`, virtual-path instructions, and connector-ingestion prompt rules) is no longer wired into any run path; nothing outside itself calls its exports. Treat it as legacy/unused unless a source change proves otherwise. It has no connector tools available.
- The docs-only write restriction is enforced out of band, not by a DeepAgents backend: a temporary `--settings` file registers a `PreToolUse` hook (`write-guard-hook.ts`) matching `Write|Edit` calls, backed by pure path-decision logic in `write-guard.ts` (`evaluateWritePath()`) that refuses writes outside the repository root or outside the configured `openwiki/`-relative directory.
- It is keyless — there is no API key or OAuth step. It requires the `claude` CLI to be installed and already authenticated in the run environment (for example a self-hosted CI runner under an operator's account).
- **v1 scope only supports `repository` output mode; passing `local-wiki` throws unconditionally**, before the command type is even checked. `openwiki personal --init/--update` (CLI mode `"personal"`) and the wiki-synthesis step of `openwiki ingest` both request `outputMode: "local-wiki"` (see `src/cli.tsx`'s `getRunModeOutputMode()` and `src/ingestion.ts`), so under this fork both currently error instead of running. Deterministic connector ingestion (writing raw JSON to `~/.arguswiki/connectors/<id>/raw/`) does not go through this path and is unaffected — only the wiki-synthesis step that follows it fails. See [Connectors](../integrations/connectors.md) and [Credentials and updates](../operations/credentials-and-updates.md) for what this affects.

## Prompting strategy

`src/agent/claude-cli/prompt.ts` (`createClaudeCliSystemPrompt`) is the system prompt actually sent to the spawned `claude` CLI process — a compact, self-contained prompt, not the older `src/agent/prompt.ts`. The agent is instructed to:

- inspect the current codebase and write documentation under `openwiki/`,
- use its native Read/Write/Edit/Bash/Grep/Glob tools and git history rather than inventing facts,
- keep the initial wiki focused (at most ~8 pages on init) and navigable,
- document the repository for both humans and future agents,
- respect the repository root as the only project in scope,
- avoid reading secrets or `.env` files,
- use git history for init and update runs,
- create and delete a temporary `openwiki/_plan.md` file, and use OKF-compliant front matter on every page.

It does **not** instruct the agent to update top-level `/AGENTS.md`/`/CLAUDE.md`, does not expose connector/subagent tooling, and does not include the OKF concept-relationship-graph or local-wiki-synthesis rules that `src/agent/prompt.ts` defines — those only apply on the unused multi-provider/local-wiki path (see [Claude Code CLI provider](#claude-code-cli-provider) above).

The user prompt changes with the command:

- `init` includes the current Git summary and asks for fresh documentation.
- `update` includes last update metadata and a Git change summary.
- `chat` just forwards the user message.

### Local brain open questions (unused path)

The following "local brain" rules are defined in `src/agent/prompt.ts`, which is not wired into any active run path under this fork (see above) — they describe the intended personal/local-wiki design, not currently-reachable behavior. Kept here as design reference in case `local-wiki` output mode is restored.

Local brain runs use `~/.arguswiki/wiki/open-questions.md` as a compact queue for uncertainty about the user's wiki or core memory model, not as a place to copy unresolved questions from every source document. Good open questions are things that would impair future assistance, such as unclear recurring routines, missing locations, uncertain preferences, ambiguous people/org relationships, or contradictions between sources.

Do not add an open question merely because a Notion spec, meeting note, email thread, or source page contains open product/design questions. Keep those on source pages, `themes.md`, or `commitments.md` unless they are explicitly owned by the user or reveal a gap in the user's memory graph. Group similar questions under one topic key instead of creating many same-project entries.

The file should use three sections:

- `Active`: unresolved questions with `Owner`, `Seen`, `Evidence`, and optional `Notes`.
- `Answered`: previously open questions with `Evidence` linking to the canonical answer or source evidence, plus `Answered`.
- `Stale`: dropped questions with `Why` and `Last seen`.

The agent should read `open-questions.md` at the start of each local-wiki run when it exists, use the run's evidence to answer known questions, and return to the file at the end to add new unresolved questions or move answered ones out of `Active`. Answered entries should link to the answer evidence rather than duplicating an answer summary that can drift.

### Local brain themes

Local brain runs use `themes.md` as a compact trend index, not as a narrative page. Prefer a Markdown table with `Topic key`, `Theme/Signal`, `First seen`, `Last seen`, `Confidence`, `Sources`, `Evidence count`, `Status`, and `Evidence`. If a table is too cramped, use one short fielded entry per theme.

Each theme should have at most 1-2 short sentences of prose. Keep detailed examples, long context, source-specific item lists, and tweet/feed clusters in `sources/<connector>.md`, then link to that evidence from the theme row. Watchlist entries should be especially terse.

### Local brain commitments and logistics

Local brain runs use `commitments.md` for work commitments, follow-ups, approvals, deadlines, and scheduled work items. Entries should include `Owner` when inferable from evidence: `me`, `team`, `other:<name>`, or `unknown`.

Use `personal-logistics.md` for non-work personal items such as appointments, pickups, travel, household tasks, and life-admin deadlines. Personal logistics should not be mixed into `commitments.md` unless they are also work commitments.

## Git evidence and update metadata

`src/agent/utils.ts` is responsible for the repository evidence that the prompt sees:

- current working tree status,
- current HEAD,
- a change window since the last successful update when `.last-update.json` includes a `gitHead` or `updatedAt`,
- the most recent 20 commits with changed files for init runs (or updates without prior metadata),
- a diff summary against HEAD.

On successful init/update runs where content changed, the agent writes JSON metadata with:

- `updatedAt`
- `command`
- `gitHead`
- `model`

That metadata is later used to scope update runs.

### Content snapshot

`createArgusWikiContentSnapshot()` computes a SHA-256 hash of the entire `openwiki/` directory tree (excluding `.last-update.json`). The agent runtime takes a snapshot before and after the run. If they match — meaning the model made no documentation changes — the metadata file is not updated. This prevents scheduled update loops from churning the metadata when the wiki is already current.

## Model errors

There is no LangChain model client and no cross-model retry anymore. If the spawned `claude` CLI process exits with a non-zero code and no stdout, or returns `is_error: true` in its JSON result, `runClaudeCliAgent()` throws and the run fails outright — ArgusWiki does not retry with another model. `ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS` is still validated and stored by `src/env.ts`/`src/constants.ts` (`resolveProviderRetryAttempts()`), but nothing in the current run path reads it to configure retries; treat it as an inert legacy setting unless a source change proves otherwise.

## Why this matters

The agent is not just a generic chat wrapper. It is intentionally constrained so it can:

- write repository-local docs without wandering outside the repo,
- keep updates grounded in Git evidence and scoped by `.last-update.json`,
- avoid metadata churn via the content-snapshot check,
- support both interactive and scheduled maintenance use cases.

## Things to watch when changing agent behavior

- Keep `src/agent/claude-cli/prompt.ts` in sync with the actual native tools and write-guard behavior of the spawned `claude` CLI — not `src/agent/prompt.ts`, which is unused.
- Be careful with `.last-update.json` semantics, because update runs use it to decide what changed since the previous successful run.
- The content-snapshot check means a no-op update will not update metadata. If you change the snapshot logic, ensure `.last-update.json` is still excluded.
- `local-wiki` output mode throws unconditionally in `runClaudeCliAgent()` — personal-mode runs and `openwiki ingest`'s synthesis step currently fail because of this. See [Claude Code CLI provider](#claude-code-cli-provider) above.
- The write-guard hook (`write-guard-hook.ts`/`write-guard.ts`) is the *only* enforcement of the docs-only write restriction on this path — there is no DeepAgents backend restricting writes underneath it.

## Source map

- `src/agent/index.ts`
- `src/agent/utils.ts`
- `src/agent/types.ts`
- `src/agent/skills.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/agent/claude-cli/prompt.ts`
- `src/agent/claude-cli/write-guard.ts`
- `src/agent/claude-cli/write-guard-hook.ts`
- `src/constants.ts`
- `src/env.ts`
