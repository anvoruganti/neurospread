export const LIMITATIONS =
  "This is a public-data proof of concept on de-identified CHB-MIT scalp EEG and a template MRI. It is not diagnostic, not patient-specific, and not clinically validated. Scalp EEG cannot locate a surgical target. One seizure does not generalize. When dSPM and sLORETA disagree, that is ambiguity, not a known focus.";

const DIAGNOSTIC_MARKERS = [
  "diagnos",
  "resect",
  "surgery",
  "medication",
  "prescribe",
  "treat this patient",
];

export type AskRegionContext = {
  region?: string;
  method?: string;
  time?: number;
  parcel?: unknown;
};

export function isDiagnosticRequest(question: string): boolean {
  const lower = question.toLowerCase();
  return DIAGNOSTIC_MARKERS.some((marker) => lower.includes(marker));
}

export function buildAskMessages(
  question: string,
  stats: unknown,
  walkthrough: unknown,
  limitations: string,
  region?: AskRegionContext,
  disagreement?: unknown
): { role: "system" | "user"; content: string }[] {
  const parts = [
    "Answer only from the provided JSON stats, disagreement, walkthrough, and optional clicked-region parcel series.",
    "This is not a diagnosis.",
    "Do not generate images, heatmaps, or pictures.",
    "When the two inverses disagree, say so. Do not pick a surgical target or a known focus.",
    "Reply with JSON only: {\"text\": string, \"seek_time\": number|null, \"method\": \"dspm\"|\"sloreta\"|null, \"highlight\": string[]|null, \"split\": boolean|null}.",
    "text is short plain sentences. seek_time and highlight may point at parcels named in the JSON. split true shows dSPM and sLORETA together.",
    `Limitations: ${limitations}`,
    `Stats JSON: ${JSON.stringify(stats)}`,
    `Disagreement JSON: ${JSON.stringify(disagreement ?? {})}`,
    `Walkthrough JSON: ${JSON.stringify(walkthrough)}`,
  ];
  if (region?.region || region?.method || typeof region?.time === "number") {
    parts.push(
      `Clicked region context: ${JSON.stringify({
        region: region.region ?? null,
        method: region.method ?? null,
        time: region.time ?? null,
        parcel: region.parcel ?? null,
      })}`
    );
  }
  return [
    { role: "system", content: parts.join("\n") },
    { role: "user", content: question },
  ];
}
