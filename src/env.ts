import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ANTHROPIC_API_KEY_ENV_KEY,
  ANTHROPIC_BASE_URL_ENV_KEY,
  BASETEN_API_KEY_ENV_KEY,
  BEDROCK_AWS_ACCESS_KEY_ID_ENV_KEY,
  BEDROCK_AWS_REGION_ENV_KEY,
  BEDROCK_AWS_SECRET_ACCESS_KEY_ENV_KEY,
  FIREWORKS_API_KEY_ENV_KEY,
  GEMINI_API_KEY_ENV_KEY,
  GOOGLE_APPLICATION_CREDENTIALS_ENV_KEY,
  GOOGLE_CLOUD_LOCATION_ENV_KEY,
  GOOGLE_CLOUD_PROJECT_ENV_KEY,
  isValidModelId,
  NEBIUS_API_KEY_ENV_KEY,
  normalizeProvider,
  NVIDIA_API_KEY_ENV_KEY,
  OPENAI_API_KEY_ENV_KEY,
  OPENAI_CHATGPT_ACCESS_TOKEN_ENV_KEY,
  OPENAI_CHATGPT_ACCOUNT_ID_ENV_KEY,
  OPENAI_CHATGPT_EMAIL_ENV_KEY,
  OPENAI_CHATGPT_EXPIRES_AT_ENV_KEY,
  OPENAI_CHATGPT_PLAN_ENV_KEY,
  OPENAI_CHATGPT_REFRESH_TOKEN_ENV_KEY,
  OPENAI_COMPATIBLE_API_KEY_ENV_KEY,
  OPENAI_COMPATIBLE_BASE_URL_ENV_KEY,
  ARGUSWIKI_GOOGLE_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_GOOGLE_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_GOOGLE_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_GOOGLE_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_GMAIL_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_GMAIL_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_REFRESH_TOKEN_ENV_KEY,
  OPENROUTER_API_KEY_ENV_KEY,
  ARGUSWIKI_NOTION_TOKEN_ENV_KEY,
  ARGUSWIKI_SLACK_BOT_TOKEN_ENV_KEY,
  ARGUSWIKI_SLACK_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_SLACK_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_SLACK_USER_TOKEN_ENV_KEY,
  ARGUSWIKI_X_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_X_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_X_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_X_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_TAVILY_API_KEY_ENV_KEY,
  ARGUSWIKI_MODEL_ID_ENV_KEY,
  ARGUSWIKI_PROVIDER_ENV_KEY,
  ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY,
  resolveProviderRetryAttempts,
} from "./constants.js";
import { isFileNotFoundError } from "./fs-errors.js";

export const argusWikiEnvDir =
  process.env.ARGUSWIKI_HOME ?? path.join(os.homedir(), ".arguswiki");
export const argusWikiEnvPath = path.join(argusWikiEnvDir, ".env");

type EnvMap = Record<string, string>;

export type CredentialDiagnostic = {
  key: string;
  source:
    | "process.env"
    | "~/.arguswiki/.env"
    | "process.env over ~/.arguswiki/.env"
    | "unset";
  length: number | null;
  preview: string;
  warnings: string[];
};

/**
 * Every environment variable ArgusWiki reads or persists, in the order they are
 * written to `~/.arguswiki/.env`. This is the single source of truth: the
 * credential diagnostics list and the agent's debug-dump key list are both
 * derived from it (see {@link CREDENTIAL_DIAGNOSTIC_ENV_KEYS} and
 * {@link DEBUG_ENV_KEYS}), so they cannot silently drift out of sync when a new
 * managed key is added.
 */
export const MANAGED_ENV_KEYS = [
  BASETEN_API_KEY_ENV_KEY,
  FIREWORKS_API_KEY_ENV_KEY,
  NEBIUS_API_KEY_ENV_KEY,
  NVIDIA_API_KEY_ENV_KEY,
  OPENAI_API_KEY_ENV_KEY,
  OPENAI_CHATGPT_ACCESS_TOKEN_ENV_KEY,
  OPENAI_CHATGPT_REFRESH_TOKEN_ENV_KEY,
  OPENAI_CHATGPT_EXPIRES_AT_ENV_KEY,
  OPENAI_CHATGPT_ACCOUNT_ID_ENV_KEY,
  OPENAI_CHATGPT_EMAIL_ENV_KEY,
  OPENAI_CHATGPT_PLAN_ENV_KEY,
  OPENAI_COMPATIBLE_API_KEY_ENV_KEY,
  OPENAI_COMPATIBLE_BASE_URL_ENV_KEY,
  ANTHROPIC_API_KEY_ENV_KEY,
  ANTHROPIC_BASE_URL_ENV_KEY,
  GEMINI_API_KEY_ENV_KEY,
  GOOGLE_CLOUD_PROJECT_ENV_KEY,
  GOOGLE_CLOUD_LOCATION_ENV_KEY,
  GOOGLE_APPLICATION_CREDENTIALS_ENV_KEY,
  OPENROUTER_API_KEY_ENV_KEY,
  BEDROCK_AWS_ACCESS_KEY_ID_ENV_KEY,
  BEDROCK_AWS_SECRET_ACCESS_KEY_ENV_KEY,
  BEDROCK_AWS_REGION_ENV_KEY,
  ARGUSWIKI_PROVIDER_ENV_KEY,
  ARGUSWIKI_MODEL_ID_ENV_KEY,
  ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY,
  ARGUSWIKI_NOTION_TOKEN_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_NOTION_MCP_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_SLACK_BOT_TOKEN_ENV_KEY,
  ARGUSWIKI_SLACK_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_SLACK_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_SLACK_USER_TOKEN_ENV_KEY,
  ARGUSWIKI_GMAIL_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_GMAIL_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_GOOGLE_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_GOOGLE_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_GOOGLE_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_GOOGLE_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_X_CLIENT_ID_ENV_KEY,
  ARGUSWIKI_X_CLIENT_SECRET_ENV_KEY,
  ARGUSWIKI_X_ACCESS_TOKEN_ENV_KEY,
  ARGUSWIKI_X_REFRESH_TOKEN_ENV_KEY,
  ARGUSWIKI_TAVILY_API_KEY_ENV_KEY,
  "ARGUSWIKI_HTTPS_OAUTH_REDIRECT_URI",
  "ARGUSWIKI_OAUTH_CALLBACK_PORT",
  "LANGSMITH_API_KEY",
  "LANGCHAIN_PROJECT",
  "LANGCHAIN_TRACING_V2",
] as const;

// LangChain project/tracing settings are managed but are not credentials, so
// they are excluded from the diagnostics panel.
const NON_CREDENTIAL_ENV_KEYS = new Set<string>([
  "LANGCHAIN_PROJECT",
  "LANGCHAIN_TRACING_V2",
]);

/**
 * Managed keys surfaced (in display order) in the credential diagnostics panel:
 * the provider/model settings and every credential, but not the LangChain
 * project/tracing settings. Derived from {@link MANAGED_ENV_KEYS} so a new
 * credential key automatically appears in diagnostics.
 */
export const CREDENTIAL_DIAGNOSTIC_ENV_KEYS: readonly string[] = [
  ARGUSWIKI_PROVIDER_ENV_KEY,
  ...MANAGED_ENV_KEYS.filter(
    (key) =>
      key !== ARGUSWIKI_PROVIDER_ENV_KEY && !NON_CREDENTIAL_ENV_KEYS.has(key),
  ),
];

/**
 * Keys dumped in the agent's environment debug line: every managed key plus the
 * LangChain endpoint override that ArgusWiki reads but never persists. Derived
 * from {@link MANAGED_ENV_KEYS} so it cannot drift.
 */
export const DEBUG_ENV_KEYS: readonly string[] = [
  ...MANAGED_ENV_KEYS,
  "LANGCHAIN_ENDPOINT",
];

const managedEnvKeys: readonly string[] = MANAGED_ENV_KEYS;

const deprecatedEnvKeys = ["OPENAI_ORG_ID", "OPENAI_PROJECT"];

export async function loadArgusWikiEnv(): Promise<EnvMap> {
  const env = await readArgusWikiEnv();

  for (const [key, value] of Object.entries(env)) {
    if (deprecatedEnvKeys.includes(key)) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return env;
}

export async function getCredentialDiagnostics(): Promise<
  CredentialDiagnostic[]
> {
  const fileEnv = await readArgusWikiEnv();

  return CREDENTIAL_DIAGNOSTIC_ENV_KEYS.map((key) =>
    createCredentialDiagnostic(key, fileEnv),
  );
}

export async function saveArgusWikiEnv(updates: EnvMap): Promise<void> {
  const currentEnv = await readArgusWikiEnv();
  const nextEnv = {
    ...currentEnv,
    ...updates,
  };

  for (const key of deprecatedEnvKeys) {
    delete nextEnv[key];
  }

  await mkdir(argusWikiEnvDir, {
    recursive: true,
    mode: 0o700,
  });
  await chmod(argusWikiEnvDir, 0o700);

  await writeFile(argusWikiEnvPath, formatEnv(nextEnv), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(argusWikiEnvPath, 0o600);

  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }
}

function createCredentialDiagnostic(
  key: CredentialDiagnostic["key"],
  fileEnv: EnvMap,
): CredentialDiagnostic {
  const processValue = process.env[key];
  const fileValue = fileEnv[key];
  const value = processValue ?? fileValue;
  const source = getCredentialSource(processValue, fileValue);

  if (value === undefined) {
    return {
      key,
      source,
      length: null,
      preview: "<unset>",
      warnings: [],
    };
  }

  return {
    key,
    source,
    length: value.length,
    preview: isNonSecretDiagnosticKey(key)
      ? JSON.stringify(value)
      : createCredentialPreview(value),
    warnings:
      key === ARGUSWIKI_MODEL_ID_ENV_KEY
        ? getModelWarnings(value)
        : key === ARGUSWIKI_PROVIDER_ENV_KEY
          ? getProviderWarnings(value)
          : key === ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY
            ? getRetryAttemptsWarnings(value)
            : getCredentialWarnings(value),
  };
}

function getCredentialSource(
  processValue: string | undefined,
  fileValue: string | undefined,
): CredentialDiagnostic["source"] {
  if (processValue !== undefined && fileValue !== undefined) {
    return "process.env over ~/.arguswiki/.env";
  }

  if (processValue !== undefined) {
    return "process.env";
  }

  if (fileValue !== undefined) {
    return "~/.arguswiki/.env";
  }

  return "unset";
}

function isNonSecretDiagnosticKey(key: string): boolean {
  return (
    key === ARGUSWIKI_MODEL_ID_ENV_KEY ||
    key === ARGUSWIKI_PROVIDER_ENV_KEY ||
    key === ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY ||
    key === ANTHROPIC_BASE_URL_ENV_KEY ||
    key === OPENAI_COMPATIBLE_BASE_URL_ENV_KEY ||
    key === BEDROCK_AWS_REGION_ENV_KEY ||
    key === GOOGLE_CLOUD_PROJECT_ENV_KEY ||
    key === GOOGLE_CLOUD_LOCATION_ENV_KEY ||
    key === GOOGLE_APPLICATION_CREDENTIALS_ENV_KEY
  );
}

function createCredentialPreview(value: string): string {
  if (value.length <= 10) {
    return JSON.stringify("*".repeat(value.length));
  }

  return JSON.stringify(`${value.slice(0, 6)}...${value.slice(-4)}`);
}

function getCredentialWarnings(value: string): string[] {
  const warnings: string[] = [];

  if (value !== value.trim()) {
    warnings.push("leading/trailing whitespace");
  }

  if (value.includes("\n") || value.includes("\r")) {
    warnings.push("contains newline");
  }

  if (value.includes('"') || value.includes("'")) {
    warnings.push("contains quote character");
  }

  if (/\[[^\]]+\]/u.test(value)) {
    warnings.push("contains bracketed suffix/text");
  }

  return warnings;
}

function getModelWarnings(value: string): string[] {
  return isValidModelId(value) ? [] : ["invalid model ID"];
}

function getProviderWarnings(value: string): string[] {
  return normalizeProvider(value) === null ? ["invalid provider"] : [];
}

function getRetryAttemptsWarnings(value: string): string[] {
  try {
    resolveProviderRetryAttempts({
      [ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS_ENV_KEY]: value,
    });

    return [];
  } catch {
    return ["invalid retry attempts"];
  }
}

async function readArgusWikiEnv(): Promise<EnvMap> {
  try {
    return parseEnv(await readFile(argusWikiEnvPath, "utf8"));
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {};
    }

    throw error;
  }
}

export function parseEnv(content: string): EnvMap {
  const env: EnvMap = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const rawValue = line.slice(equalsIndex + 1).trim();

    if (!/^[A-Z_][A-Z0-9_]*$/u.test(key)) {
      continue;
    }

    env[key] = parseEnvValue(rawValue);
  }

  return env;
}

function parseEnvValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/gu, "\n")
      .replace(/\\r/gu, "\r")
      .replace(/\\"/gu, '"')
      .replace(/\\\\/gu, "\\");
  }

  return value;
}

export function formatEnv(env: EnvMap): string {
  const keys = [
    ...managedEnvKeys.filter((key) => env[key] !== undefined),
    ...Object.keys(env)
      .filter((key) => !managedEnvKeys.includes(key))
      .sort(),
  ];

  return `${keys.map((key) => `${key}=${formatEnvValue(env[key] ?? "")}`).join("\n")}\n`;
}

function formatEnvValue(value: string): string {
  return `"${value
    .replace(/\\/gu, "\\\\")
    .replace(/"/gu, '\\"')
    .replace(/\n/gu, "\\n")
    .replace(/\r/gu, "\\r")}"`;
}
