import json
import shutil
from pathlib import Path

from pipeline.cases import WEB_FEATURED_CASE_IDS, featured_web_cases


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
    brain = src_dir / "brain"
    if brain.exists():
        dest_brain = web_public / "brain"
        if dest_brain.exists():
            shutil.rmtree(dest_brain)
        shutil.copytree(brain, dest_brain)
    hero_id = WEB_FEATURED_CASE_IDS[0]
    case_snap = src_dir / "cases" / hero_id
    if case_snap.exists():
        publish_case_snapshot(case_snap, web_public, hero_id)
    write_cases_manifest(web_public)


def publish_case_snapshot(case_snap: Path, web_public: Path, case_id: str) -> None:
    """Copy one localized case folder into web/public/cases/<id>."""
    if not case_snap.is_dir():
        raise FileNotFoundError(case_snap)
    dest = web_public / "cases" / case_id
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(case_snap, dest)
    write_cases_manifest(web_public)


def case_is_ready(web_public: Path, case_id: str) -> bool:
    brain = web_public / "cases" / case_id / "brain"
    return (brain / "mesh.json").exists() and (brain / "activity.bin").exists()


def write_cases_manifest(web_public: Path) -> None:
    web_public.mkdir(parents=True, exist_ok=True)
    cases_dir = web_public / "cases"
    entries = []
    for case in featured_web_cases():
        ready = case_is_ready(web_public, case["id"])
        entry = {
            "id": case["id"],
            "file": case["file"],
            "subject": case["subject"],
            "tmin": case["tmin"],
            "tmax": case["tmax"],
            "hero": case["hero"],
            "title": case["title"],
            "summary": case["summary"],
            "durationSec": round(case["tmax"] - case["tmin"]),
            "ready": ready,
            "database": "CHB-MIT Scalp EEG (PhysioNet)",
        }
        if ready:
            stats_path = cases_dir / case["id"] / "seizure-stats.json"
            if stats_path.exists():
                stats = json.loads(stats_path.read_text(encoding="utf-8"))
                per = stats.get("per_method") or {}
                entry["peaks"] = {
                    "dspm": per.get("dspm", {}).get("peak_label"),
                    "sloreta": per.get("sloreta", {}).get("peak_label"),
                }
        entries.append(entry)
    manifest = {
        "version": 1,
        "defaultCaseId": WEB_FEATURED_CASE_IDS[0],
        "cases": entries,
    }
    (web_public / "cases" / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def publish_all_featured_from_output(output_dir: Path, web_public: Path) -> None:
    """Publish every featured case that exists under pipeline/output/cases."""
    for case_id in WEB_FEATURED_CASE_IDS:
        snap = output_dir / "cases" / case_id
        if snap.is_dir():
            publish_case_snapshot(snap, web_public, case_id)
    # Legacy root brain folder: treat as hero if cases/chb01_03 missing.
    hero = WEB_FEATURED_CASE_IDS[0]
    if not case_is_ready(web_public, hero) and (web_public / "brain" / "mesh.json").exists():
        dest = web_public / "cases" / hero
        dest.mkdir(parents=True, exist_ok=True)
        for name in ("seizure-stats.json", "astra-walkthrough.json", "disagreement.json"):
            src = web_public / name
            if src.exists():
                shutil.copy2(src, dest / name)
        brain_src = web_public / "brain"
        if brain_src.exists():
            brain_dest = dest / "brain"
            if brain_dest.exists():
                shutil.rmtree(brain_dest)
            shutil.copytree(brain_src, brain_dest)
        write_cases_manifest(web_public)
