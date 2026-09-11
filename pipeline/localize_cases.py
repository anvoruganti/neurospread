"""Localize chb01 cases. Skip movies except the hero recording.

Usage from repo root:

  python -m pipeline.localize_cases
  python -m pipeline.localize_cases --only chb01_04
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.request
from pathlib import Path

from pipeline.cases import CHB01_CASES
from pipeline.run import RunConfig, _complete, _load_dotenv, mne_localize, mne_render, run_pipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Localize chb01 seizures for the disagreement probe.")
    parser.add_argument("--only", help="Run a single case id, e.g. chb01_04")
    args = parser.parse_args(argv)
    _load_dotenv(Path(".env"))
    wanted = [case for case in CHB01_CASES if args.only is None or case["id"] == args.only]
    if not wanted:
        print(f"unknown case {args.only}", file=sys.stderr)
        return 1
    config_root = RunConfig(
        data_dir=Path("pipeline/data"),
        out_dir=Path("pipeline/output"),
        web_public=Path("web/public"),
        interactive=sys.stdin.isatty(),
        api_key=os.environ.get("OPENAI_API_KEY"),
    )
    for case in wanted:
        print(f"=== {case['id']} hero={case['hero']} ===", flush=True)
        config = RunConfig(
            data_dir=config_root.data_dir,
            out_dir=config_root.out_dir,
            web_public=config_root.web_public,
            interactive=config_root.interactive,
            api_key=config_root.api_key,
            case_id=case["id"],
            skip_render=not case["hero"],
            skip_publish=not case["hero"],
            llm_walkthrough=False,
        )
        run_pipeline(
            config,
            fetch=urllib.request.urlretrieve,
            localize=mne_localize,
            render_stc=mne_render,
            complete=_complete,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
