import { describe, expect, it } from "vitest";
import { ceilingLevel } from "./ceiling";

describe("ceilingLevel", () => {
  const ceiling = 8_100_000; // R$81,000.00

  it("is fine below 80%", () => {
    expect(ceilingLevel(0, ceiling)).toBe("ok");
    expect(ceilingLevel(6_479_999, ceiling)).toBe("ok");
  });

  it("warns from exactly 80%", () => {
    expect(ceilingLevel(6_480_000, ceiling)).toBe("warning");
    expect(ceilingLevel(8_099_999, ceiling)).toBe("warning");
  });

  it("flags the ceiling from exactly 100%", () => {
    expect(ceilingLevel(8_100_000, ceiling)).toBe("exceeded");
    expect(ceilingLevel(9_000_000, ceiling)).toBe("exceeded");
  });

  it("ignores a ceiling that is not set", () => {
    expect(ceilingLevel(1_000, 0)).toBe("ok");
  });

  it("works at the Simples Nacional preset without float error", () => {
    expect(ceilingLevel(384_000_000, 480_000_000)).toBe("warning");
    expect(ceilingLevel(383_999_999, 480_000_000)).toBe("ok");
  });
});
