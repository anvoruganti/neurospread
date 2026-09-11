"""Run the frozen disagreement prompt against one or more Chat Completions models.

Default model is the cheap runtime model. Add Astra after billing is enabled:

  STUDY_MODELS=gpt-4o-mini,gpt-6-astra python -m study.run_probe

Does not score. Writes raw JSON under study/responses/<model>/<case_id>.json.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

from pipeline.cases import CHB01_CASES
from pipeline.disagreement import compact_case
from pipeline.run import _complete, _load_dotenv

ROOT = Path(__file__).resolve().parents[1]
PROMPT_PATH = ROOT / "study" / "prompt.json"
CASES_DIR = ROOT / "pipeline" / "output" / "cases"
PUBLIC = ROOT / "web" / "public"
RESPONSES = ROOT / "study" / "responses"


def _load_prompt() -> dict:
    return json.loads(PROMPT_PATH.read_text(encoding="utf-8"))


def _load_case(case_id: str) -> tuple[dict, dict] | None:
    case_dir = CASES_DIR / case_id
    stats_path = case_dir / "seizure-stats.json"
    disagreement_path = case_dir / "disagreement.json"
    if not stats_path.exists() or not disagreement_path.exists():
        if case_id == "chb01_03" and (PUBLIC / "seizure-stats.json").exists():
            stats_path = PUBLIC / "seizure-stats.json"
            disagreement_path = PUBLIC / "brain" / "disagreement.json"
        else:
            return None
    if not disagreement_path.exists():
        return None
    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    disagreement = json.loads(disagreement_path.read_text(encoding="utf-8"))
    return stats, disagreement


def _models() -> list[str]:
    raw = os.environ.get("STUDY_MODELS") or os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"
    return [part.strip() for part in raw.split(",") if part.strip()]


def _safe_model_dir(model: str) -> str:
    return model.replace("/", "_")


def main() -> int:
    _load_dotenv(ROOT / ".env")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is missing. Set it to run the probe.", file=sys.stderr)
        return 1
    prompt = _load_prompt()
    models = _models()
    ran = 0
    missing = []
    for case in CHB01_CASES:
        loaded = _load_case(case["id"])
        if loaded is None:
            missing.append(case["id"])
            continue
        stats, disagreement = loaded
        payload = compact_case(stats, disagreement)
        messages = [
            {"role": "system", "content": prompt["system"]},
            {
                "role": "user",
                "content": prompt["user_prefix"] + "\n" + json.dumps(payload),
            },
        ]
        for model in models:
            print(f"{case['id']} {model}", flush=True)
            try:
                response = _complete(messages, model, api_key)
            except Exception as exc:
                print(f"  failed: {exc}", file=sys.stderr)
                dest_dir = RESPONSES / _safe_model_dir(model)
                dest_dir.mkdir(parents=True, exist_ok=True)
                (dest_dir / f"{case['id']}.json").write_text(
                    json.dumps({"status": "error", "error": str(exc)}, indent=2) + "\n",
                    encoding="utf-8",
                )
                continue
            dest_dir = RESPONSES / _safe_model_dir(model)
            dest_dir.mkdir(parents=True, exist_ok=True)
            (dest_dir / f"{case['id']}.json").write_text(
                json.dumps(
                    {"status": "ok", "model": model, "case_id": case["id"], "response": response},
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            ran += 1
    if missing:
        print(
            "No disagreement JSON yet for: "
            + ", ".join(missing)
            + ". Run python -m pipeline.localize_cases",
            file=sys.stderr,
        )
    print(f"Wrote {ran} responses under {RESPONSES}", flush=True)
    return 0 if ran else 1


if __name__ == "__main__":
    raise SystemExit(main())
