"""Publish localized cases from pipeline/output to web/public/cases.

  python -m pipeline.publish_web_cases
"""

from __future__ import annotations

from pathlib import Path

from pipeline.outputs import publish_all_featured_from_output


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    publish_all_featured_from_output(root / "pipeline" / "output", root / "web" / "public")
    print("Wrote web/public/cases/manifest.json", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
