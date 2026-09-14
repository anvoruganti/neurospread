"""Estimate a seizure time window from scalp EEG without manual markers."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from pipeline.filters import default_filter_config
from pipeline.prepare import selected_channel_renames
from pipeline.run import _BASELINE_GAP_SECONDS, _BASELINE_SECONDS, _MIN_MAPPED_CHANNELS
from pipeline.window import TimeWindow

_MIN_WINDOW_S = 25.0
_MAX_WINDOW_S = 90.0
_MIN_PRE_ICTAL_S = _BASELINE_SECONDS + _BASELINE_GAP_SECONDS


def detect_seizure_window(edf_path: Path) -> TimeWindow:
    """Pick a high-activity segment with enough pre-ictal data for noise covariance."""
    import mne

    filters = default_filter_config()
    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose="error")
    renames = selected_channel_renames(raw.ch_names)
    if len(renames) < _MIN_MAPPED_CHANNELS:
        raise ValueError(
            f"could not map enough EEG channels in {edf_path.name} for automatic detection"
        )
    raw.pick(list(renames))
    raw.rename_channels(renames)
    raw.set_channel_types({name: "eeg" for name in raw.ch_names}, verbose="error")
    raw.notch_filter(filters.notch_freq, verbose="error")
    raw.filter(filters.l_freq, filters.h_freq, verbose="error")

    duration = float(raw.times[-1])
    if duration < _MIN_PRE_ICTAL_S + _MIN_WINDOW_S + 5.0:
        raise ValueError(
            "recording is too short for automatic analysis; need at least "
            f"{int(_MIN_PRE_ICTAL_S + _MIN_WINDOW_S + 5)} seconds of EEG"
        )

    sfreq = float(raw.info["sfreq"])
    data = raw.get_data()
    n_bins = max(1, int(duration))
    scores = np.zeros(n_bins, dtype=np.float64)
    for sec in range(n_bins):
        start = int(sec * sfreq)
        end = min(int((sec + 1) * sfreq), data.shape[1])
        if end - start < 2:
            continue
        chunk = data[:, start:end]
        scores[sec] = float(np.mean(np.sum(np.abs(np.diff(chunk, axis=1)), axis=0)))

    kernel = 7
    if n_bins >= kernel:
        pad = kernel // 2
        padded = np.pad(scores, (pad, pad), mode="edge")
        smooth = np.convolve(padded, np.ones(kernel) / kernel, mode="valid")
    else:
        smooth = scores

    earliest = int(_MIN_PRE_ICTAL_S)
    latest_start = max(earliest, int(duration - _MIN_WINDOW_S - 2))
    search = smooth[earliest : latest_start + 1]
    if search.size == 0:
        raise ValueError("not enough recording length after reserving pre-seizure baseline")

    peak = earliest + int(np.argmax(search))
    thresh = float(np.percentile(search, 80))
    active = smooth >= thresh

    left = peak
    while left > earliest and active[left - 1]:
        left -= 1
    right = peak
    while right < len(active) - 1 and active[right + 1]:
        right += 1

    span = right - left + 1
    if span < _MIN_WINDOW_S:
        pad = int((_MIN_WINDOW_S - span) / 2) + 1
        left = max(earliest, left - pad)
        right = min(len(active) - 1, right + pad)

    tmin = float(left)
    tmax = float(min(left + _MAX_WINDOW_S, right + 1, duration - 1.0))
    if tmax - tmin < _MIN_WINDOW_S:
        tmax = min(duration - 1.0, tmin + _MIN_WINDOW_S)

    return TimeWindow(tmin=tmin, tmax=tmax)
