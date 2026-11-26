import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Some unit tests opt into the node environment (e.g. PDF rendering).
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // axe-core probes canvas support, which jsdom does not have. Answer "none" quietly.
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}
