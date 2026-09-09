# NeuroSpread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute dSPM and sLORETA seizure-spread movies from CHB-MIT `chb01_03.edf` and present them on a dark clinical Next.js site with a GPT-6 Astra guide grounded in those stats.

**Architecture:** A `pipeline` Python package (run as `python -m pipeline`) downloads the EDF, filters, inverse-solves on fsaverage for the 2996–3036 s window, renders `.mp4`/`.png` from the source estimates, writes `seizure-stats.json`, then asks Astra for a walkthrough. Derived files are copied into `web/public/`. The Next.js 14 app plays those files and exposes `POST /api/ask`.

**Tech Stack:** Python 3.11, pytest, MNE-Python, NumPy, SciPy, matplotlib, PyVista, imageio-ffmpeg; Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-neurospread-design.md`

## Global Constraints

- Compute dSPM and sLORETA on `chb01_03.edf` for the annotated seizure window 2996–3036 seconds.
- Render cortical heatmaps from those source estimates. Export `.mp4` and `.png`.
- Do not call any image-generation model for a brain, heatmap, still, or movie.
- GPT-6 Astra may write helper text from computed stats. Astra must never produce the map.
- Copy must say: public de-identified data, template MRI, proof of concept, not diagnostic, not patient-specific, not clinically validated.
- Website writing: short plain sentences, no em dashes, first person where the author is speaking.
- Never hardcode, print, or commit `OPENAI_API_KEY`. Never commit `.env`.
- If the key is missing when an Astra call is required in an interactive session, stop and ask the human.
- Do not deploy to Vercel. Stop when pipeline and site work locally.
- CLI: `python -m pipeline` from the repo root.
- Model id: `gpt-6-astra`.
- TDD: no production code without a failing test first (except generated Next.js boilerplate, lockfiles, and human README prose).
- Do not mark the project done until a local MNE run has produced movies that have been opened.

## File map

```
.gitignore
pytest.ini
pipeline/__init__.py
pipeline/__main__.py
pipeline/constants.py
pipeline/window.py
pipeline/filters.py
pipeline/montage.py
pipeline/inverse.py
pipeline/stats.py
pipeline/download.py
pipeline/astra.py
pipeline/render.py
pipeline/outputs.py
pipeline/run.py
pipeline/requirements.txt
pipeline/README.md
pipeline/tests/test_window.py
pipeline/tests/test_filters.py
pipeline/tests/test_montage.py
pipeline/tests/test_inverse.py
pipeline/tests/test_stats.py
pipeline/tests/test_download.py
pipeline/tests/test_astra.py
pipeline/tests/test_render.py
pipeline/tests/test_outputs.py
web/                         # Next.js 14 app
web/lib/ask.ts
web/lib/ask.test.ts
web/app/api/ask/route.ts
web/app/page.tsx
web/public/seizure-dspm.mp4
web/public/seizure-sloreta.mp4
web/public/seizure-stats.json
web/public/astra-walkthrough.json
web/public/stills/
```

---

### Task 1: Repo ignore rules and Python test harness

**Files:**
- Create: `.gitignore`
- Create: `pytest.ini`
- Create: `pipeline/__init__.py`
- Create: `pipeline/requirements.txt`
- Create: `pipeline/tests/test_harness.py`

**Interfaces:**
- Consumes: nothing
- Produces: pytest runs from repo root; `.env` and `pipeline/data/` are ignored

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_harness.py
from pathlib import Path


def test_pipeline_package_importable():
    import pipeline

    assert pipeline.__name__ == "pipeline"


def test_gitignore_covers_secrets_and_edf_dir():
    text = Path(".gitignore").read_text(encoding="utf-8")
    for token in (".env", "pipeline/data/", "node_modules/", "__pycache__/", ".next/"):
        assert token in text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/anirudh/dev/workspace/Studio Repositories/neurospread" && python3 -m pytest pipeline/tests/test_harness.py -v`

Expected: FAIL (package or `.gitignore` missing)

- [ ] **Step 3: Write minimal implementation**

`.gitignore`:

```
.env
pipeline/data/
node_modules/
__pycache__/
.pytest_cache/
.mypy_cache/
.next/
web/.next/
*.edf
.DS_Store
venv/
.venv/
```

`pytest.ini`:

```ini
[pytest]
testpaths = pipeline/tests
pythonpath = .
```

`pipeline/__init__.py`: empty.

`pipeline/requirements.txt`:

```
numpy
scipy
matplotlib
mne
pyvista
imageio-ffmpeg
pytest
```

Pin exact versions after the first successful `pip install` in a later task. For this task, creating the unpinned file is enough so tests can import.

`pipeline/tests/test_harness.py`: as above.

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_harness.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .gitignore pytest.ini pipeline/__init__.py pipeline/requirements.txt pipeline/tests/test_harness.py
git commit -m "Add Python test harness and ignore secrets, EDF, and build artifacts."
```

---

### Task 2: Seizure time window

**Files:**
- Create: `pipeline/window.py`
- Test: `pipeline/tests/test_window.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TimeWindow(tmin: float, tmax: float)` frozen dataclass
  - `annotated_seizure_window() -> TimeWindow` (2996.0, 3036.0)
  - `crop_to_window(raw_tmin: float, raw_tmax: float, window: TimeWindow) -> TimeWindow`
  - Raises `ValueError` if the annotated window is not fully inside the recording.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_window.py
import pytest

from pipeline.window import TimeWindow, annotated_seizure_window, crop_to_window


def test_annotated_window_is_chb01_03_seizure():
    window = annotated_seizure_window()
    assert window == TimeWindow(tmin=2996.0, tmax=3036.0)


def test_crop_accepts_window_inside_recording():
    cropped = crop_to_window(0.0, 3600.0, TimeWindow(2996.0, 3036.0))
    assert cropped == TimeWindow(2996.0, 3036.0)


def test_crop_rejects_window_past_end_of_recording():
    with pytest.raises(ValueError, match="inside"):
        crop_to_window(0.0, 2000.0, TimeWindow(2996.0, 3036.0))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_window.py -v`

Expected: FAIL with `ModuleNotFoundError` or import error for `pipeline.window`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/window.py
from dataclasses import dataclass


@dataclass(frozen=True)
class TimeWindow:
    tmin: float
    tmax: float


def annotated_seizure_window() -> TimeWindow:
    return TimeWindow(tmin=2996.0, tmax=3036.0)


def crop_to_window(raw_tmin: float, raw_tmax: float, window: TimeWindow) -> TimeWindow:
    if window.tmin < raw_tmin or window.tmax > raw_tmax:
        raise ValueError("seizure window is not fully inside the recording")
    if window.tmax <= window.tmin:
        raise ValueError("seizure window is not fully inside the recording")
    return TimeWindow(tmin=window.tmin, tmax=window.tmax)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_window.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/window.py pipeline/tests/test_window.py
git commit -m "Add CHB-MIT chb01_03 seizure window helpers."
```

---

### Task 3: Filter configuration

**Files:**
- Create: `pipeline/filters.py`
- Test: `pipeline/tests/test_filters.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `FilterConfig(l_freq: float, h_freq: float, notch_freq: float)`
  - `default_filter_config() -> FilterConfig` with 1 Hz, 40 Hz, 60 Hz

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_filters.py
from pipeline.filters import FilterConfig, default_filter_config


def test_default_filters_are_bandpass_1_40_and_notch_60():
    cfg = default_filter_config()
    assert cfg == FilterConfig(l_freq=1.0, h_freq=40.0, notch_freq=60.0)
    assert cfg.l_freq < cfg.h_freq
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_filters.py -v`

Expected: FAIL, `pipeline.filters` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/filters.py
from dataclasses import dataclass


@dataclass(frozen=True)
class FilterConfig:
    l_freq: float
    h_freq: float
    notch_freq: float


def default_filter_config() -> FilterConfig:
    return FilterConfig(l_freq=1.0, h_freq=40.0, notch_freq=60.0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_filters.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/filters.py pipeline/tests/test_filters.py
git commit -m "Add scalp EEG band-pass and 60 Hz notch config."
```

---

### Task 4: CHB-MIT bipolar channel mapping

**Files:**
- Create: `pipeline/montage.py`
- Test: `pipeline/tests/test_montage.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `map_bipolar_channel(name: str) -> str | None`
  - `map_channel_list(names: list[str]) -> list[tuple[str, str]]` as `(original, standard)` keeping first unique standard name
  - ECG / non-EEG -> `None`
  - `FP1-F7` -> `Fp1` (first electrode, MNE 10–20 spelling)

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_montage.py
from pipeline.montage import map_bipolar_channel, map_channel_list


def test_bipolar_pair_maps_to_first_electrode_1020_spelling():
    assert map_bipolar_channel("FP1-F7") == "Fp1"
    assert map_bipolar_channel("T8-P8") == "T8"
    assert map_bipolar_channel("FZ-CZ") == "Fz"


def test_non_eeg_channels_are_dropped():
    assert map_bipolar_channel("ECG") is None
    assert map_bipolar_channel("VNS") is None


def test_duplicate_standard_names_keep_first_only():
    mapped = map_channel_list(["FP1-F7", "FP1-F3", "ECG", "F7-T7"])
    assert mapped == [("FP1-F7", "Fp1"), ("F7-T7", "F7")]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_montage.py -v`

Expected: FAIL, `pipeline.montage` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/montage.py
_TO_1020 = {
    "FP1": "Fp1",
    "FP2": "Fp2",
    "FZ": "Fz",
    "F3": "F3",
    "F4": "F4",
    "F7": "F7",
    "F8": "F8",
    "CZ": "Cz",
    "C3": "C3",
    "C4": "C4",
    "T7": "T7",
    "T8": "T8",
    "T3": "T7",
    "T4": "T8",
    "PZ": "Pz",
    "P3": "P3",
    "P4": "P4",
    "P7": "P7",
    "P8": "P8",
    "T5": "P7",
    "T6": "P8",
    "O1": "O1",
    "O2": "O2",
    "OZ": "Oz",
}


def map_bipolar_channel(name: str) -> str | None:
    cleaned = name.strip().upper().replace(" ", "")
    if cleaned in {"ECG", "EKG", "VNS", "EDF"} or "ECG" in cleaned:
        return None
    first = cleaned.split("-", 1)[0]
    return _TO_1020.get(first)


def map_channel_list(names: list[str]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for original in names:
        mapped = map_bipolar_channel(original)
        if mapped is None or mapped in seen:
            continue
        seen.add(mapped)
        out.append((original, mapped))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_montage.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/montage.py pipeline/tests/test_montage.py
git commit -m "Map CHB-MIT bipolar labels onto standard 10-20 names."
```

---

### Task 5: Inverse job configuration

**Files:**
- Create: `pipeline/inverse.py`
- Test: `pipeline/tests/test_inverse.py`

**Interfaces:**
- Consumes: `TimeWindow` from `pipeline.window`
- Produces:
  - `InverseJob(method: str, src: str, tmin: float, tmax: float)`
  - `inverse_jobs(window: TimeWindow) -> tuple[InverseJob, InverseJob]`
  - Methods exactly `dspm` then `sloreta`; `src` always `fsaverage`; times from the window

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_inverse.py
from pipeline.inverse import InverseJob, inverse_jobs
from pipeline.window import TimeWindow


def test_inverse_jobs_are_dspm_and_sloreta_on_fsaverage_window():
    window = TimeWindow(2996.0, 3036.0)
    jobs = inverse_jobs(window)
    assert jobs == (
        InverseJob(method="dspm", src="fsaverage", tmin=2996.0, tmax=3036.0),
        InverseJob(method="sloreta", src="fsaverage", tmin=2996.0, tmax=3036.0),
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_inverse.py -v`

Expected: FAIL, `pipeline.inverse` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/inverse.py
from dataclasses import dataclass

from pipeline.window import TimeWindow


@dataclass(frozen=True)
class InverseJob:
    method: str
    src: str
    tmin: float
    tmax: float


def inverse_jobs(window: TimeWindow) -> tuple[InverseJob, InverseJob]:
    shared = dict(src="fsaverage", tmin=window.tmin, tmax=window.tmax)
    return (
        InverseJob(method="dspm", **shared),
        InverseJob(method="sloreta", **shared),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_inverse.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/inverse.py pipeline/tests/test_inverse.py
git commit -m "Define dSPM and sLORETA jobs on the fsaverage seizure window."
```

---

### Task 6: Seizure stats from source-estimate arrays

**Files:**
- Create: `pipeline/stats.py`
- Test: `pipeline/tests/test_stats.py`

**Interfaces:**
- Consumes: `TimeWindow`, `FilterConfig`
- Produces:
  - `peak_from_source_data(times, data, labels) -> dict` with keys `peak_time`, `peak_label`, `peak_index`
  - `hemisphere_power(lh, rh) -> dict` with keys `left`, `right`, `left_fraction`
  - `build_seizure_stats(*, recording, window, filters, src, per_method) -> dict` with keys `recording`, `window`, `filters`, `src`, `methods`, `per_method`

`data` is `numpy.ndarray` with shape `(n_sources, n_times)`. Peak is argmax of `abs(data)`.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_stats.py
import numpy as np

from pipeline.filters import FilterConfig
from pipeline.stats import build_seizure_stats, hemisphere_power, peak_from_source_data
from pipeline.window import TimeWindow


def test_peak_comes_from_largest_absolute_sample():
    times = np.array([2996.0, 3000.0, 3010.0, 3036.0])
    data = np.array(
        [
            [0.1, 0.2, 0.0, 0.0],
            [0.0, 0.0, -5.0, 0.1],
            [0.3, 0.1, 0.2, 0.4],
        ]
    )
    peak = peak_from_source_data(times, data, ["a", "lh.superiortemporal", "c"])
    assert peak == {
        "peak_time": 3010.0,
        "peak_label": "lh.superiortemporal",
        "peak_index": 1,
    }


def test_hemisphere_fraction_uses_mean_absolute_power():
    lh = np.array([2.0, 2.0])
    rh = np.array([1.0, 1.0])
    scores = hemisphere_power(lh, rh)
    assert scores["left"] == 2.0
    assert scores["right"] == 1.0
    assert scores["left_fraction"] == 2.0 / 3.0


def test_build_seizure_stats_has_required_keys():
    stats = build_seizure_stats(
        recording="chb01_03.edf",
        window=TimeWindow(2996.0, 3036.0),
        filters=FilterConfig(1.0, 40.0, 60.0),
        src="fsaverage",
        per_method={
            "dspm": {
                "peak_time": 3010.0,
                "peak_label": "lh.superiortemporal",
                "hemisphere": {"left": 2.0, "right": 1.0, "left_fraction": 2.0 / 3.0},
            }
        },
    )
    assert stats["recording"] == "chb01_03.edf"
    assert stats["window"] == {"tmin": 2996.0, "tmax": 3036.0}
    assert stats["filters"] == {"l_freq": 1.0, "h_freq": 40.0, "notch_freq": 60.0}
    assert stats["src"] == "fsaverage"
    assert stats["methods"] == ["dspm"]
    assert stats["per_method"]["dspm"]["peak_label"] == "lh.superiortemporal"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_stats.py -v`

Expected: FAIL, `pipeline.stats` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/stats.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_stats.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/stats.py pipeline/tests/test_stats.py
git commit -m "Derive seizure stats from source-estimate arrays."
```

---

### Task 7: EDF download with explicit failure

**Files:**
- Create: `pipeline/download.py`
- Test: `pipeline/tests/test_download.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `PHYSIONET_EDF_URL = "https://physionet.org/files/chbmit/1.0.0/chb01/chb01_03.edf"`
  - `EDF_FILENAME = "chb01_03.edf"`
  - `edf_path(data_dir: Path) -> Path`
  - `class DownloadError(RuntimeError)`
  - `download_edf(data_dir: Path, fetch) -> Path`
  - `fetch(url: str, dest: Path) -> None` is injected. If `dest` already exists, do not call `fetch`. On fetch failure, raise `DownloadError` whose message contains the URL and expected path.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_download.py
from pathlib import Path

import pytest

from pipeline.download import PHYSIONET_EDF_URL, DownloadError, download_edf, edf_path


def test_edf_path_uses_chb01_03_name(tmp_path: Path):
    assert edf_path(tmp_path) == tmp_path / "chb01_03.edf"


def test_download_skips_fetch_when_file_exists(tmp_path: Path):
    dest = tmp_path / "chb01_03.edf"
    dest.write_bytes(b"edf")
    calls = []

    def fetch(url: str, path: Path) -> None:
        calls.append((url, path))

    result = download_edf(tmp_path, fetch)
    assert result == dest
    assert calls == []


def test_download_error_includes_url_and_path(tmp_path: Path):
    def fetch(url: str, path: Path) -> None:
        raise OSError("network down")

    with pytest.raises(DownloadError) as exc:
        download_edf(tmp_path, fetch)
    message = str(exc.value)
    assert PHYSIONET_EDF_URL in message
    assert str(tmp_path / "chb01_03.edf") in message
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_download.py -v`

Expected: FAIL, `pipeline.download` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/download.py
from pathlib import Path

PHYSIONET_EDF_URL = "https://physionet.org/files/chbmit/1.0.0/chb01/chb01_03.edf"
EDF_FILENAME = "chb01_03.edf"


class DownloadError(RuntimeError):
    pass


def edf_path(data_dir: Path) -> Path:
    return data_dir / EDF_FILENAME


def download_edf(data_dir: Path, fetch) -> Path:
    dest = edf_path(data_dir)
    if dest.exists():
        return dest
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        fetch(PHYSIONET_EDF_URL, dest)
    except Exception as exc:
        raise DownloadError(
            f"failed to download {PHYSIONET_EDF_URL} to {dest}"
        ) from exc
    if not dest.exists():
        raise DownloadError(f"failed to download {PHYSIONET_EDF_URL} to {dest}")
    return dest
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_download.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/download.py pipeline/tests/test_download.py
git commit -m "Download chb01_03.edf from PhysioNet with a clear failure path."
```

---

### Task 8: Astra walkthrough client

**Files:**
- Create: `pipeline/astra.py`
- Test: `pipeline/tests/test_astra.py`

**Interfaces:**
- Consumes: `seizure-stats` dict from `build_seizure_stats`
- Produces:
  - `ASTRA_MODEL = "gpt-6-astra"`
  - `ImageGenerationForbidden`
  - `MissingAPIKeyError`
  - `build_walkthrough_prompt(stats: dict) -> list[dict[str, str]]`
  - `parse_walkthrough_response(payload: dict) -> dict`
  - `request_walkthrough(stats, *, api_key, interactive, complete) -> dict`
  - Prompt must include the stats JSON and an instruction not to generate images.
  - `parse_walkthrough_response` raises `ImageGenerationForbidden` if payload contains keys `image`, `b64_json`, or `images` anywhere at the top level or under `data`.
  - `request_walkthrough`: `api_key is None` and `interactive=True` raises `MissingAPIKeyError`. `api_key is None` and `interactive=False` returns `{"status": "skipped", "captions": []}`. If `complete(...)` raises, return `{"status": "error", "captions": [], "message": str(exc)}`. Success returns `{"status": "ok", "captions": [...]}`.
  - `complete(messages, model, api_key)` is injected. Never log `api_key`.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_astra.py
import json

import pytest

from pipeline.astra import (
    ASTRA_MODEL,
    ImageGenerationForbidden,
    MissingAPIKeyError,
    build_walkthrough_prompt,
    parse_walkthrough_response,
    request_walkthrough,
)


STATS = {
    "recording": "chb01_03.edf",
    "window": {"tmin": 2996.0, "tmax": 3036.0},
    "methods": ["dspm", "sloreta"],
}


def test_prompt_sends_stats_and_forbids_images():
    messages = build_walkthrough_prompt(STATS)
    blob = json.dumps(messages)
    assert "chb01_03.edf" in blob
    assert "2996" in blob
    assert "image" in blob.lower()
    assert messages[0]["role"] == "system"


def test_parse_rejects_image_payload():
    with pytest.raises(ImageGenerationForbidden):
        parse_walkthrough_response({"b64_json": "aaaa"})
    with pytest.raises(ImageGenerationForbidden):
        parse_walkthrough_response({"data": [{"image": "aaaa"}]})


def test_parse_reads_captions_from_message_content():
    payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {"captions": [{"t": 3010.0, "method": "dspm", "text": "peak"}]}
                    )
                }
            }
        ]
    }
    parsed = parse_walkthrough_response(payload)
    assert parsed["captions"][0]["text"] == "peak"


def test_missing_key_interactive_asks_human():
    with pytest.raises(MissingAPIKeyError):
        request_walkthrough(STATS, api_key=None, interactive=True, complete=lambda *a, **k: {})


def test_missing_key_ci_skips():
    result = request_walkthrough(
        STATS, api_key=None, interactive=False, complete=lambda *a, **k: {}
    )
    assert result == {"status": "skipped", "captions": []}


def test_api_error_degrades_without_captions():
    def complete(messages, model, api_key):
        raise RuntimeError("timeout")

    result = request_walkthrough(
        STATS, api_key="sk-test", interactive=False, complete=complete
    )
    assert result["status"] == "error"
    assert result["captions"] == []
    assert "timeout" in result["message"]


def test_complete_is_called_with_gpt_6_astra():
    captured = {}

    def complete(messages, model, api_key):
        captured["model"] = model
        return {
            "choices": [
                {"message": {"content": json.dumps({"captions": []})}}
            ]
        }

    result = request_walkthrough(
        STATS, api_key="sk-test", interactive=False, complete=complete
    )
    assert captured["model"] == ASTRA_MODEL
    assert result["status"] == "ok"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_astra.py -v`

Expected: FAIL, `pipeline.astra` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/astra.py
from __future__ import annotations

import json
from typing import Any, Callable

ASTRA_MODEL = "gpt-6-astra"
_IMAGE_KEYS = {"image", "b64_json", "images"}


class ImageGenerationForbidden(ValueError):
    pass


class MissingAPIKeyError(RuntimeError):
    pass


def build_walkthrough_prompt(stats: dict) -> list[dict[str, str]]:
    system = (
        "You write short timestamped captions for an EEG source-localization demo. "
        "Use only the JSON stats. Do not generate images, heatmaps, or pictures. "
        "This is public de-identified data and is not a diagnosis. "
        "Reply with JSON {\"captions\": [{\"t\": number, \"method\": \"dspm\"|\"sloreta\", \"text\": string}]}."
    )
    user = json.dumps(stats)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _contains_image_keys(obj: Any) -> bool:
    if isinstance(obj, dict):
        if _IMAGE_KEYS.intersection(obj.keys()):
            return True
        return any(_contains_image_keys(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_contains_image_keys(v) for v in obj)
    return False


def parse_walkthrough_response(payload: dict) -> dict:
    if _contains_image_keys(payload):
        raise ImageGenerationForbidden("image payload is not allowed")
    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    captions = parsed.get("captions", [])
    return {"captions": captions}


def request_walkthrough(
    stats: dict,
    *,
    api_key: str | None,
    interactive: bool,
    complete: Callable,
) -> dict:
    if not api_key:
        if interactive:
            raise MissingAPIKeyError("OPENAI_API_KEY is missing. Ask the human before calling Astra.")
        return {"status": "skipped", "captions": []}
    try:
        payload = complete(build_walkthrough_prompt(stats), ASTRA_MODEL, api_key)
        parsed = parse_walkthrough_response(payload)
    except ImageGenerationForbidden:
        raise
    except Exception as exc:
        return {"status": "error", "captions": [], "message": str(exc)}
    return {"status": "ok", "captions": parsed["captions"]}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_astra.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/astra.py pipeline/tests/test_astra.py
git commit -m "Add Astra walkthrough client that accepts stats and rejects images."
```

---

### Task 9: Shared render settings and STC guard

**Files:**
- Create: `pipeline/render.py`
- Test: `pipeline/tests/test_render.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `RenderSettings(colormap: str, time_step_s: float, n_stills: int)`
  - `shared_render_settings() -> RenderSettings` colormap `hot`, `time_step_s=1.0`, `n_stills=4`
  - `require_source_estimate(stc) -> None` raises `ValueError` if `stc` is `None` or missing attribute `data`
  - `assert_no_image_api(imported_modules: list[str]) -> None` raises `ValueError` if any module name contains `images.generate` or equals `openai.images`

This task does not call MNE. It locks the contract the later CLI render uses.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_render.py
from types import SimpleNamespace

import pytest

from pipeline.render import (
    RenderSettings,
    assert_no_image_api,
    require_source_estimate,
    shared_render_settings,
)


def test_both_methods_share_colormap_and_step():
    assert shared_render_settings() == RenderSettings(
        colormap="hot", time_step_s=1.0, n_stills=4
    )


def test_missing_stc_is_an_error():
    with pytest.raises(ValueError, match="source estimate"):
        require_source_estimate(None)
    with pytest.raises(ValueError, match="source estimate"):
        require_source_estimate(SimpleNamespace())


def test_openai_image_modules_are_rejected():
    with pytest.raises(ValueError, match="image"):
        assert_no_image_api(["numpy", "openai.images"])
    assert_no_image_api(["mne", "pyvista"]) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_render.py -v`

Expected: FAIL, `pipeline.render` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/render.py
from dataclasses import dataclass


@dataclass(frozen=True)
class RenderSettings:
    colormap: str
    time_step_s: float
    n_stills: int


def shared_render_settings() -> RenderSettings:
    return RenderSettings(colormap="hot", time_step_s=1.0, n_stills=4)


def require_source_estimate(stc) -> None:
    if stc is None or not hasattr(stc, "data"):
        raise ValueError("source estimate is required for render")


def assert_no_image_api(imported_modules: list[str]) -> None:
    for name in imported_modules:
        lowered = name.lower()
        if lowered == "openai.images" or "images.generate" in lowered:
            raise ValueError("image generation API is not allowed")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_render.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/render.py pipeline/tests/test_render.py
git commit -m "Guard brain render so it requires a source estimate, not an image API."
```

---

### Task 10: Copy derived outputs into web/public

**Files:**
- Create: `pipeline/outputs.py`
- Test: `pipeline/tests/test_outputs.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `public_filenames() -> dict[str, str]` mapping logical names to relative paths under `web/public`
  - Keys: `dspm_mp4` -> `seizure-dspm.mp4`, `sloreta_mp4` -> `seizure-sloreta.mp4`, `stats` -> `seizure-stats.json`, `walkthrough` -> `astra-walkthrough.json`
  - `copy_derived_outputs(src_dir: Path, web_public: Path) -> None` copies those files plus any `stills/` directory. Raises `FileNotFoundError` if a required movie is missing. Does not create placeholder images.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_outputs.py
from pathlib import Path

import pytest

from pipeline.outputs import copy_derived_outputs, public_filenames


def test_public_filenames_match_spec():
    names = public_filenames()
    assert names["dspm_mp4"] == "seizure-dspm.mp4"
    assert names["sloreta_mp4"] == "seizure-sloreta.mp4"
    assert names["stats"] == "seizure-stats.json"
    assert names["walkthrough"] == "astra-walkthrough.json"


def test_copy_writes_movies_and_json(tmp_path: Path):
    src = tmp_path / "src"
    dest = tmp_path / "public"
    src.mkdir()
    (src / "seizure-dspm.mp4").write_bytes(b"dspm")
    (src / "seizure-sloreta.mp4").write_bytes(b"sloreta")
    (src / "seizure-stats.json").write_text("{}", encoding="utf-8")
    (src / "astra-walkthrough.json").write_text("{}", encoding="utf-8")
    stills = src / "stills"
    stills.mkdir()
    (stills / "dspm-0.png").write_bytes(b"png")
    copy_derived_outputs(src, dest)
    assert (dest / "seizure-dspm.mp4").read_bytes() == b"dspm"
    assert (dest / "stills" / "dspm-0.png").read_bytes() == b"png"


def test_copy_refuses_missing_movie(tmp_path: Path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "seizure-stats.json").write_text("{}", encoding="utf-8")
    with pytest.raises(FileNotFoundError):
        copy_derived_outputs(src, tmp_path / "public")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_outputs.py -v`

Expected: FAIL, `pipeline.outputs` missing

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/outputs.py
import shutil
from pathlib import Path


def public_filenames() -> dict[str, str]:
    return {
        "dspm_mp4": "seizure-dspm.mp4",
        "sloreta_mp4": "seizure-sloreta.mp4",
        "stats": "seizure-stats.json",
        "walkthrough": "astra-walkthrough.json",
    }


def copy_derived_outputs(src_dir: Path, web_public: Path) -> None:
    names = public_filenames()
    required = [names["dspm_mp4"], names["sloreta_mp4"]]
    for name in required:
        if not (src_dir / name).exists():
            raise FileNotFoundError(src_dir / name)
    web_public.mkdir(parents=True, exist_ok=True)
    for name in names.values():
        source = src_dir / name
        if source.exists():
            shutil.copy2(source, web_public / name)
    stills = src_dir / "stills"
    if stills.exists():
        dest_stills = web_public / "stills"
        if dest_stills.exists():
            shutil.rmtree(dest_stills)
        shutil.copytree(stills, dest_stills)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_outputs.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/outputs.py pipeline/tests/test_outputs.py
git commit -m "Copy computed movies and stats into the website public folder."
```

---

### Task 11: Pipeline CLI orchestration (without live MNE)

**Files:**
- Create: `pipeline/run.py`
- Create: `pipeline/__main__.py`
- Test: `pipeline/tests/test_run.py`

**Interfaces:**
- Consumes: `download_edf`, `annotated_seizure_window`, `default_filter_config`, `inverse_jobs`, `request_walkthrough`, `copy_derived_outputs`, `MissingAPIKeyError`
- Produces:
  - `RunConfig(data_dir, out_dir, web_public, interactive, api_key)`
  - `run_pipeline(config, *, fetch, localize, render_stc, complete) -> dict`
  - `localize(raw_path, window, filters, jobs)` returns `{method: stc}` and must be called with both jobs. Tests inject a fake.
  - `render_stc(method, stc, out_dir, settings)` writes `seizure-{method}.mp4` and stills. Fake writes bytes.
  - If `localize` returns a missing method, raise `ValueError`.
  - After stats JSON is written, call `request_walkthrough`. On `MissingAPIKeyError`, re-raise. On `status == error` or `skipped`, still copy movies if present.
  - `__main__.py` calls `run_pipeline` with real adapters. Real MNE adapters can be stubs that raise `NotImplementedError` until Task 12.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_run.py
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline.run import RunConfig, run_pipeline
from pipeline.window import TimeWindow


def test_run_pipeline_writes_stats_and_copies_movies(tmp_path: Path):
    data_dir = tmp_path / "data"
    out_dir = tmp_path / "out"
    public = tmp_path / "public"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")

    def fetch(url, dest):
        raise AssertionError("should not fetch")

    def localize(raw_path, window, filters, jobs):
        assert raw_path.name == "chb01_03.edf"
        assert window == TimeWindow(2996.0, 3036.0)
        assert [job.method for job in jobs] == ["dspm", "sloreta"]
        stc = SimpleNamespace(data=True)
        return {"dspm": stc, "sloreta": stc}

    def render_stc(method, stc, dest, settings):
        (dest / f"seizure-{method}.mp4").write_bytes(b"movie")
        stills = dest / "stills"
        stills.mkdir(exist_ok=True)
        (stills / f"{method}-0.png").write_bytes(b"png")

    def complete(messages, model, api_key):
        return {
            "choices": [
                {
                    "message": {
                        "content": '{"captions": [{"t": 3010, "method": "dspm", "text": "peak"}]}'
                    }
                }
            ]
        }

    result = run_pipeline(
        RunConfig(
            data_dir=data_dir,
            out_dir=out_dir,
            web_public=public,
            interactive=False,
            api_key="sk-test",
        ),
        fetch=fetch,
        localize=localize,
        render_stc=render_stc,
        complete=complete,
    )
    assert (public / "seizure-dspm.mp4").exists()
    assert (public / "seizure-stats.json").exists()
    assert result["walkthrough"]["status"] == "ok"


def test_run_pipeline_stops_when_interactive_and_key_missing(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")

    def localize(raw_path, window, filters, jobs):
        stc = SimpleNamespace(data=True)
        return {"dspm": stc, "sloreta": stc}

    def render_stc(method, stc, dest, settings):
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"seizure-{method}.mp4").write_bytes(b"movie")

    from pipeline.astra import MissingAPIKeyError

    with pytest.raises(MissingAPIKeyError):
        run_pipeline(
            RunConfig(
                data_dir=data_dir,
                out_dir=tmp_path / "out",
                web_public=tmp_path / "public",
                interactive=True,
                api_key=None,
            ),
            fetch=lambda *a, **k: None,
            localize=localize,
            render_stc=render_stc,
            complete=lambda *a, **k: {},
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_run.py -v`

Expected: FAIL, `pipeline.run` missing

- [ ] **Step 3: Write minimal implementation**

Implement `pipeline/run.py` so that it:

1. Calls `download_edf(config.data_dir, fetch)`
2. Uses `annotated_seizure_window()`, `default_filter_config()`, `inverse_jobs(window)`
3. Calls `localize(...)` then `require_source_estimate` on each method
4. Calls `render_stc` for `dspm` and `sloreta` with `shared_render_settings()`
5. Writes a stats JSON using `build_seizure_stats`. For the fake STC in tests, `per_method` may use placeholder peak fields (`peak_time` = window.tmin, `peak_label` = "unknown", hemisphere zeros) unless `stc` has `.times`, `.data`, `.lh_data`, `.rh_data`, and `.vertex_labels`. If those attributes exist, use `peak_from_source_data` and `hemisphere_power`.
6. Calls `request_walkthrough` and writes `astra-walkthrough.json`
7. Calls `copy_derived_outputs`

`pipeline/__main__.py`:

```python
from pipeline.run import main

if __name__ == "__main__":
    raise SystemExit(main())
```

`main()` in `run.py` for now parses nothing extra: uses `pipeline/data`, `pipeline/output`, `web/public`, `interactive=sys.stdin.isatty()`, `api_key=os.environ.get("OPENAI_API_KEY")`, and real fetch via `urllib.request.urlretrieve`. `localize` and `render_stc` should be functions in `run.py` named `mne_localize` and `mne_render` that raise `NotImplementedError("mne localize not wired")` until Task 12. `main()` must still exist so `python -m pipeline` has an entry.

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest pipeline/tests/test_run.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/run.py pipeline/__main__.py pipeline/tests/test_run.py
git commit -m "Orchestrate download, inverse jobs, render, Astra, and public copy."
```

---

### Task 12: Wire MNE localize and render

**Files:**
- Modify: `pipeline/run.py` (`mne_localize`, `mne_render`)
- Modify: `pipeline/render.py` (add `write_brain_movie` if it keeps the file small enough; otherwise keep render helpers in `run.py`)
- Modify: `pipeline/README.md` (create in this task)

**Interfaces:**
- Consumes: `map_channel_list`, `crop_to_window`, `FilterConfig`, `InverseJob`, `shared_render_settings`, `require_source_estimate`
- Produces:
  - `mne_localize(raw_path, window, filters, jobs) -> dict[str, mne.SourceEstimate]`
  - `mne_render(method, stc, out_dir, settings) -> None` writes `seizure-{method}.mp4` and `stills/{method}-{i}.png`
  - Load EDF with `mne.io.read_raw_edf`. Drop non-EEG via `map_channel_list`. Rename channels to 10–20. Set `standard_1020` montage. Filter with `raw.filter(l_freq, h_freq)` and `raw.notch_filter(notch_freq)`. Crop to window (allow MNE filter pad by cropping after filter). `mne.datasets.fetch_fsaverage`. `make_forward_solution` + `make_inverse_operator` + `apply_inverse_raw` or epoch-equivalent on the window. Methods: `dSPM` and `sLORETA` (MNE method strings). Same `lambda2`. If fsaverage fetch fails, print the MNE fetch command and exit non-zero.
  - Render: `stc.plot` / `mne.viz.Brain` offscreen, shared camera, colormap `hot`, sample every `time_step_s`, encode with imageio-ffmpeg. No OpenAI image calls.
  - After a successful local run, copy outputs into `web/public/` via existing helper.

There is no full-MNE unit test. After wiring, run unit tests to ensure they still pass, then run the real CLI.

- [ ] **Step 1: Write a failing adapter test for channel selection only**

Do not instantiate MNE in this test. Add `pipeline/tests/test_prepare.py` and `pipeline/prepare.py`:

```python
# pipeline/tests/test_prepare.py
from pipeline.prepare import selected_channel_renames


def test_selected_channel_renames_drops_ecg_and_dedupes():
    mapping = selected_channel_renames(["FP1-F7", "FP1-F3", "ECG", "T8-P8"])
    assert mapping == {"FP1-F7": "Fp1", "T8-P8": "T8"}
```

`selected_channel_renames(names: list[str]) -> dict[str, str]` is `dict(map_channel_list(names))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest pipeline/tests/test_prepare.py -v`

Expected: FAIL, `pipeline.prepare` missing

- [ ] **Step 3: Implement prepare.py and MNE adapters**

`pipeline/prepare.py`:

```python
from pipeline.montage import map_channel_list


def selected_channel_renames(names: list[str]) -> dict[str, str]:
    return dict(map_channel_list(names))
```

Then implement `mne_localize` and `mne_render` using MNE as specified. Pin versions in `pipeline/requirements.txt` after `pip install`.

`pipeline/README.md` must include: step-by-step pipeline, why template MRI + dSPM/sLORETA, limitations, how to run `pytest` and `python -m pipeline`, PhysioNet download, fsaverage, movies are computed not generated, Astra stats-in/text-out, `OPENAI_API_KEY`.

- [ ] **Step 4: Run unit tests, then the real pipeline**

Run: `python3 -m pytest pipeline/tests -v`

Expected: PASS

Then: `python3 -m pip install -r pipeline/requirements.txt` and `python3 -m pipeline`.

If `OPENAI_API_KEY` is missing, stop and ask the human. Do not skip silently in this interactive session.

Open the resulting `web/public/seizure-dspm.mp4` and `web/public/seizure-sloreta.mp4`. If render fails, fix MNE code. Do not generate a brain image.

- [ ] **Step 5: Commit**

```bash
git add pipeline/prepare.py pipeline/run.py pipeline/render.py pipeline/README.md pipeline/requirements.txt pipeline/tests/test_prepare.py web/public/seizure-dspm.mp4 web/public/seizure-sloreta.mp4 web/public/seizure-stats.json web/public/astra-walkthrough.json web/public/stills
git commit -m "Run MNE inverse and commit computed seizure movies and stats."
```

Do not add `.edf` files.

---

### Task 13: Next.js app shell and dark clinical page

**Files:**
- Create: `web/` via create-next-app 14 and shadcn
- Create: `web/lib/ask.ts`
- Create: `web/lib/ask.test.ts`
- Create: `web/app/api/ask/route.ts`
- Modify: `web/app/page.tsx`, `web/app/globals.css`

**Interfaces:**
- Consumes: static files in `web/public/` from Task 12. If movies are not present yet, page still builds; hero shows a Card explaining the pipeline must be run. Do not use a generated brain as a stand-in.
- Produces:
  - `isDiagnosticRequest(question: string): boolean`
  - `buildAskMessages(question: string, stats: unknown, walkthrough: unknown, limitations: string): { role: "system" | "user"; content: string }[]`
  - `POST /api/ask` JSON `{ question: string }`. If diagnostic, 400 `{ error: "This demo cannot answer clinical questions." }`. If no `OPENAI_API_KEY`, 503 `{ error: "Live Q&A is off." }`. Else call `gpt-6-astra` with `buildAskMessages` and the committed JSON files plus limitations text.
  - Page sections: Hero (dSPM video autoplay muted loop playsInline), How it works (sLORETA video + stills), Astra guide, Who this is for (paragraphs, not bullets), Limitations, Links (GitHub `https://github.com/anvoruganti/neurospread`, write-up labeled Coming soon, no invented URL).

- [ ] **Step 1: Write the failing Q&A tests first (in repo root or after app exists)**

If `web/` does not exist yet, create `web/lib/ask.ts` and `web/lib/ask.test.ts` only after scaffolding, but write tests before ask logic.

Scaffold:

```bash
npx create-next-app@14 web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack=false
```

If the CLI asks questions, use App Router, TypeScript, Tailwind, no `src/`. Then:

```bash
cd web && npx shadcn@latest init -d && npx shadcn@latest add button card badge input
```

Add vitest + jsdom. Write `web/lib/ask.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildAskMessages, isDiagnosticRequest } from "./ask";

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
    expect(messages[1].content).toContain("When is the peak?");
  });
});
```

- [ ] **Step 2: Run vitest to verify it fails**

Run: `cd web && npx vitest run lib/ask.test.ts`

Expected: FAIL, `./ask` missing or functions missing

- [ ] **Step 3: Implement ask.ts, API route, and page**

`isDiagnosticRequest`: lowercase the question; return true if it includes any of: `diagnos`, `resect`, `surgery`, `medication`, `prescribe`, `treat this patient`.

`buildAskMessages`: system text must say answers come only from the provided JSON, this is not a diagnosis, do not generate images.

`web/app/api/ask/route.ts`: implement as specified. Never print the API key.

Page copy: short sentences, no em dashes, first person where the author speaks. Dark background (`#07080a`), one accent (muted teal or steel). shadcn `Card`, `Badge`, `Button`, `Input`.

Hero caption: public CHB-MIT seizure, template brain, not a patient-specific map.

Who this is for: two or three paragraphs covering neurologists, engineers, and that this does not replace clinical care.

- [ ] **Step 4: Run tests and the dev server**

Run: `cd web && npx vitest run`

Expected: PASS

Run: `cd web && npm run dev` and open `/`. Confirm dSPM autoplays, sLORETA is visible, limitations are visible, write-up is Coming soon. If movies exist, play them. Submit a diagnosis question and confirm 400. If no key, confirm ask box disabled or 503.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "Add the dark clinical site with computed movies and grounded Astra Q&A."
```

Do not commit `node_modules` or `.env`.

---

### Task 14: Root README and version pins

**Files:**
- Create: `README.md` (repo root)
- Modify: `pipeline/README.md` with pinned versions actually installed
- Modify: `web/package.json` already pinned by npm

**Interfaces:**
- Consumes: installed package versions
- Produces: root README pointing at `pipeline/README.md` and `web/`, restating not-a-clinical-tool, how to run tests, how to run the pipeline, how to run the site. No Vercel deploy steps beyond “this is ready for Vercel; the owner will connect it.”

- [ ] **Step 1: No unit test for prose. Verify commands still work.**

Run: `python3 -m pytest pipeline/tests -v` and `cd web && npx vitest run`

Expected: PASS

- [ ] **Step 2: Write README.md** with those run commands and the honesty language from the spec.

- [ ] **Step 3: Commit**

```bash
git add README.md pipeline/README.md pipeline/requirements.txt
git commit -m "Document how to run the computed seizure demo locally."
```

---

## Self-review

**Spec coverage:**
- Dataset chb01_03 2996–3036, 1–40 Hz, 60 Hz notch: Tasks 2, 3, 12
- Bipolar mapping: Task 4
- fsaverage dSPM + sLORETA, window only: Tasks 5, 12
- Render from STC, mp4/png, no image gen: Tasks 9, 12
- Stats JSON: Task 6
- Astra walkthrough + missing key behavior: Tasks 8, 11
- Copy to web/public: Task 10
- Website sections, shadcn, dark clinical, GitHub + coming soon: Task 13
- Q&A refuse diagnosis, 503 without key: Task 13
- Pipeline README limitations: Task 12
- .gitignore secrets/EDF: Task 1
- No Vercel: Task 14
- Integration movies opened: Task 12 Step 4

**Placeholder scan:** none remaining.

**Type consistency:** `TimeWindow`, `FilterConfig`, `InverseJob`, `request_walkthrough(..., complete)`, `RunConfig`, public filenames `seizure-dspm.mp4` / `seizure-sloreta.mp4` are used with the same names in later tasks.
