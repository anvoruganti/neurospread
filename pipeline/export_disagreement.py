"""Write disagreement JSON from existing stats and parcels (no inverse).

Usage from repo root:

  python -m pipeline.export_disagreement
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from pipeline.disagreement import analyze_disagreement


def main() -> int:
    public = Path("web/public")
    stats_path = public / "seizure-stats.json"
    parcels_path = public / "brain" / "parcels.json"
    if not stats_path.exists() or not parcels_path.exists():
        print("Need web/public/seizure-stats.json and web/public/brain/parcels.json", file=sys.stderr)
        return 1
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    parcels = json.loads(parcels_path.read_text(encoding="utf-8"))
    disagreement = analyze_disagreement(parcels, stats)
    dest = public / "brain" / "disagreement.json"
    dest.write_text(json.dumps(disagreement, indent=2) + "\n", encoding="utf-8")
    walkthrough = {
        "status": "ok",
        "source": "deterministic",
        "captions": disagreement["captions"],
    }
    (public / "astra-walkthrough.json").write_text(
        json.dumps(walkthrough, indent=2) + "\n", encoding="utf-8"
    )
    case_dir = Path("pipeline/output/cases/chb01_03")
    case_dir.mkdir(parents=True, exist_ok=True)
    (case_dir / "seizure-stats.json").write_text(
        json.dumps(stats, indent=2) + "\n", encoding="utf-8"
    )
    (case_dir / "disagreement.json").write_text(
        json.dumps(disagreement, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {dest} type={disagreement['type']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
