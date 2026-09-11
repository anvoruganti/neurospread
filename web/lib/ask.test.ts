import { describe, expect, it } from "vitest";
import { buildAskMessages, isDiagnosticRequest } from "./ask";
import { activityAt, nearestTimeIndex, suggestedRegionQuestion } from "./brain";
import { activeCaptionIndex, parseAskAnswer, prettyParcel, propagationPath } from "./guide";
import { buildReportHtml } from "./report";

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
    expect(system).toContain("Reply with JSON only");
    expect(messages[1].content).toContain("When is the peak?");
  });

  it("includes clicked region parcel context when provided", () => {
    const messages = buildAskMessages(
      "How is this region at the peak?",
      { recording: "chb01_03.edf" },
      { captions: [] },
      "Not diagnostic.",
      {
        region: "inferiortemporal-rh",
        method: "dspm",
        time: 3031.54,
        parcel: { peak_time: 3031.54, peak_value: 3.2 },
      }
    );
    const system = messages[0].content;
    expect(system).toContain("inferiortemporal-rh");
    expect(system).toContain("3031.54");
    expect(system).toContain("Clicked region context");
  });
});

describe("brain helpers", () => {
  it("reads method_time_vertex activity slices", () => {
    // 2 methods, 2 times, 3 vertices: m0t0=[1,2,3] m0t1=[4,5,6] m1t0=[7,8,9] m1t1=[10,11,12]
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(Array.from(activityAt(data, 0, 1, 2, 3))).toEqual([4, 5, 6]);
    expect(Array.from(activityAt(data, 1, 0, 2, 3))).toEqual([7, 8, 9]);
  });

  it("finds the nearest sample time", () => {
    expect(nearestTimeIndex([2996, 2997, 2998], 2997.4)).toBe(1);
  });

  it("builds a grounded suggested question", () => {
    expect(suggestedRegionQuestion("inferiortemporal-rh", "dspm", 3031)).toContain(
      "inferiortemporal-rh"
    );
  });
});

describe("parseAskAnswer", () => {
  it("reads structured overlay actions", () => {
    const action = parseAskAnswer(
      JSON.stringify({
        text: "They disagree.",
        seek_time: 3031.54,
        method: "dspm",
        highlight: ["inferiortemporal-rh"],
        split: true,
      })
    );
    expect(action.text).toBe("They disagree.");
    expect(action.seek_time).toBe(3031.54);
    expect(action.method).toBe("dspm");
    expect(action.highlight).toEqual(["inferiortemporal-rh"]);
    expect(action.split).toBe(true);
  });

  it("falls back to plain text", () => {
    expect(parseAskAnswer("just a sentence").text).toBe("just a sentence");
  });
});

describe("propagationPath", () => {
  it("collapses the same timestamp to the strongest parcel and ends at the peak", () => {
    const path = propagationPath(
      [
        { parcel: "middletemporal-rh", time: 3001, peak_value: 10 },
        { parcel: "superiortemporal-rh", time: 3002, peak_value: 11 },
        { parcel: "inferiortemporal-rh", time: 3002, peak_value: 9 },
        { parcel: "transversetemporal-lh", time: 3025, peak_value: 8 },
      ],
      "inferiortemporal-rh",
      3031.54
    );
    expect(path.map((step) => step.parcel)).toEqual([
      "middletemporal-rh",
      "superiortemporal-rh",
      "inferiortemporal-rh",
    ]);
  });
});

describe("prettyParcel", () => {
  it("names hemisphere in plain language", () => {
    expect(prettyParcel("inferiortemporal-rh")).toContain("right");
    expect(prettyParcel("inferiortemporal-rh")).toContain("temporal");
  });
});

describe("activeCaptionIndex", () => {
  it("picks the last caption at or before the playhead", () => {
    const captions = [
      { t: 2996, text: "start" },
      { t: 3031, text: "peak" },
      { t: 3036, text: "end" },
    ];
    expect(activeCaptionIndex(captions, 3010)).toBe(0);
    expect(activeCaptionIndex(captions, 3031)).toBe(1);
  });
});

describe("buildReportHtml", () => {
  it("is labeled as not a clinical report and includes the peak parcels", () => {
    const html = buildReportHtml(
      {
        recording: "chb01_03.edf",
        window: { tmin: 2996, tmax: 3036 },
        per_method: {
          dspm: { peak_time: 3031.54, peak_label: "inferiortemporal-rh" },
          sloreta: { peak_time: 3031.54, peak_label: "parstriangularis-rh" },
        },
      },
      {
        type: "distant",
        spread_order: {
          dspm: [{ parcel: "middletemporal-rh", time: 3001, peak_value: 10 }],
        },
        peaks: {
          dspm: { parcel: "inferiortemporal-rh", peak_time: 3031.54 },
        },
      }
    );
    expect(html).toContain("Not a clinical report");
    expect(html).toContain("inferior temporal");
    expect(html).toContain("parstriangularis");
    expect(html.toLowerCase()).not.toContain("resect");
  });
});
