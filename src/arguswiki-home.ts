import { chmod, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const argusWikiHomeDir =
  process.env.ARGUSWIKI_HOME ?? path.join(os.homedir(), ".arguswiki");
export const argusWikiConnectorsDir = path.join(argusWikiHomeDir, "connectors");
export const argusWikiLocalWikiDir = path.join(argusWikiHomeDir, "wiki");
export const argusWikiSkillsDir = path.join(argusWikiHomeDir, "skills");

export function getConnectorDir(connectorId: string): string {
  return path.join(argusWikiConnectorsDir, connectorId);
}

export function getConnectorConfigPath(connectorId: string): string {
  return path.join(getConnectorDir(connectorId), "config.json");
}

export function getConnectorStatePath(connectorId: string): string {
  return path.join(getConnectorDir(connectorId), "state.json");
}

export function getConnectorRawDir(connectorId: string): string {
  return path.join(getConnectorDir(connectorId), "raw");
}

export function getConnectorLogsDir(connectorId: string): string {
  return path.join(getConnectorDir(connectorId), "logs");
}

export async function ensureArgusWikiHome(): Promise<void> {
  await mkdir(argusWikiHomeDir, { recursive: true, mode: 0o700 });
  await chmodIfExists(argusWikiHomeDir, 0o700);
  await mkdir(argusWikiConnectorsDir, { recursive: true, mode: 0o700 });
  await mkdir(argusWikiLocalWikiDir, { recursive: true, mode: 0o700 });
  await mkdir(argusWikiSkillsDir, { recursive: true, mode: 0o700 });
}

export async function ensureConnectorHome(connectorId: string): Promise<void> {
  assertSafeConnectorId(connectorId);
  await ensureArgusWikiHome();
  await mkdir(getConnectorDir(connectorId), { recursive: true, mode: 0o700 });
  await mkdir(getConnectorRawDir(connectorId), {
    recursive: true,
    mode: 0o700,
  });
  await mkdir(getConnectorLogsDir(connectorId), {
    recursive: true,
    mode: 0o700,
  });
}

export function assertSafeConnectorId(connectorId: string): void {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(connectorId)) {
    throw new Error(`Invalid connector ID: ${connectorId}`);
  }
}

export function resolveConnectorRawPath(
  connectorId: string,
  relativePath: string,
): string {
  assertSafeConnectorId(connectorId);
  const rawDir = getConnectorRawDir(connectorId);
  const resolved = path.resolve(rawDir, relativePath);

  if (resolved !== rawDir && !resolved.startsWith(`${rawDir}${path.sep}`)) {
    throw new Error(
      "Raw item path must stay inside the connector raw directory.",
    );
  }

  return resolved;
}

async function chmodIfExists(filePath: string, mode: number): Promise<void> {
  try {
    await chmod(filePath, mode);
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
