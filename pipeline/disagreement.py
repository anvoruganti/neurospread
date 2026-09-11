"""Deterministic dSPM vs sLORETA disagreement from parcel time series.

No model is called here. Cortical color still comes from the inverse.
"""

from __future__ import annotations

from typing import Any

# Desikan-Killiany same-hemisphere borders. Names omit -lh/-rh.
_APARC_NEIGHBORS: dict[str, frozenset[str]] = {
    "bankssts": frozenset(
        {"middletemporal", "superiortemporal", "inferiortemporal", "inferiorparietal"}
    ),
    "caudalanteriorcingulate": frozenset(
        {"posteriorcingulate", "rostralanteriorcingulate", "superiorfrontal"}
    ),
    "caudalmiddlefrontal": frozenset(
        {"rostralmiddlefrontal", "superiorfrontal", "precentral", "parsopercularis"}
    ),
    "cuneus": frozenset(
        {"lingual", "pericalcarine", "superiorparietal", "lateraloccipital", "precuneus"}
    ),
    "entorhinal": frozenset(
        {"parahippocampal", "fusiform", "superiortemporal", "inferiortemporal", "temporalpole"}
    ),
    "frontalpole": frozenset(
        {"rostralmiddlefrontal", "lateralorbitofrontal", "medialorbitofrontal", "superiorfrontal"}
    ),
    "fusiform": frozenset(
        {
            "inferiortemporal",
            "parahippocampal",
            "lingual",
            "lateraloccipital",
            "entorhinal",
            "middletemporal",
        }
    ),
    "inferiorparietal": frozenset(
        {
            "superiorparietal",
            "supramarginal",
            "bankssts",
            "lateraloccipital",
            "middletemporal",
            "precuneus",
        }
    ),
    "inferiortemporal": frozenset(
        {"middletemporal", "fusiform", "bankssts", "entorhinal", "lateraloccipital", "temporalpole"}
    ),
    "insula": frozenset(
        {
            "transversetemporal",
            "superiortemporal",
            "parsopercularis",
            "parstriangularis",
            "parsorbitalis",
            "lateralorbitofrontal",
            "precentral",
            "postcentral",
            "supramarginal",
        }
    ),
    "isthmuscingulate": frozenset(
        {"posteriorcingulate", "precuneus", "lingual", "parahippocampal"}
    ),
    "lateraloccipital": frozenset(
        {
            "inferiorparietal",
            "inferiortemporal",
            "fusiform",
            "lingual",
            "pericalcarine",
            "cuneus",
            "superiorparietal",
        }
    ),
    "lateralorbitofrontal": frozenset(
        {
            "medialorbitofrontal",
            "parsorbitalis",
            "parstriangularis",
            "rostralmiddlefrontal",
            "frontalpole",
            "insula",
        }
    ),
    "lingual": frozenset(
        {
            "cuneus",
            "pericalcarine",
            "fusiform",
            "isthmuscingulate",
            "parahippocampal",
            "lateraloccipital",
        }
    ),
    "medialorbitofrontal": frozenset(
        {"lateralorbitofrontal", "rostralanteriorcingulate", "frontalpole", "superiorfrontal"}
    ),
    "middletemporal": frozenset(
        {
            "superiortemporal",
            "inferiortemporal",
            "bankssts",
            "inferiorparietal",
            "fusiform",
            "temporalpole",
        }
    ),
    "paracentral": frozenset(
        {
            "precentral",
            "postcentral",
            "superiorfrontal",
            "precuneus",
            "posteriorcingulate",
            "caudalmiddlefrontal",
        }
    ),
    "parahippocampal": frozenset(
        {"entorhinal", "fusiform", "lingual", "isthmuscingulate", "inferiortemporal", "temporalpole"}
    ),
    "parsopercularis": frozenset(
        {"parstriangularis", "caudalmiddlefrontal", "precentral", "insula", "parsorbitalis"}
    ),
    "parsorbitalis": frozenset(
        {
            "parstriangularis",
            "lateralorbitofrontal",
            "parsopercularis",
            "rostralmiddlefrontal",
            "insula",
        }
    ),
    "parstriangularis": frozenset(
        {
            "parsopercularis",
            "parsorbitalis",
            "rostralmiddlefrontal",
            "insula",
            "caudalmiddlefrontal",
            "lateralorbitofrontal",
        }
    ),
    "pericalcarine": frozenset({"cuneus", "lingual", "lateraloccipital"}),
    "postcentral": frozenset(
        {"precentral", "superiorparietal", "supramarginal", "paracentral", "insula"}
    ),
    "posteriorcingulate": frozenset(
        {
            "caudalanteriorcingulate",
            "isthmuscingulate",
            "precuneus",
            "paracentral",
            "rostralanteriorcingulate",
        }
    ),
    "precentral": frozenset(
        {
            "postcentral",
            "caudalmiddlefrontal",
            "paracentral",
            "parsopercularis",
            "superiorfrontal",
            "insula",
        }
    ),
    "precuneus": frozenset(
        {
            "superiorparietal",
            "inferiorparietal",
            "isthmuscingulate",
            "posteriorcingulate",
            "cuneus",
            "paracentral",
        }
    ),
    "rostralanteriorcingulate": frozenset(
        {
            "caudalanteriorcingulate",
            "medialorbitofrontal",
            "superiorfrontal",
            "posteriorcingulate",
        }
    ),
    "rostralmiddlefrontal": frozenset(
        {
            "caudalmiddlefrontal",
            "superiorfrontal",
            "parstriangularis",
            "parsorbitalis",
            "frontalpole",
            "lateralorbitofrontal",
        }
    ),
    "superiorfrontal": frozenset(
        {
            "rostralmiddlefrontal",
            "caudalmiddlefrontal",
            "precentral",
            "paracentral",
            "frontalpole",
            "rostralanteriorcingulate",
            "caudalanteriorcingulate",
            "medialorbitofrontal",
        }
    ),
    "superiorparietal": frozenset(
        {"inferiorparietal", "postcentral", "precuneus", "cuneus", "lateraloccipital"}
    ),
    "superiortemporal": frozenset(
        {
            "middletemporal",
            "transversetemporal",
            "insula",
            "bankssts",
            "inferiortemporal",
            "supramarginal",
            "temporalpole",
            "entorhinal",
        }
    ),
    "supramarginal": frozenset(
        {"inferiorparietal", "postcentral", "superiortemporal", "insula"}
    ),
    "temporalpole": frozenset(
        {
            "superiortemporal",
            "middletemporal",
            "inferiortemporal",
            "entorhinal",
            "parahippocampal",
        }
    ),
    "transversetemporal": frozenset({"superiortemporal", "insula"}),
}

_TIME_LAG_S = 2.0
_SPREAD_TOP_N = 8
_METHODS = ("dspm", "sloreta")


def split_label(label: str) -> tuple[str, str]:
    if label.endswith("-lh"):
        return "lh", label[: -len("-lh")]
    if label.endswith("-rh"):
        return "rh", label[: -len("-rh")]
    if label.startswith("lh-"):
        return "lh", label[len("lh-") :]
    if label.startswith("rh-"):
        return "rh", label[len("rh-") :]
    return "lh", label


def classify_peak_pair(label_a: str, label_b: str) -> str:
    if not label_a or not label_b or label_a == "unknown" or label_b == "unknown":
        return "unknown"
    if label_a == label_b:
        return "agree"
    hemi_a, name_a = split_label(label_a)
    hemi_b, name_b = split_label(label_b)
    if hemi_a != hemi_b:
        return "hemisphere_flip"
    neighbors = _APARC_NEIGHBORS.get(name_a, frozenset())
    if name_b in neighbors:
        return "adjacent"
    return "distant"


def _parcel_peak(parcel: dict, method: str) -> dict[str, Any] | None:
    stats = parcel.get("methods", {}).get(method)
    if not stats:
        return None
    return {
        "peak_time": float(stats["peak_time"]),
        "peak_value": float(stats["peak_value"]),
        "mean": list(stats.get("mean") or []),
    }


def _peaks_from_parcels(parcels: dict, method: str) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    for name, parcel in parcels.get("parcels", {}).items():
        peak = _parcel_peak(parcel, method)
        if peak is None:
            continue
        if best is None or peak["peak_value"] > best["peak_value"]:
            best = {"parcel": name, **peak}
    return best


def _peaks_from_stats(stats: dict, method: str) -> dict[str, Any]:
    block = (stats.get("per_method") or {}).get(method) or {}
    return {
        "parcel": block.get("peak_label") or "unknown",
        "peak_time": float(block.get("peak_time") or 0.0),
        "peak_value": None,
        "mean": [],
        "hemisphere": block.get("hemisphere"),
    }


def spread_order(parcels: dict, method: str, *, top_n: int = _SPREAD_TOP_N) -> list[dict]:
    times = [float(t) for t in parcels.get("times") or []]
    ranked: list[dict] = []
    for name, parcel in parcels.get("parcels", {}).items():
        peak = _parcel_peak(parcel, method)
        if peak is None or not peak["mean"] or not times:
            continue
        ranked.append({"parcel": name, **peak})
    ranked.sort(key=lambda row: row["peak_value"], reverse=True)
    chosen = ranked[:top_n]
    chosen.sort(key=lambda row: row["peak_value"], reverse=True)
    out: list[dict] = []
    for row in chosen:
        series = row["mean"]
        peak_value = row["peak_value"]
        threshold = 0.5 * peak_value
        first_index = 0
        for i, value in enumerate(series):
            if value >= threshold:
                first_index = i
                break
        time = times[min(first_index, len(times) - 1)]
        out.append(
            {
                "parcel": row["parcel"],
                "time": time,
                "peak_value": round(peak_value, 6),
            }
        )
    out.sort(key=lambda row: (row["time"], -row["peak_value"]))
    for index, row in enumerate(out):
        row["rank"] = index + 1
    return out


def hemisphere_series(parcels: dict, method: str) -> dict[str, Any]:
    times = [float(t) for t in parcels.get("times") or []]
    left: list[float] = []
    right: list[float] = []
    fractions: list[float] = []
    n = len(times)
    for i in range(n):
        lh = 0.0
        rh = 0.0
        for name, parcel in parcels.get("parcels", {}).items():
            peak = _parcel_peak(parcel, method)
            if peak is None or i >= len(peak["mean"]):
                continue
            hemi, _ = split_label(name)
            value = float(peak["mean"][i])
            if hemi == "rh":
                rh += value
            else:
                lh += value
        total = lh + rh
        left.append(round(lh, 6))
        right.append(round(rh, 6))
        fractions.append(0.0 if total == 0.0 else round(lh / total, 6))
    return {"times": times, "left": left, "right": right, "left_fraction": fractions}


def top_parcels(parcels: dict, method: str, *, n: int = _SPREAD_TOP_N) -> list[dict]:
    rows: list[dict] = []
    for name, parcel in parcels.get("parcels", {}).items():
        peak = _parcel_peak(parcel, method)
        if peak is None:
            continue
        rows.append(
            {
                "parcel": name,
                "peak_time": peak["peak_time"],
                "peak_value": round(peak["peak_value"], 6),
            }
        )
    rows.sort(key=lambda row: row["peak_value"], reverse=True)
    return rows[:n]


def build_captions(
    *,
    peaks: dict[str, dict],
    disagreement_type: str,
    time_lag: bool,
    recording: str,
    tmin: float | None = None,
) -> list[dict[str, Any]]:
    dspm = peaks.get("dspm") or {}
    sloreta = peaks.get("sloreta") or {}
    t_dspm = float(dspm.get("peak_time") or 0.0)
    t_slo = float(sloreta.get("peak_time") or 0.0)
    t_start = float(tmin) if tmin is not None else min((t for t in (t_dspm, t_slo) if t), default=0.0)
    captions = [
        {
            "t": t_start,
            "method": "dspm",
            "text": (
                f"Computed captions for {recording}. "
                "They come from parcel numbers, not from a language model."
            ),
        },
        {
            "t": t_dspm,
            "method": "dspm",
            "text": (
                f"dSPM peaks in {dspm.get('parcel', 'unknown')} at {t_dspm:.2f} s."
            ),
        },
        {
            "t": t_slo,
            "method": "sloreta",
            "text": (
                f"sLORETA peaks in {sloreta.get('parcel', 'unknown')} at {t_slo:.2f} s."
            ),
        },
    ]
    if disagreement_type == "agree":
        captions.append(
            {
                "t": max(t_dspm, t_slo),
                "method": "dspm",
                "text": "The two inverses peak in the same parcel in this window.",
            }
        )
    else:
        lag = " Peak times also differ." if time_lag else ""
        captions.append(
            {
                "t": max(t_dspm, t_slo),
                "method": "dspm",
                "text": (
                    f"The inverses disagree ({disagreement_type}). "
                    "That is ambiguity on a template inverse, not a known focus."
                    f"{lag}"
                ),
            }
        )
    return captions


def compact_case(stats: dict, disagreement: dict) -> dict[str, Any]:
    """JSON sent to study models. No full parcel atlas, no activity.bin."""
    peaks = disagreement.get("peaks") or {}
    series: dict[str, Any] = {}
    for method, peak in peaks.items():
        series[method] = {
            "parcel": peak.get("parcel"),
            "peak_time": peak.get("peak_time"),
            "peak_value": peak.get("peak_value"),
            "mean": peak.get("mean") or [],
        }
    return {
        "recording": stats.get("recording") or disagreement.get("recording"),
        "window": stats.get("window"),
        "filters": stats.get("filters"),
        "src": stats.get("src"),
        "per_method": stats.get("per_method"),
        "disagreement_type": disagreement.get("type"),
        "time_lag": disagreement.get("time_lag"),
        "time_lag_seconds": disagreement.get("time_lag_seconds"),
        "peaks": series,
        "top_parcels": disagreement.get("top_parcels"),
        "spread_order": disagreement.get("spread_order"),
        "limitations": (
            "Public de-identified CHB-MIT scalp EEG on fsaverage. "
            "Not diagnostic. No patient MRI. No surgical outcome. "
            "Disagreement is not a ground-truth focus."
        ),
    }


def analyze_disagreement(
    parcels: dict | None,
    stats: dict | None = None,
    *,
    time_lag_s: float = _TIME_LAG_S,
) -> dict[str, Any]:
    stats = stats or {}
    parcels = parcels or {}
    recording = stats.get("recording") or "unknown"
    peaks: dict[str, dict] = {}
    for method in _METHODS:
        from_parcels = _peaks_from_parcels(parcels, method) if parcels.get("parcels") else None
        from_stats = _peaks_from_stats(stats, method) if stats.get("per_method") else None
        if from_stats and from_stats["parcel"] != "unknown":
            merged = dict(from_stats)
            if from_parcels:
                merged["peak_value"] = from_parcels.get("peak_value")
                merged["mean"] = from_parcels.get("mean") or []
                # Keep the stats peak_label (vertex argmax). Parcel-mean peak may differ.
                parcel_mean_peak = from_parcels["parcel"]
                merged["parcel_mean_peak"] = parcel_mean_peak
            peaks[method] = merged
        elif from_parcels:
            peaks[method] = {
                "parcel": from_parcels["parcel"],
                "peak_time": from_parcels["peak_time"],
                "peak_value": from_parcels["peak_value"],
                "mean": from_parcels["mean"],
            }
        else:
            peaks[method] = {
                "parcel": "unknown",
                "peak_time": 0.0,
                "peak_value": None,
                "mean": [],
            }

    label_a = str(peaks["dspm"].get("parcel") or "unknown")
    label_b = str(peaks["sloreta"].get("parcel") or "unknown")
    disagreement_type = classify_peak_pair(label_a, label_b)
    t_a = float(peaks["dspm"].get("peak_time") or 0.0)
    t_b = float(peaks["sloreta"].get("peak_time") or 0.0)
    lag = abs(t_a - t_b)
    time_lag = lag > time_lag_s

    result: dict[str, Any] = {
        "recording": recording,
        "methods": list(_METHODS),
        "peaks": {
            method: {
                "parcel": peak.get("parcel"),
                "peak_time": peak.get("peak_time"),
                "peak_value": peak.get("peak_value"),
                "mean": peak.get("mean") or [],
                "hemisphere": peak.get("hemisphere"),
                "parcel_mean_peak": peak.get("parcel_mean_peak"),
            }
            for method, peak in peaks.items()
        },
        "type": disagreement_type,
        "time_lag": time_lag,
        "time_lag_seconds": round(lag, 4),
        "spread_order": {},
        "hemisphere_series": {},
        "top_parcels": {},
        "highlight": [label_a, label_b],
        "source": "deterministic",
    }
    if parcels.get("parcels"):
        for method in _METHODS:
            result["spread_order"][method] = spread_order(parcels, method)
            result["hemisphere_series"][method] = hemisphere_series(parcels, method)
            result["top_parcels"][method] = top_parcels(parcels, method)
    window = stats.get("window") or {}
    tmin = window.get("tmin")
    result["captions"] = build_captions(
        peaks=result["peaks"],
        disagreement_type=disagreement_type,
        time_lag=time_lag,
        recording=recording,
        tmin=float(tmin) if tmin is not None else None,
    )
    return result
