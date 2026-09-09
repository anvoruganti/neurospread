from __future__ import annotations

import json
import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from pipeline.astra import request_walkthrough
from pipeline.download import download_edf
from pipeline.filters import default_filter_config
from pipeline.inverse import inverse_jobs
from pipeline.outputs import copy_derived_outputs
from pipeline.render import require_source_estimate, shared_render_settings
from pipeline.stats import build_seizure_stats, hemisphere_power, peak_from_source_data
from pipeline.window import annotated_seizure_window

_METHODS = ("dspm", "sloreta")


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

    estimates = localize(raw_path, window, filters, jobs)
    for method in _METHODS:
        if method not in estimates:
            raise ValueError(f"localize did not return {method}")
        require_source_estimate(estimates[method])

    config.out_dir.mkdir(parents=True, exist_ok=True)
    settings = shared_render_settings()
    for method in _METHODS:
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


def mne_localize(raw_path, window, filters, jobs):
    raise NotImplementedError("mne localize not wired")


def mne_render(method, stc, out_dir, settings):
    raise NotImplementedError("mne render not wired")


def _complete(messages, model, api_key):
    raise NotImplementedError("Astra completion not wired")


def main() -> int:
    config = RunConfig(
        data_dir=Path("pipeline/data"),
        out_dir=Path("pipeline/output"),
        web_public=Path("web/public"),
        interactive=sys.stdin.isatty(),
        api_key=os.environ.get("OPENAI_API_KEY"),
    )
    run_pipeline(
        config,
        fetch=urllib.request.urlretrieve,
        localize=mne_localize,
        render_stc=mne_render,
        complete=_complete,
    )
    return 0
