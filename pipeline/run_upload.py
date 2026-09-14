"""Process a user-uploaded scalp EEG (EDF) into web/public/cases/<upload_id>."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

from pipeline.cases import Case
from pipeline.outputs import publish_case_snapshot
from pipeline.run import RunConfig, _complete, _load_dotenv, mne_localize, mne_render, run_pipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Localize one uploaded EDF for the web viewer.")
    parser.add_argument("edf", type=Path, help="Path to uploaded .edf file")
    parser.add_argument("upload_id", help="Public case id, e.g. upload-abc123")
    parser.add_argument("--tmin", type=float, required=True)
    parser.add_argument("--tmax", type=float, required=True)
    args = parser.parse_args(argv)
    if not args.edf.is_file():
        print(f"missing file {args.edf}", file=sys.stderr)
        return 1
    if args.tmax <= args.tmin:
        print("tmax must be greater than tmin", file=sys.stderr)
        return 1

    _load_dotenv(Path(".env"))
    root = Path(__file__).resolve().parents[1]
    data_dir = root / "pipeline" / "data" / "uploads"
    data_dir.mkdir(parents=True, exist_ok=True)
    dest = data_dir / f"{args.upload_id}.edf"
    if args.edf.resolve() != dest.resolve():
        dest.write_bytes(args.edf.read_bytes())

    synthetic: Case = {
        "id": args.upload_id,
        "file": dest.name,
        "subject": "upload",
        "tmin": args.tmin,
        "tmax": args.tmax,
        "hero": False,
        "title": "Your upload",
        "summary": "Personal scalp EEG processed with the same inverse pipeline.",
    }
    out_dir = root / "pipeline" / "output" / "uploads" / args.upload_id
    config = RunConfig(
        data_dir=data_dir,
        out_dir=out_dir,
        web_public=root / "web" / "public",
        interactive=False,
        api_key=os.environ.get("OPENAI_API_KEY"),
        case_id=args.upload_id,
        skip_render=True,
        skip_publish=True,
        case_override=synthetic,
    )
    try:
        run_pipeline(
            config,
            fetch=urllib.request.urlretrieve,
            localize=mne_localize,
            render_stc=mne_render,
            complete=_complete,
        )
    except Exception as exc:
        status_path = root / "web" / "public" / "uploads" / f"{args.upload_id}.json"
        status_path.parent.mkdir(parents=True, exist_ok=True)
        status_path.write_text(
            json.dumps({"status": "failed", "caseId": args.upload_id, "error": str(exc)}) + "\n",
            encoding="utf-8",
        )
        print(str(exc), file=sys.stderr)
        return 1

    snap = out_dir / "cases" / args.upload_id
    status_path = root / "web" / "public" / "uploads" / f"{args.upload_id}.json"
    status_path.parent.mkdir(parents=True, exist_ok=True)
    if snap.is_dir():
        publish_case_snapshot(snap, config.web_public, args.upload_id)
        status_path.write_text(
            json.dumps({"status": "ready", "caseId": args.upload_id}) + "\n",
            encoding="utf-8",
        )
        return 0
    status_path.write_text(
        json.dumps({"status": "failed", "caseId": args.upload_id}) + "\n",
        encoding="utf-8",
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
