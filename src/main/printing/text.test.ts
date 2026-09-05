import { describe, expect, it } from "vitest";

import { asciiText, dots, formatDateTime, truncate } from "./text";

describe("printer text helpers", () => {
  it("converts physical dimensions to printer dots", () => {
    expect(dots(25.4, 203)).toBe(203);
    expect(dots(25.4, 300)).toBe(300);
  });

  it("transliterates labels and removes printer control characters", () => {
    expect(asciiText('PEÑÓN · "NORTE" ^ ~')).toBe("PENON - NORTE");
  });

  it("formats Chilean time and truncates constrained labels", () => {
    expect(formatDateTime("2026-01-15T13:30:00.000Z")).toBe("15-01-2026 10:30");
    expect(truncate("CONTRATISTA", 6)).toBe("CONTR.");
  });
});