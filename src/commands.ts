import { isValidModelId, normalizeModelId } from "./constants.js";
import type { ArgusWikiCommand } from "./agent/types.js";
import { isAuthProviderId } from "./auth/providers.js";
import type { AuthProviderId } from "./auth/types.js";
import { parseIngestionTarget, type IngestionTarget } from "./ingestion.js";

export type HelpRow = {
  label: string;
  description: string;
};

export type ArgusWikiRunMode = "personal" | "code";
type CronTarget = Extract<IngestionTarget, string>;

export type HelpContent = {
  title: string;
  description: string;
  usage: string[];
  commands: HelpRow[];
  options: HelpRow[];
  developmentOptions: HelpRow[];
  examples: string[];
  developmentExamples: string[];
};

export type CliCommand =
  | {
      kind: "auth";
      action: "configure" | "list" | "oauth" | "tools";
      exitCode: 0;
      force: boolean;
      provider: AuthProviderId | null;
    }
  | {
      kind: "ngrok";
      action: "start";
      exitCode: 0;
      port: number;
      url: string | null;
    }
  | {
      kind: "ingest";
      exitCode: 0;
      modelId: string | null;
      print: boolean;
      scheduledOnly: boolean;
      target: IngestionTarget;
    }
  | {
      kind: "cron";
      action: "delete" | "list" | "pause" | "resume";
      exitCode: 0;
      target: CronTarget | null;
    }
  | { kind: "help"; exitCode: 0 }
  | {
      kind: "run";
      exitCode: 0;
      command: ArgusWikiCommand;
      dryRun: boolean;
      mode: ArgusWikiRunMode;
      modeSource: ArgusWikiRunModeSource;
      modelId: string | null;
      print: boolean;
      shouldStart: boolean;
      userMessage: string | null;
    }
  | {
      kind: "error";
      exitCode: 1;
      message: string;
    };

export type ArgusWikiRunModeSource = "default" | "option" | "positional";

export function parseCommand(argv: string[]): CliCommand {
  if (argv[0] === "--help" || argv[0] === "-h") {
    return { kind: "help", exitCode: 0 };
  }

  if (argv[0] === "auth") {
    const action =
      argv[1] === "configure"
        ? "configure"
        : argv[1] === "tools"
          ? "tools"
          : "oauth";
    const provider =
      action === "configure" || action === "tools"
        ? argv[2]
        : (argv[1] ?? "list");
    const optionArgs =
      action === "configure" || action === "tools"
        ? argv.slice(3)
        : argv.slice(2);
    const unknownOption = optionArgs.find((arg) => arg !== "--force");
    const force = optionArgs.includes("--force");

    if (unknownOption) {
      return {
        kind: "error",
        exitCode: 1,
        message: `Unknown option for auth: ${unknownOption}`,
      };
    }

    if (provider === "list" && action === "oauth") {
      return {
        kind: "auth",
        action: "list",
        exitCode: 0,
        force: false,
        provider: null,
      };
    }

    if (!provider || !isAuthProviderId(provider)) {
      return {
        kind: "error",
        exitCode: 1,
        message:
          action === "configure"
            ? "Usage: arguswiki auth configure <provider> [--force]"
            : action === "tools"
              ? "Usage: arguswiki auth tools <provider>"
              : `Unknown auth provider: ${provider}`,
      };
    }

    return {
      kind: "auth",
      action,
      exitCode: 0,
      force,
      provider,
    };
  }

  if (argv[0] === "ngrok") {
    if (argv[1] !== "start") {
      return {
        kind: "error",
        exitCode: 1,
        message: "Usage: arguswiki ngrok start [url] [--port <port>]",
      };
    }

    let port = 53682;
    let url: string | null = null;
    const optionArgs = argv.slice(2);
    for (let index = 0; index < optionArgs.length; index += 1) {
      const arg = optionArgs[index];

      if (arg === "--port") {
        const rawPort = optionArgs[index + 1];
        if (!rawPort) {
          return {
            kind: "error",
            exitCode: 1,
            message: "--port requires a value.",
          };
        }
        port = Number(rawPort);
        index += 1;
        continue;
      }

      if (arg.startsWith("--port=")) {
        port = Number(arg.slice("--port=".length));
        continue;
      }

      if (!arg.startsWith("-") && url === null) {
        url = arg;
        continue;
      }

      return {
        kind: "error",
        exitCode: 1,
        message: `Unknown option for ngrok: ${arg}`,
      };
    }

    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return {
        kind: "error",
        exitCode: 1,
        message: "--port must be between 1024 and 65535.",
      };
    }

    return {
      kind: "ngrok",
      action: "start",
      exitCode: 0,
      port,
      url,
    };
  }

  if (argv[0] === "ingest") {
    const target = parseIngestionTarget(argv[1] ?? "all");
    if (!target) {
      return {
        kind: "error",
        exitCode: 1,
        message:
          "Usage: arguswiki ingest <source|source-instance|all> [--print] [--modelId <id>]",
      };
    }

    let modelId: string | null = null;
    let print = false;
    let scheduledOnly = false;
    const optionArgs = argv.slice(2);
    for (let index = 0; index < optionArgs.length; index += 1) {
      const arg = optionArgs[index];

      if (arg === "--print" || arg === "-p") {
        print = true;
        continue;
      }

      if (arg === "--scheduled") {
        scheduledOnly = true;
        continue;
      }

      if (arg === "--modelId" || arg === "--model-id") {
        const rawModelId = optionArgs[index + 1];
        if (!rawModelId || rawModelId.startsWith("-")) {
          return {
            kind: "error",
            exitCode: 1,
            message: `${arg} requires a model ID.`,
          };
        }

        const parsedModelId = normalizeModelId(rawModelId);
        if (!isValidModelId(parsedModelId)) {
          return {
            kind: "error",
            exitCode: 1,
            message: `Invalid model ID: ${rawModelId}`,
          };
        }

        modelId = parsedModelId;
        index += 1;
        continue;
      }

      if (arg.startsWith("--modelId=") || arg.startsWith("--model-id=")) {
        const [, rawModelId = ""] = arg.split("=", 2);
        const parsedModelId = normalizeModelId(rawModelId);
        if (!isValidModelId(parsedModelId)) {
          return {
            kind: "error",
            exitCode: 1,
            message: `Invalid model ID: ${rawModelId}`,
          };
        }

        modelId = parsedModelId;
        continue;
      }

      return {
        kind: "error",
        exitCode: 1,
        message: `Unknown option for ingest: ${arg}`,
      };
    }

    return {
      kind: "ingest",
      exitCode: 0,
      modelId,
      print,
      scheduledOnly,
      target,
    };
  }

  if (argv[0] === "cron") {
    if (argv[1] === "list" && argv.length === 2) {
      return {
        kind: "cron",
        action: "list",
        exitCode: 0,
        target: null,
      };
    }

    if (argv[1] === "pause" || argv[1] === "resume" || argv[1] === "delete") {
      const target = parseIngestionTarget(argv[2] ?? "");
      if (!target || typeof target !== "string" || argv.length > 3) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Usage: arguswiki cron ${argv[1]} <source|all>`,
        };
      }

      return {
        kind: "cron",
        action: argv[1],
        exitCode: 0,
        target,
      };
    }

    {
      return {
        kind: "error",
        exitCode: 1,
        message:
          "Usage: arguswiki cron list | pause <source|all> | resume <source|all> | delete <source|all>",
      };
    }
  }

  if (isArgusWikiRunMode(argv[0])) {
    return parseRunCommand(argv.slice(1), argv[0], "positional");
  }

  return parseRunCommand(argv, "code", "default");
}

function parseRunCommand(
  argv: string[],
  initialMode: ArgusWikiRunMode,
  initialModeSource: ArgusWikiRunModeSource,
): CliCommand {
  let dryRun = false;
  let mode = initialMode;
  let modeSource = initialModeSource;
  let modelId: string | null = null;
  let print = false;
  let command: ArgusWikiCommand = "chat";

  const userMessageParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      return { kind: "help", exitCode: 0 };
    }

    if (arg === "--dry-run") {
      if (!isDevelopmentMode()) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Unknown option: ${arg}`,
        };
      }

      dryRun = true;
      continue;
    }

    if (arg === "--print" || arg === "-p") {
      print = true;
      continue;
    }

    if (arg === "--init" || arg === "--update") {
      const nextCommand = arg === "--init" ? "init" : "update";

      if (command !== "chat" && command !== nextCommand) {
        return {
          kind: "error",
          exitCode: 1,
          message: "--init and --update cannot be used together.",
        };
      }

      command = nextCommand;
      continue;
    }

    if (arg === "--mode") {
      const nextArg = argv[index + 1];

      if (!nextArg || nextArg.startsWith("-")) {
        return {
          kind: "error",
          exitCode: 1,
          message: "--mode requires personal or code.",
        };
      }

      if (!isArgusWikiRunMode(nextArg)) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Invalid mode: ${nextArg}. Expected personal or code.`,
        };
      }

      const modeResult = resolveExplicitMode(mode, modeSource, nextArg);
      if (modeResult.kind === "error") {
        return modeResult;
      }

      mode = modeResult.mode;
      modeSource = "option";
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const [, rawMode = ""] = arg.split("=", 2);

      if (!isArgusWikiRunMode(rawMode)) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Invalid mode: ${rawMode}. Expected personal or code.`,
        };
      }

      const modeResult = resolveExplicitMode(mode, modeSource, rawMode);
      if (modeResult.kind === "error") {
        return modeResult;
      }

      mode = modeResult.mode;
      modeSource = "option";
      continue;
    }

    if (arg === "--modelId" || arg === "--model-id") {
      const nextArg = argv[index + 1];

      if (!nextArg || nextArg.startsWith("-")) {
        return {
          kind: "error",
          exitCode: 1,
          message: `${arg} requires a model ID.`,
        };
      }

      const parsedModelId = normalizeModelId(nextArg);

      if (!isValidModelId(parsedModelId)) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Invalid model ID: ${nextArg}`,
        };
      }

      modelId = parsedModelId;
      index += 1;
      continue;
    }

    if (arg.startsWith("--modelId=") || arg.startsWith("--model-id=")) {
      const [, rawModelId = ""] = arg.split("=", 2);
      const parsedModelId = normalizeModelId(rawModelId);

      if (!isValidModelId(parsedModelId)) {
        return {
          kind: "error",
          exitCode: 1,
          message: `Invalid model ID: ${rawModelId}`,
        };
      }

      modelId = parsedModelId;
      continue;
    }

    if (arg.startsWith("-")) {
      return {
        kind: "error",
        exitCode: 1,
        message: `Unknown option: ${arg}`,
      };
    }

    // A mode word in the first positional slot selects the mode even when
    // flags precede it (e.g. `arguswiki --print code --update`), matching the
    // `arguswiki code ...` form. Otherwise it would silently become the user
    // message and the run would target the default personal wiki.
    if (
      isArgusWikiRunMode(arg) &&
      modeSource === "default" &&
      userMessageParts.length === 0
    ) {
      mode = arg;
      modeSource = "positional";
      continue;
    }

    userMessageParts.push(arg);
  }

  const userMessage =
    userMessageParts.length > 0 ? userMessageParts.join(" ") : null;
  const shouldStart = command !== "chat" || userMessage !== null;

  if (command !== "chat" && modeSource === "default") {
    mode = "code";
  }

  if (print && !shouldStart) {
    return {
      kind: "error",
      exitCode: 1,
      message: "-p, --print requires a message, --init, or --update.",
    };
  }

  return {
    kind: "run",
    exitCode: 0,
    command,
    dryRun,
    mode,
    modeSource,
    modelId,
    print,
    shouldStart,
    userMessage,
  };
}

function resolveExplicitMode(
  currentMode: ArgusWikiRunMode,
  modeSource: ArgusWikiRunModeSource,
  nextMode: ArgusWikiRunMode,
):
  | { kind: "ok"; mode: ArgusWikiRunMode }
  | { kind: "error"; exitCode: 1; message: string } {
  if (currentMode === nextMode || modeSource === "default") {
    return { kind: "ok", mode: nextMode };
  }

  return {
    kind: "error",
    exitCode: 1,
    message: `Conflicting modes: ${currentMode} and ${nextMode}.`,
  };
}

function isArgusWikiRunMode(
  value: string | undefined,
): value is ArgusWikiRunMode {
  return value === "personal" || value === "code";
}

/**
 * True when a run must bypass the Ink UI and use the non-interactive path:
 * either the user asked for print mode, or stdin is not a TTY (CI, cron,
 * pipes), where Ink's raw-mode input is unavailable and rendering the UI
 * fails. Interactive chat without a message still requires a TTY, so it is
 * excluded.
 */
export function shouldRunNonInteractively(
  command: CliCommand,
  stdinIsTTY: boolean,
): command is Extract<CliCommand, { kind: "run" }> {
  return (
    command.kind === "run" &&
    !command.dryRun &&
    (command.print || (!stdinIsTTY && command.shouldStart))
  );
}

export function isDevelopmentMode(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.ARGUSWIKI_DEV === "1"
  );
}

export const helpContent: HelpContent = {
  title: "ArgusWiki",
  description:
    "Run an agent that generates and maintains a project or local knowledge wiki.",
  usage: [
    "arguswiki [--init|--update] [message]",
    "arguswiki code [--init|--update] [message]",
    "arguswiki personal [--init|--update] [message]",
    "arguswiki --mode <personal|code> [--init|--update] [message]",
    "arguswiki [--modelId <model>]",
    "arguswiki [--modelId <model>] [message]",
    "arguswiki --update [message]",
    "arguswiki auth <provider>",
    "arguswiki auth configure <provider> [--force]",
    "arguswiki auth tools <provider>",
    "arguswiki ingest <source|source-instance|all>",
    "arguswiki cron list",
    "arguswiki cron pause <source|all>",
    "arguswiki cron resume <source|all>",
    "arguswiki cron delete <source|all>",
    "arguswiki ngrok start [url] [--port <port>]",
  ],
  commands: [
    {
      label: "arguswiki code",
      description:
        "Run ArgusWiki for the current repository, writing docs under repo arguswiki/ and using GitHub Actions for recurrence.",
    },
    {
      label: "arguswiki personal",
      description:
        "Run ArgusWiki as your local personal brain over configured sources, writing to ~/.arguswiki/wiki.",
    },
    {
      label: "arguswiki",
      description:
        "Open the interactive ArgusWiki code chat for the current repository.",
    },
    {
      label: "arguswiki auth <provider>",
      description:
        "Authenticate, create connector config, and discover MCP tools when available.",
    },
    {
      label: "arguswiki auth configure <provider>",
      description:
        "Create local connector config that references saved auth env vars.",
    },
    {
      label: "arguswiki auth tools <provider>",
      description: "List available MCP tools for a configured auth provider.",
    },
    {
      label: "arguswiki ingest <source|source-instance|all>",
      description:
        "Run ingestion and wiki update runs for one connector, one source instance, or all configured sources.",
    },
    {
      label: "arguswiki cron list",
      description: "List saved connector schedules and local launchd status.",
    },
    {
      label: "arguswiki cron pause <source|all>",
      description:
        "Pause saved connector schedules and reconcile the Mac wake window.",
    },
    {
      label: "arguswiki cron resume <source|all>",
      description:
        "Resume paused connector schedules and reconcile the Mac wake window.",
    },
    {
      label: "arguswiki cron delete <source|all>",
      description:
        "Delete saved connector schedules and remove stale local schedule files.",
    },
    {
      label: "arguswiki ngrok start [url]",
      description:
        "Start an ngrok tunnel for Slack OAuth, optionally using a fixed HTTPS URL.",
    },
  ],
  options: [
    {
      label: "--init",
      description:
        "Generate initial ArgusWiki documentation. Defaults to code mode; use personal to initialize the local personal brain.",
    },
    {
      label: "--update",
      description:
        "Update existing ArgusWiki documentation. Defaults to code mode; use personal to update the local personal brain.",
    },
    {
      label: "--mode <personal|code>",
      description:
        "Choose the personal brain (local, over configured sources) or the code brain (repository docs).",
    },
    {
      label: "-p, --print",
      description: "Run once and print the final assistant output.",
    },
    {
      label: "--modelId <id>",
      description: "Use a model ID for this run.",
    },
  ],
  developmentOptions: [
    {
      label: "--dry-run",
      description: "Show what would run without invoking the agent.",
    },
  ],
  examples: [
    "arguswiki",
    "arguswiki --init",
    "arguswiki personal --init",
    "arguswiki code --init",
    "arguswiki --update",
    "arguswiki --update --mode personal",
    'arguswiki "What can you do?"',
    'arguswiki -p "Summarize what ArgusWiki can do"',
    "arguswiki --modelId gpt-5.5",
    'arguswiki --update --modelId gpt-5.5 "Please document the API routes first"',
    'arguswiki personal --update "Refresh the wiki from configured connectors"',
    "arguswiki ingest all",
    "arguswiki ingest web-search",
    "arguswiki ingest web-search-2",
    "arguswiki cron list",
    "arguswiki cron pause web-search",
    "arguswiki cron resume web-search",
    "arguswiki cron delete web-search",
    "arguswiki auth slack",
    "arguswiki auth gmail",
    "arguswiki auth notion",
    "arguswiki auth tools notion",
    "arguswiki ngrok start",
    "arguswiki ngrok start https://arguswiki.ngrok.app",
  ],
  developmentExamples: ["arguswiki --dry-run"],
};

export function getHelpText(): string {
  const helpSections = [
    helpContent.title,
    `  ${helpContent.description}`,
    "",
    "Usage",
    ...helpContent.usage.map((line) => `  ${line}`),
    "",
    "Commands",
    ...formatRows(helpContent.commands),
    "",
    "Options",
    ...formatRows(helpContent.options),
    "",
  ];

  if (isDevelopmentMode()) {
    helpSections.push(
      "Development Options",
      ...formatRows(helpContent.developmentOptions),
      "",
    );
  }

  helpSections.push(
    "Examples",
    ...helpContent.examples.map((line) => `  ${line}`),
  );

  if (isDevelopmentMode()) {
    helpSections.push(
      ...helpContent.developmentExamples.map((line) => `  ${line}`),
    );
  }

  return helpSections.join("\n");
}

function formatRows(rows: HelpRow[]): string[] {
  const labelWidth = Math.max(...rows.map((row) => row.label.length));

  return rows.map(
    (row) => `  ${row.label.padEnd(labelWidth)}  ${row.description}`,
  );
}
