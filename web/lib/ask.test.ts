import { describe, expect, it } from "vitest";
import { buildAskMessages, isDiagnosticRequest } from "./ask";

describe("isDiagnosticRequest", () => {
  it("refuses diagnosis and surgery language", () => {
    expect(isDiagnosticRequest("What is the diagnosis?")).toBe(true);
    expect(isDiagnosticRequest("Where should we resect?")).toBe(true);
    expect(isDiagnosticRequest("What medication should I take?")).toBe(true);
  });

  it("allows questions about this recording", () => {
    expect(isDiagnosticRequest("When does dSPM peak in this recording?")).toBe(false);
  });
});

describe("buildAskMessages", () => {
  it("includes stats, walkthrough, and limitations in the system text", () => {
    const messages = buildAskMessages(
      "When is the peak?",
      { recording: "chb01_03.edf" },
      { captions: [] },
      "Not diagnostic."
    );
    const system = messages[0].content;
    expect(system).toContain("chb01_03.edf");
    expect(system).toContain("Not diagnostic.");
    expect(system).toContain("Do not generate images");
    expect(messages[1].content).toContain("When is the peak?");
  });
});
