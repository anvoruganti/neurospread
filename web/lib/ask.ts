export const LIMITATIONS =
  "This is a public-data proof of concept on de-identified CHB-MIT scalp EEG and a template MRI. It is not diagnostic, not patient-specific, and not clinically validated. Scalp EEG cannot locate a surgical target. One seizure does not generalize.";

const DIAGNOSTIC_MARKERS = [
  "diagnos",
  "resect",
  "surgery",
  "medication",
  "prescribe",
  "treat this patient",
];

export function isDiagnosticRequest(question: string): boolean {
  const lower = question.toLowerCase();
  return DIAGNOSTIC_MARKERS.some((marker) => lower.includes(marker));
}

export function buildAskMessages(
  question: string,
  stats: unknown,
  walkthrough: unknown,
  limitations: string
): { role: "system" | "user"; content: string }[] {
  const system = [
    "Answer only from the provided JSON stats and walkthrough.",
    "This is not a diagnosis.",
    "Do not generate images, heatmaps, or pictures.",
    `Limitations: ${limitations}`,
    `Stats JSON: ${JSON.stringify(stats)}`,
    `Walkthrough JSON: ${JSON.stringify(walkthrough)}`,
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: question },
  ];
}
