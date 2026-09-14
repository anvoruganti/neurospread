import type { MethodName } from "@/lib/brain";

/** Plain-language labels (1–2 words) for the two source maps. */
export const METHOD_LABELS: Record<MethodName, { short: string; hint: string }> = {
  dspm: {
    short: "Sharp peaks",
    hint: "Highlights the strongest hot spots on the cortex.",
  },
  sloreta: {
    short: "Smooth spread",
    hint: "Shows a softer, wider picture of where activity may spread.",
  },
};

export function methodLabel(method: MethodName): string {
  return METHOD_LABELS[method].short;
}
