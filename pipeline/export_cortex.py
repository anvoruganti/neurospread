"""Export browser cortex from a live MNE localize without re-rendering movies.

Usage from repo root (after deps and fsaverage are available):

  .venv/bin/python -m pipeline.export_cortex
"""

from __future__ import annotations

import os
import shutil
import sys
import urllib.request
from pathlib import Path

from pipeline.cortex import export_browser_cortex
from pipeline.download import download_edf
from pipeline.filters import default_filter_config
from pipeline.inverse import inverse_jobs
from pipeline.outputs import copy_derived_outputs
from pipeline.render import shared_render_settings
from pipeline.run import (
    RunConfig,
    _load_dotenv,
    _load_inflated_surface,
    mne_localize,
)
from pipeline.window import annotated_seizure_window


def _ensure_publishable_outputs(out_dir: Path, web_public: Path) -> None:
    """Seed out_dir from committed public movies/JSON when re-exporting cortex only."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in (
        "seizure-dspm.mp4",
        "seizure-sloreta.mp4",
        "seizure-stats.json",
        "astra-walkthrough.json",
    ):
        dest = out_dir / name
        src = web_public / name
        if not dest.exists() and src.exists():
            dest.write_bytes(src.read_bytes())
    stills_dst = out_dir / "stills"
    stills_src = web_public / "stills"
    if not stills_dst.exists() and stills_src.exists():
        shutil.copytree(stills_src, stills_dst)


def main() -> int:
    _load_dotenv(Path(".env"))
    config = RunConfig(
        data_dir=Path("pipeline/data"),
        out_dir=Path("pipeline/output"),
        web_public=Path("web/public"),
        interactive=sys.stdin.isatty(),
        api_key=os.environ.get("OPENAI_API_KEY"),
    )
    _ensure_publishable_outputs(config.out_dir, config.web_public)
    raw_path = download_edf(config.data_dir, urllib.request.urlretrieve)
    window = annotated_seizure_window()
    filters = default_filter_config()
    jobs = inverse_jobs(window)
    print(f"Localizing {raw_path.name} for cortex export", flush=True)
    estimates = mne_localize(raw_path, window, filters, jobs)
    settings = shared_render_settings()
    print("Writing brain/mesh.json, activity.bin, parcels.json", flush=True)
    export_browser_cortex(
        estimates,
        config.out_dir,
        time_step_s=settings.time_step_s,
        load_surfaces=_load_inflated_surface,
    )
    copy_derived_outputs(config.out_dir, config.web_public)
    print("Cortex files copied to web/public/brain/", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
