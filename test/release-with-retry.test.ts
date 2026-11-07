import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const wrapper = path.resolve(
  import.meta.dirname,
  "../scripts/release-with-retry.sh",
);
const gitEnv = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...gitEnv },
  });
  expect(result.status, `git ${args.join(" ")}: ${result.stderr}`).toBe(0);
  return result.stdout;
};

describe("release-with-retry.sh", () => {
  let work: string;
  let clone: string;
  let attemptsFile: string;

  beforeEach(() => {
    work = mkdtempSync(path.join(tmpdir(), "release-retry-"));
    git(work, "init", "-q", "--bare", "origin.git");
    git(work, "clone", "-q", "origin.git", "clone");
    clone = path.join(work, "clone");
    git(clone, "commit", "-q", "--allow-empty", "-m", "chore: seed");
    git(clone, "branch", "-M", "deploy");
    git(clone, "push", "-q", "-u", "origin", "deploy");
    attemptsFile = path.join(work, "attempts");
    writeFileSync(attemptsFile, "");
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  const run = (releaseCommand: string) =>
    spawnSync("bash", [wrapper], {
      cwd: clone,
      encoding: "utf8",
      env: {
        ...process.env,
        ...gitEnv,
        RUNNER_TEMP: work,
        RELEASE_COMMAND: `echo attempt >>"${attemptsFile}"; ${releaseCommand}`,
      },
    });
  const attempts = () =>
    readFileSync(attemptsFile, "utf8").split("\n").filter(Boolean).length;

  test("a clean release runs once and passes", () => {
    const result = run("echo released");
    expect(result.status).toBe(0);
    expect(attempts()).toBe(1);
  });

  test("a rejected push is redone after re-syncing from the remote", () => {
    const result = run(
      `if [ "$(wc -l <"${attemptsFile}")" -lt 3 ]; then echo " ! [rejected] v1.0.0 -> v1.0.0 (already exists)"; exit 1; fi`,
    );
    expect(result.status).toBe(0);
    expect(attempts()).toBe(3);
  });

  test("three rejections fail the job", () => {
    const result = run('echo "failed to push some refs"; exit 1');
    expect(result.status).toBe(1);
    expect(attempts()).toBe(3);
    expect(result.stdout).toContain("::error::");
  });

  test("a failure that is not a push race passes its exit status through", () => {
    const result = run('echo "bad credentials"; exit 7');
    expect(result.status).toBe(7);
    expect(attempts()).toBe(1);
  });

  test("a remote tag that appears between attempts is fetched before the next attempt", () => {
    const other = path.join(work, "other");
    git(work, "clone", "-q", "-b", "deploy", "origin.git", "other");
    git(other, "tag", "v9.9.9");
    git(other, "push", "-q", "origin", "v9.9.9");
    const result = run(
      `if [ "$(wc -l <"${attemptsFile}")" -lt 2 ]; then echo "[rejected]"; exit 1; fi; git tag --list v9.9.9`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("v9.9.9");
  });
});
