from __future__ import annotations

import json
import os
import sys
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

from pipeline.astra import MissingAPIKeyError, request_walkthrough
from pipeline.download import DownloadError, download_edf
from pipeline.filters import FilterConfig, default_filter_config
from pipeline.inverse import inverse_jobs
from pipeline.outputs import copy_derived_outputs
from pipeline.prepare import selected_channel_renames
from pipeline.render import (
    assert_no_image_api,
    movie_time_points,
    require_source_estimate,
    shared_render_settings,
    still_indices,
    write_brain_movie,
    write_still,
)
from pipeline.stats import build_seizure_stats, hemisphere_power, peak_from_source_data
from pipeline.window import TimeWindow, annotated_seizure_window, crop_to_window

_METHODS = ("dspm", "sloreta")
_OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

# Inverse settings shared by dSPM and sLORETA so the two maps stay comparable.
_FSAVERAGE_SUBJECT = "fsaverage"
_MNE_METHODS = {"dspm": "dSPM", "sloreta": "sLORETA"}
_LAMBDA2 = 1.0 / 9.0
_LOOSE = 0.2
_DEPTH = 0.8
_MIN_MAPPED_CHANNELS = 8
# 1-40 Hz content survives a 100 Hz sampling rate and keeps the source arrays small.
_INVERSE_SFREQ = 100.0
# Pre-ictal stretch used for the noise covariance, ending before the annotated onset.
_BASELINE_SECONDS = 90.0
_BASELINE_GAP_SECONDS = 10.0
_CLIM_PERCENTILES = [95.0, 99.0, 99.95]
_BRAIN_SIZE = (1200, 800)

_FSAVERAGE_HINT = (
    "fsaverage template MRI is not available. Fetch it with:\n"
    '  python -c "import mne; mne.datasets.fetch_fsaverage(verbose=True)"'
)


class FsaverageError(RuntimeError):
    pass


@dataclass(frozen=True)
class RunConfig:
    data_dir: Path
    out_dir: Path
    web_public: Path
    interactive: bool
    api_key: str | None


def _method_stats(stc: Any, window) -> dict:
    required = ("times", "data", "lh_data", "rh_data", "vertex_labels")
    if all(hasattr(stc, name) for name in required):
        peak = peak_from_source_data(stc.times, stc.data, stc.vertex_labels)
        return {
            **peak,
            "hemisphere": hemisphere_power(stc.lh_data, stc.rh_data),
        }
    return {
        "peak_time": window.tmin,
        "peak_label": "unknown",
        "hemisphere": {"left": 0.0, "right": 0.0, "left_fraction": 0.0},
    }


def run_pipeline(
    config: RunConfig,
    *,
    fetch: Callable,
    localize: Callable,
    render_stc: Callable,
    complete: Callable,
) -> dict:
    raw_path = download_edf(config.data_dir, fetch)
    window = annotated_seizure_window()
    filters = default_filter_config()
    jobs = inverse_jobs(window)

    print(f"Localizing {raw_path.name} on the {window.tmin:.0f}-{window.tmax:.0f}s window", flush=True)
    estimates = localize(raw_path, window, filters, jobs)
    for method in _METHODS:
        if method not in estimates:
            raise ValueError(f"localize did not return {method}")
        require_source_estimate(estimates[method])

    config.out_dir.mkdir(parents=True, exist_ok=True)
    settings = shared_render_settings()
    for method in _METHODS:
        print(f"Rendering {method} from source-estimate screenshots", flush=True)
        render_stc(method, estimates[method], config.out_dir, settings)

    stats = build_seizure_stats(
        recording=raw_path.name,
        window=window,
        filters=filters,
        src=jobs[0].src,
        per_method={
            method: _method_stats(estimates[method], window) for method in _METHODS
        },
    )
    (config.out_dir / "seizure-stats.json").write_text(
        json.dumps(stats, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Requesting Astra walkthrough from stats JSON", flush=True)
    walkthrough = request_walkthrough(
        stats,
        api_key=config.api_key,
        interactive=config.interactive,
        complete=complete,
    )
    (config.out_dir / "astra-walkthrough.json").write_text(
        json.dumps(walkthrough, indent=2) + "\n",
        encoding="utf-8",
    )
    copy_derived_outputs(config.out_dir, config.web_public)
    return {"stats": stats, "walkthrough": walkthrough}


@lru_cache(maxsize=1)
def _fsaverage_paths() -> tuple[Path, Path]:
    import mne

    try:
        fs_dir = Path(mne.datasets.fetch_fsaverage(verbose=True))
    except Exception as exc:
        raise FsaverageError(_FSAVERAGE_HINT) from exc
    subjects_dir = fs_dir.parent
    missing = [
        path
        for path in (
            fs_dir / "bem" / "fsaverage-ico-5-src.fif",
            fs_dir / "bem" / "fsaverage-5120-5120-5120-bem-sol.fif",
        )
        if not path.exists()
    ]
    if missing:
        raise FsaverageError(f"{_FSAVERAGE_HINT}\nMissing: {missing[0]}")
    return fs_dir, subjects_dir


def _prepare_raw(raw_path: Path, window: TimeWindow, filters: FilterConfig):
    """Load the CHB-MIT bipolar EDF as a 10-20 scalp montage, filtered and resampled."""
    import mne

    raw = mne.io.read_raw_edf(raw_path, preload=True, verbose="error")
    renames = selected_channel_renames(raw.ch_names)
    if len(renames) < _MIN_MAPPED_CHANNELS:
        raise ValueError(
            f"only {len(renames)} channels in {raw_path.name} map to 10-20 positions"
        )
    raw.pick(list(renames))
    raw.rename_channels(renames)
    raw.set_channel_types({name: "eeg" for name in raw.ch_names}, verbose="error")
    raw.set_montage("standard_1020")
    raw.notch_filter(filters.notch_freq, verbose="error")
    raw.filter(filters.l_freq, filters.h_freq, verbose="error")
    raw.resample(_INVERSE_SFREQ, verbose="error")
    raw.set_eeg_reference("average", projection=True, verbose="error")
    raw.apply_proj(verbose="error")
    crop_to_window(0.0, float(raw.times[-1]), window)
    return raw


def _noise_covariance(raw, window: TimeWindow):
    """Estimate sensor noise from a pre-ictal stretch of the same recording."""
    import mne

    tmax = window.tmin - _BASELINE_GAP_SECONDS
    tmin = max(0.0, tmax - _BASELINE_SECONDS)
    if tmax <= tmin:
        raise ValueError("no pre-ictal baseline available before the seizure window")
    baseline = raw.copy().crop(tmin=tmin, tmax=tmax)
    return mne.compute_raw_covariance(baseline, method="shrunk", verbose="error")


def _inverse_operator(info, noise_cov):
    import mne

    fs_dir, _ = _fsaverage_paths()
    fwd = mne.make_forward_solution(
        info,
        trans=_FSAVERAGE_SUBJECT,
        src=str(fs_dir / "bem" / "fsaverage-ico-5-src.fif"),
        bem=str(fs_dir / "bem" / "fsaverage-5120-5120-5120-bem-sol.fif"),
        eeg=True,
        meg=False,
        mindist=5.0,
        verbose="error",
    )
    return mne.minimum_norm.make_inverse_operator(
        info,
        fwd,
        noise_cov,
        loose=_LOOSE,
        depth=_DEPTH,
        verbose="error",
    )


def _vertex_labels(stc) -> list[str]:
    """Name every source row with its aparc parcel so stats can report a peak label."""
    import mne
    import numpy as np

    _, subjects_dir = _fsaverage_paths()
    try:
        labels = mne.read_labels_from_annot(
            _FSAVERAGE_SUBJECT,
            parc="aparc",
            subjects_dir=subjects_dir,
            verbose="error",
        )
    except Exception:
        labels = []
    names: list[str] = []
    for index, hemi in enumerate(("lh", "rh")):
        vertices = stc.vertices[index]
        hemi_names = np.array(
            [f"{hemi}-vertex-{vertex}" for vertex in vertices], dtype=object
        )
        for label in labels:
            if label.hemi != hemi:
                continue
            hemi_names[np.isin(vertices, label.vertices)] = label.name
        names.extend(hemi_names.tolist())
    return names


def mne_localize(raw_path, window, filters, jobs):
    from mne.minimum_norm import apply_inverse_raw

    raw = _prepare_raw(raw_path, window, filters)
    noise_cov = _noise_covariance(raw, window)
    seizure = raw.copy().crop(tmin=window.tmin, tmax=window.tmax)
    del raw
    inverse_operator = _inverse_operator(seizure.info, noise_cov)

    estimates: dict[str, Any] = {}
    labels: list[str] | None = None
    for job in jobs:
        stc = apply_inverse_raw(
            seizure,
            inverse_operator,
            lambda2=_LAMBDA2,
            method=_MNE_METHODS[job.method],
            pick_ori=None,
            buffer_size=1000,
            verbose="error",
        )
        stc.tmin = job.tmin
        if labels is None:
            labels = _vertex_labels(stc)
        stc.vertex_labels = labels
        estimates[job.method] = stc
    return estimates


def mne_render(method, stc, out_dir, settings):
    import mne
    import numpy as np
    import pyvista

    assert_no_image_api(["mne", "pyvista", "imageio_ffmpeg"])
    require_source_estimate(stc)
    _, subjects_dir = _fsaverage_paths()
    # MNE reads pyvista.OFF_SCREEN when it builds the plotter, so frames come
    # from the offscreen VTK buffer and no window ever opens.
    pyvista.OFF_SCREEN = True
    mne.viz.set_3d_backend("pyvistaqt")
    mne.viz.set_3d_options(antialias=False, multi_samples=1)

    brain = stc.plot(
        subject=_FSAVERAGE_SUBJECT,
        subjects_dir=subjects_dir,
        surface="inflated",
        hemi="split",
        views=["lateral", "medial"],
        colormap=settings.colormap,
        clim=dict(kind="percent", lims=_CLIM_PERCENTILES),
        background="black",
        foreground="white",
        size=_BRAIN_SIZE,
        smoothing_steps=5,
        time_unit="s",
        time_viewer=False,
        show_traces=False,
        colorbar=True,
        initial_time=float(stc.times[0]),
        brain_kwargs=dict(show=False),
    )
    try:
        frames = []
        for time_s in movie_time_points(
            float(stc.times[0]), float(stc.times[-1]), settings.time_step_s
        ):
            brain.set_time(time_s)
            frames.append(np.asarray(brain.screenshot()))
    finally:
        brain.close()

    if all(frame.max() == frame.min() for frame in frames):
        raise RuntimeError(
            f"offscreen renderer produced blank frames for {method}; "
            "check the 3D backend rather than substituting an image"
        )

    write_brain_movie(frames, out_dir / f"seizure-{method}.mp4")
    stills_dir = out_dir / "stills"
    for still, index in enumerate(still_indices(len(frames), settings.n_stills)):
        write_still(frames[index], stills_dir / f"{method}-{still}.png")


def _complete(messages, model, api_key):
    payload = json.dumps({"model": model, "messages": messages}).encode("utf-8")
    request = urllib.request.Request(
        _OPENAI_CHAT_COMPLETIONS_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def _load_dotenv(path: Path) -> None:
    """Fill unset variables from an untracked .env. Values are never logged."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, _, value = stripped.partition("=")
        os.environ.setdefault(name.strip(), value.strip().strip("'\""))


def main() -> int:
    _load_dotenv(Path(".env"))
    config = RunConfig(
        data_dir=Path("pipeline/data"),
        out_dir=Path("pipeline/output"),
        web_public=Path("web/public"),
        interactive=sys.stdin.isatty(),
        api_key=os.environ.get("OPENAI_API_KEY"),
    )
    try:
        run_pipeline(
            config,
            fetch=urllib.request.urlretrieve,
            localize=mne_localize,
            render_stc=mne_render,
            complete=_complete,
        )
    except MissingAPIKeyError as exc:
        # The movies are already computed, so publish them and stop before Astra.
        try:
            copy_derived_outputs(config.out_dir, config.web_public)
        except FileNotFoundError:
            pass
        print(f"{exc}\nSet OPENAI_API_KEY and rerun to add the walkthrough.", file=sys.stderr)
        return 1
    except (DownloadError, FsaverageError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0
