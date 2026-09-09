from __future__ import annotations

import numpy as np

from pipeline.filters import FilterConfig
from pipeline.window import TimeWindow


def peak_from_source_data(times: np.ndarray, data: np.ndarray, labels: list[str]) -> dict:
    flat_index = int(np.argmax(np.abs(data)))
    source_i, time_i = np.unravel_index(flat_index, data.shape)
    source_i = int(source_i)
    time_i = int(time_i)
    return {
        "peak_time": float(times[time_i]),
        "peak_label": labels[source_i],
        "peak_index": source_i,
    }


def hemisphere_power(lh: np.ndarray, rh: np.ndarray) -> dict:
    left = float(np.mean(np.abs(lh)))
    right = float(np.mean(np.abs(rh)))
    total = left + right
    left_fraction = 0.0 if total == 0.0 else left / total
    return {"left": left, "right": right, "left_fraction": left_fraction}


def build_seizure_stats(
    *,
    recording: str,
    window: TimeWindow,
    filters: FilterConfig,
    src: str,
    per_method: dict,
) -> dict:
    return {
        "recording": recording,
        "window": {"tmin": window.tmin, "tmax": window.tmax},
        "filters": {
            "l_freq": filters.l_freq,
            "h_freq": filters.h_freq,
            "notch_freq": filters.notch_freq,
        },
        "src": src,
        "methods": list(per_method.keys()),
        "per_method": per_method,
    }
