export type ArgusWikiCommand = "chat" | "init" | "update";
export type ArgusWikiOutputMode = "local-wiki" | "repository";

export type ArgusWikiRunResult = {
  command: ArgusWikiCommand;
  model: string;
  skipped?: boolean;
};

export type ArgusWikiRunEvent =
  | {
      source?: "main" | "subgraph";
      type: "text";
      text: string;
    }
  | {
      type: "tool_start";
      call: string;
      id: string;
      input: unknown;
      name: string;
    }
  | {
      type: "tool_end";
      id: string;
      name: string;
      status: "error" | "finished";
    }
  | {
      type: "debug";
      message: string;
    };

export type ArgusWikiRunOptions = {
  debug?: boolean;
  isFollowup?: boolean;
  modelId?: string | null;
  onEvent?: (event: ArgusWikiRunEvent) => void;
  outputMode?: ArgusWikiOutputMode;
  threadId?: string;
  userMessage?: string | null;
};

export type UpdateMetadata = {
  updatedAt: string;
  command: ArgusWikiCommand;
  gitHead?: string;
  model: string;
};

export type RunContext = {
  lastUpdate: UpdateMetadata | null;
  gitSummary: string;
  wikiGoal?: string;
};
