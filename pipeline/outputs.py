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
