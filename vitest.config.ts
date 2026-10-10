import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Suites such as startup.test.ts spawn several real `git` processes per test;
    // vitest's 5s default times out on a loaded self-hosted CI runner (#588).
    testTimeout: 20_000,
  },
});
