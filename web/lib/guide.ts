import { BrainMesh, MethodName } from "@/lib/brain";

export type Caption = {
  t?: number;
  method?: string;
  text?: string;
};

export type SpreadStep = {
  parcel: string;
  time: number;
  peak_value: number;
  rank?: number;
};

export type DisagreementFile = {
  recording?: string;
  type?: string;
  time_lag?: boolean;
  time_lag_seconds?: number;
  highlight?: string[];
  captions?: Caption[];
  spread_order?: Partial<Record<MethodName, SpreadStep[]>>;
  peaks?: Partial<
    Record<
      MethodName,
      {
        parcel?: string;
        peak_time?: number;
        peak_value?: number | null;
        hemisphere?: { left?: number; right?: number; left_fraction?: number };
      }
    >
  >;
  source?: string;
};

export type SceneAction = {
  text: string;
  seek_time?: number | null;
  method?: MethodName | null;
  highlight?: string[] | null;
  split?: boolean | null;
};

export function parseAskAnswer(raw: string): SceneAction {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      text?: unknown;
      seek_time?: unknown;
      method?: unknown;
      highlight?: unknown;
      split?: unknown;
    };
    if (typeof parsed.text === "string" && parsed.text.trim()) {
      const method =
        parsed.method === "dspm" || parsed.method === "sloreta" ? parsed.method : null;
      const highlight = Array.isArray(parsed.highlight)
        ? parsed.highlight.filter((name): name is string => typeof name === "string")
        : null;
      return {
        text: parsed.text,
        seek_time: typeof parsed.seek_time === "number" ? parsed.seek_time : null,
        method,
        highlight,
        split: typeof parsed.split === "boolean" ? parsed.split : null,
      };
    }
  } catch {
    // Fall through to plain text.
  }
  return { text: trimmed };
}

export function prettyParcel(label: string): string {
  const hemi = label.endsWith("-rh") ? "right" : label.endsWith("-lh") ? "left" : "";
  const stem = label.replace(/-rh$/, "").replace(/-lh$/, "");
  const spaced = stem
    .replace(
      /(anterior|posterior|inferior|superior|middle|lateral|medial|caudal|rostral|transverse|pars)/g,
      " $1"
    )
    .replace(
      /(temporal|frontal|parietal|occipital|cingulate|orbital|calcarine|central|marginal|hippocampal|rhinal|cuneus|precuneus|insula|bankssts|pole)/g,
      " $1"
    )
    .replace(/\s+/g, " ")
    .trim();
  return hemi ? `${spaced} (${hemi})` : spaced || label;
}

/** Collapse simultaneous parcels to the strongest, then run start to the method peak. */
export function propagationPath(
  steps: SpreadStep[] | undefined,
  peakParcel?: string,
  peakTime?: number
): SpreadStep[] {
  if (!steps?.length) {
    if (peakParcel && typeof peakTime === "number") {
      return [{ parcel: peakParcel, time: peakTime, peak_value: 0 }];
    }
    return [];
  }
  const cutoff = typeof peakTime === "number" ? peakTime + 0.51 : Infinity;
  const byTime = new Map<number, SpreadStep>();
  for (const step of steps) {
    if (step.time > cutoff) continue;
    const prev = byTime.get(step.time);
    if (!prev || step.peak_value > prev.peak_value) {
      byTime.set(step.time, step);
    }
  }
  const ordered = Array.from(byTime.values()).sort(
    (a, b) => a.time - b.time || b.peak_value - a.peak_value
  );
  if (!ordered.length) {
    if (peakParcel && typeof peakTime === "number") {
      return [{ parcel: peakParcel, time: peakTime, peak_value: 0 }];
    }
    return [];
  }
  const cluster = [ordered[0]];
  for (const step of ordered.slice(1)) {
    const last = cluster[cluster.length - 1];
    if (step.time - last.time <= 5) cluster.push(step);
    else break;
  }
  if (peakParcel && cluster[cluster.length - 1]?.parcel !== peakParcel) {
    cluster.push({
      parcel: peakParcel,
      time: typeof peakTime === "number" ? peakTime : cluster[cluster.length - 1].time,
      peak_value: cluster[cluster.length - 1].peak_value,
    });
  }
  return cluster;
}

export function liftCentroid(
  point: [number, number, number],
  amount = 10
): [number, number, number] {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const len = Math.hypot(x, y, z) || 1;
  const s = (len + amount) / len;
  return [x * s, y * s, z * s];
}

export function activeCaptionIndex(captions: Caption[], time: number): number {
  let best = 0;
  for (let i = 0; i < captions.length; i += 1) {
    const t = captions[i]?.t;
    if (typeof t === "number" && t <= time + 0.51) {
      best = i;
    }
  }
  return best;
}

export function parcelCentroid(
  mesh: BrainMesh,
  label: string,
  gap = 45
): [number, number, number] | null {
  const hemiKey = label.endsWith("-rh") || label.startsWith("rh-") ? "rh" : "lh";
  const hemi = mesh.hemispheres[hemiKey];
  const offsetX = hemiKey === "rh" ? gap : -gap;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (let i = 0; i < hemi.labels.length; i += 1) {
    if (hemi.labels[i] !== label) continue;
    sx += hemi.vertices[i][0] + offsetX;
    sy += hemi.vertices[i][1];
    sz += hemi.vertices[i][2];
    n += 1;
  }
  if (n === 0) return null;
  return [sx / n, sy / n, sz / n];
}
