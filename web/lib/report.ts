import { LIMITATIONS } from "./ask";
import { DisagreementFile, prettyParcel, propagationPath } from "./guide";

export type SeizureStats = {
  recording?: string;
  window?: { tmin?: number; tmax?: number };
  filters?: { l_freq?: number; h_freq?: number; notch_freq?: number };
  src?: string;
  methods?: string[];
  per_method?: Record<
    string,
    {
      peak_time?: number;
      peak_label?: string;
      hemisphere?: { left?: number; right?: number; left_fraction?: number };
    }
  >;
};

function pct(value: number | undefined): string {
  if (typeof value !== "number") return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function pathSentence(steps: ReturnType<typeof propagationPath>): string {
  if (!steps.length) return "No spread order was computed for this method.";
  const names = steps.map((step) => `${prettyParcel(step.parcel)} at ${step.time.toFixed(0)} s`);
  if (names.length === 1) return `Activity first rises in ${names[0]}.`;
  return `Among the strongest parcels, mean amplitude crosses half of each parcel's own peak first in ${names[0]}, then ${names.slice(1, -1).join(", ")}${names.length > 2 ? ", then " : ""}${names[names.length - 1]}.`;
}

export function buildReportHtml(stats: SeizureStats, disagreement: DisagreementFile): string {
  const recording = stats.recording || disagreement.recording || "unknown";
  const tmin = stats.window?.tmin;
  const tmax = stats.window?.tmax;
  const dspm = stats.per_method?.dspm;
  const sloreta = stats.per_method?.sloreta;
  const dspmPath = propagationPath(
    disagreement.spread_order?.dspm,
    disagreement.peaks?.dspm?.parcel || dspm?.peak_label,
    disagreement.peaks?.dspm?.peak_time ?? dspm?.peak_time
  );
  const sloPath = propagationPath(
    disagreement.spread_order?.sloreta,
    disagreement.peaks?.sloreta?.parcel || sloreta?.peak_label,
    disagreement.peaks?.sloreta?.peak_time ?? sloreta?.peak_time
  );
  const generated = new Date().toISOString().slice(0, 10);
  const dspmStart = dspmPath[0];
  const dspmEnd = dspmPath[dspmPath.length - 1];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Source-estimate note · ${recording}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; max-width: 720px; margin: 40px auto; padding: 0 24px 64px; line-height: 1.45; }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    p, li { font-size: 14px; }
    .banner { background: #111; color: #f4d58d; padding: 12px 14px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; }
    .meta { color: #444; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e5e5e5; padding: 6px 8px; vertical-align: top; }
    th { width: 34%; color: #555; font-weight: 600; }
  </style>
</head>
<body>
  <p class="banner">Not a clinical report. Public de-identified CHB-MIT scalp EEG on a template brain. Not diagnostic. Not patient-specific.</p>
  <h1>Source-estimate note</h1>
  <p class="meta">Recording ${recording}. Generated ${generated} from computed dSPM and sLORETA JSON. This is a proof-of-concept summary in the style of an EEG localization note. It is not an epileptologist interpretation of a patient.</p>

  <h2>Study identifiers</h2>
  <table>
    <tr><th>Recording</th><td>${recording}</td></tr>
    <tr><th>Window</th><td>${tmin ?? "?"}–${tmax ?? "?"} s (annotated seizure)</td></tr>
    <tr><th>Filters</th><td>${stats.filters?.l_freq ?? "?"}–${stats.filters?.h_freq ?? "?"} Hz band-pass, ${stats.filters?.notch_freq ?? "?"} Hz notch</td></tr>
    <tr><th>Head model</th><td>${stats.src ?? "fsaverage"} template MRI, not this subject's scan</td></tr>
    <tr><th>Inverse</th><td>dSPM and sLORETA, same window and forward model</td></tr>
  </table>

  <h2>Findings in this window</h2>
  <p>dSPM vertex peak: ${prettyParcel(dspm?.peak_label || disagreement.peaks?.dspm?.parcel || "unknown")} at ${(dspm?.peak_time ?? 0).toFixed(2)} s. Left-hemisphere power fraction ${pct(dspm?.hemisphere?.left_fraction)}.</p>
  <p>sLORETA vertex peak: ${prettyParcel(sloreta?.peak_label || disagreement.peaks?.sloreta?.parcel || "unknown")} at ${(sloreta?.peak_time ?? 0).toFixed(2)} s. Left-hemisphere power fraction ${pct(sloreta?.hemisphere?.left_fraction)}.</p>
  <p>The two inverses ${disagreement.type === "agree" ? "peak in the same parcel" : `disagree (${disagreement.type}${disagreement.time_lag ? ", with a peak-time lag" : ""})`}. On scalp EEG with a template head model, that disagreement is ambiguity, not a known seizure focus.</p>

  <h2>Estimated spread order (dSPM)</h2>
  <p>${pathSentence(dspmPath)}</p>
  <p>Start parcel: ${dspmStart ? prettyParcel(dspmStart.parcel) : "unknown"}. End parcel (method peak): ${dspmEnd ? prettyParcel(dspmEnd.parcel) : "unknown"}.</p>
  <p>This order is the time when each strong parcel's mean first crosses half of its own peak. It is not electrographic seizure onset and not a propagation tract.</p>

  <h2>Estimated spread order (sLORETA)</h2>
  <p>${pathSentence(sloPath)}</p>

  <h2>Impression</h2>
  <p>In this public recording, source-estimate amplitude under dSPM rises first in ${dspmStart ? prettyParcel(dspmStart.parcel) : "an undetermined parcel"} and the map peaks in ${prettyParcel(dspm?.peak_label || "unknown")}. sLORETA peaks in ${prettyParcel(sloreta?.peak_label || "unknown")}. I would not use either map to plan surgery, choose medication, or name a focus.</p>

  <h2>Limitations</h2>
  <p>${LIMITATIONS} Channel mapping from CHB-MIT bipolar labels onto 10-20 positions is an approximation. Volume conduction leaves centimeters of uncertainty.</p>
</body>
</html>`;
}

export function downloadReport(stats: SeizureStats, disagreement: DisagreementFile): void {
  const html = buildReportHtml(stats, disagreement);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const recording = (stats.recording || "recording").replace(/\.edf$/i, "");
  anchor.href = url;
  anchor.download = `${recording}-source-estimate-note.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
