import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isFileNotFoundError } from "./fs-errors.js";

const ARGUSWIKI_AGENTS_SNIPPET_START = "<!-- ARGUSWIKI:START -->";
const ARGUSWIKI_AGENTS_SNIPPET_END = "<!-- ARGUSWIKI:END -->";
const DEFAULT_CODE_MODE_CRON = "0 8 * * *";

// Root agent-instruction files ArgusWiki keeps pointed at the generated wiki.
// Each is created when missing and refreshed in place when already present.
const CODE_MODE_AGENT_FILES = ["AGENTS.md", "CLAUDE.md"];

export async function ensureCodeModeRepoSetup(
  cwd: string,
  cronExpression = DEFAULT_CODE_MODE_CRON,
): Promise<void> {
  await writeCodeModeWorkflow(cwd, cronExpression);
  await writeCodeModeAgentSnippets(cwd);
}

// Created once, then left alone: once a repo has its own
// .github/workflows/arguswiki-update.yml, it's operator-owned config (runner,
// provider, build steps), not a tool-managed output the generator should
// keep overwriting on every run.
async function writeCodeModeWorkflow(
  cwd: string,
  cronExpression: string,
): Promise<void> {
  const workflowPath = path.join(
    cwd,
    ".github",
    "workflows",
    "arguswiki-update.yml",
  );

  if (await fileExists(workflowPath)) {
    return;
  }

  await mkdir(path.dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, createCodeModeWorkflow(cronExpression), "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

async function writeCodeModeAgentSnippets(cwd: string): Promise<void> {
  const snippet = createCodeModeAgentsSnippet();

  await Promise.all(
    CODE_MODE_AGENT_FILES.map((fileName) =>
      writeCodeModeAgentSnippet(path.join(cwd, fileName), snippet),
    ),
  );
}

async function writeCodeModeAgentSnippet(
  agentsPath: string,
  snippet: string,
): Promise<void> {
  let currentContent = "";

  try {
    currentContent = await readFile(agentsPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }

  const startIndex = currentContent.indexOf(ARGUSWIKI_AGENTS_SNIPPET_START);
  const endIndex = currentContent.indexOf(ARGUSWIKI_AGENTS_SNIPPET_END);
  const nextContent =
    startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
      ? `${currentContent.slice(0, startIndex)}${snippet}${currentContent.slice(endIndex + ARGUSWIKI_AGENTS_SNIPPET_END.length)}`
      : `${currentContent.trimEnd()}${currentContent.trim().length > 0 ? "\n\n" : ""}${snippet}\n`;

  await writeFile(agentsPath, nextContent, "utf8");
}

function createCodeModeWorkflow(cronExpression: string): string {
  return `name: ArgusWiki Update

on:
  workflow_dispatch:
  schedule:
    - cron: "${cronExpression}"

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install ArgusWiki
        run: npm install --global arguswiki

      - name: Run ArgusWiki
        run: arguswiki code --update --print
        env:
          ARGUSWIKI_PROVIDER: openrouter
          OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
          ARGUSWIKI_MODEL_ID: z-ai/glm-5.2
          LANGSMITH_API_KEY: \${{ secrets.LANGSMITH_API_KEY }}
          LANGCHAIN_PROJECT: arguswiki
          LANGCHAIN_TRACING_V2: "true"

      - name: Classify update as structural or routine
        id: classify
        run: |
          set -euo pipefail
          # The workflow file itself must never be silently auto-merged.
          if ! git diff --quiet -- .github/workflows/arguswiki-update.yml; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=workflow file changed" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if git status --porcelain -- arguswiki | grep -qE '^(\\?\\?|A)'; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=new file(s) under arguswiki/" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          diff_output="$(git diff -- arguswiki)"
          if echo "$diff_output" | grep -qE '^\\+#{2,3} '; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=new heading added" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          if echo "$diff_output" | grep -qE '^\\+.*\\[.+\\]\\(.+\\)'; then
            echo "classification=structural" >> "$GITHUB_OUTPUT"
            echo "reason=markdown link changed" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          echo "classification=routine" >> "$GITHUB_OUTPUT"
          echo "reason=prose-only content update" >> "$GITHUB_OUTPUT"

      - name: Create ArgusWiki update pull request
        id: pr
        uses: peter-evans/create-pull-request@22a9089034f40e5a961c8808d113e2c98fb63676 # v7
        with:
          add-paths: |
            arguswiki
            AGENTS.md
            CLAUDE.md
            .github/workflows/arguswiki-update.yml
          branch: arguswiki/update
          commit-message: "docs: update ArgusWiki"
          title: "docs: update ArgusWiki"
          body: |
            Automated ArgusWiki documentation update.

            This PR was generated by the scheduled ArgusWiki workflow.

            Classification: \${{ steps.classify.outputs.classification }} (\${{ steps.classify.outputs.reason }})

      - name: Auto-merge routine updates
        if: steps.classify.outputs.classification == 'routine' && steps.pr.outputs.pull-request-number
        run: gh pr merge --auto --squash "\${{ steps.pr.outputs.pull-request-number }}"
        env:
          GH_TOKEN: \${{ github.token }}
`;
}

function createCodeModeAgentsSnippet(): string {
  return `${ARGUSWIKI_AGENTS_SNIPPET_START}

## ArgusWiki

This repository uses ArgusWiki for recurring code documentation. Start with \`arguswiki/quickstart.md\`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled ArgusWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated ArgusWiki pages unless explicitly asked; prefer updating source code/docs and letting ArgusWiki regenerate.

${ARGUSWIKI_AGENTS_SNIPPET_END}`;
}
