export type MethodName = "dspm" | "sloreta";

export type HemisphereMesh = {
  vertices: number[][];
  faces: number[][];
  labels: string[];
};

export type BrainMesh = {
  subject: string;
  surface: string;
  hemispheres: {
    lh: HemisphereMesh;
    rh: HemisphereMesh;
  };
  activity: {
    methods: MethodName[];
    n_times: number;
    n_vertices: number;
    dtype: string;
    layout: string;
    file: string;
    times: number[];
  };
};

export type ParcelMethodStats = {
  mean: number[];
  peak_time: number;
  peak_value: number;
};

export type ParcelStats = {
  hemisphere: "lh" | "rh";
  n_vertices: number;
  methods: Partial<Record<MethodName, ParcelMethodStats>>;
};

export type ParcelsFile = {
  times: number[];
  methods: MethodName[];
  parcels: Record<string, ParcelStats>;
};

export type RegionSelection = {
  label: string;
  method: MethodName;
  time: number;
  screenX: number;
  screenY: number;
};

/** Sample activity for one method and time index from method_time_vertex layout. */
export function activityAt(
  data: Float32Array,
  methodIndex: number,
  timeIndex: number,
  nTimes: number,
  nVertices: number
): Float32Array {
  const offset = (methodIndex * nTimes + timeIndex) * nVertices;
  return data.subarray(offset, offset + nVertices);
}

/** Hot-ish colormap matching the MNE stills: black -> red -> yellow -> white. */
export function activityToColor(
  value: number,
  vmax: number,
  out: Float32Array,
  offset: number
): void {
  const t = vmax <= 0 ? 0 : Math.min(1, Math.max(0, value / vmax));
  if (t < 0.33) {
    const u = t / 0.33;
    out[offset] = u;
    out[offset + 1] = 0;
    out[offset + 2] = 0;
  } else if (t < 0.66) {
    const u = (t - 0.33) / 0.33;
    out[offset] = 1;
    out[offset + 1] = u;
    out[offset + 2] = 0;
  } else {
    const u = (t - 0.66) / 0.34;
    out[offset] = 1;
    out[offset + 1] = 1;
    out[offset + 2] = u;
  }
}

export function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1)))
  );
  return sorted[index];
}

export function nearestTimeIndex(times: number[], time: number): number {
  let best = 0;
  let bestDist = Math.abs(times[0] - time);
  for (let i = 1; i < times.length; i += 1) {
    const dist = Math.abs(times[i] - time);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

export function suggestedRegionQuestion(
  label: string,
  method: MethodName,
  time: number
): string {
  return `How does ${label} look under ${method} at ${time.toFixed(0)} s relative to the rest of the cortex in this recording?`;
}

export function numbersStrip(parcel: ParcelStats | undefined, method: MethodName): string {
  const stats = parcel?.methods[method];
  if (!stats) {
    return "No parcel numbers for this region yet.";
  }
  return `From the numbers: peak ${stats.peak_value.toFixed(3)} at ${stats.peak_time.toFixed(2)} s (${parcel?.hemisphere ?? "?"}).`;
}
