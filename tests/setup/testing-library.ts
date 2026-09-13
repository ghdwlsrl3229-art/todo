import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// @testing-library/react's own auto-cleanup only registers when it detects
// a global `afterEach` (i.e. Vitest's `test.globals: true`), which this
// project doesn't enable. Without this, DOM from one render() leaks into
// the next test in the same file/module.
afterEach(() => {
  cleanup();
});
