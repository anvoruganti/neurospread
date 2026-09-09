from pathlib import Path

import pytest

from pipeline.outputs import copy_derived_outputs, public_filenames


def test_public_filenames_match_spec():
    names = public_filenames()
    assert names["dspm_mp4"] == "seizure-dspm.mp4"
    assert names["sloreta_mp4"] == "seizure-sloreta.mp4"
    assert names["stats"] == "seizure-stats.json"
    assert names["walkthrough"] == "astra-walkthrough.json"


def test_copy_writes_movies_and_json(tmp_path: Path):
    src = tmp_path / "src"
    dest = tmp_path / "public"
    src.mkdir()
    (src / "seizure-dspm.mp4").write_bytes(b"dspm")
    (src / "seizure-sloreta.mp4").write_bytes(b"sloreta")
    (src / "seizure-stats.json").write_text("{}", encoding="utf-8")
    (src / "astra-walkthrough.json").write_text("{}", encoding="utf-8")
    stills = src / "stills"
    stills.mkdir()
    (stills / "dspm-0.png").write_bytes(b"png")
    copy_derived_outputs(src, dest)
    assert (dest / "seizure-dspm.mp4").read_bytes() == b"dspm"
    assert (dest / "stills" / "dspm-0.png").read_bytes() == b"png"


def test_copy_refuses_missing_movie(tmp_path: Path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "seizure-stats.json").write_text("{}", encoding="utf-8")
    with pytest.raises(FileNotFoundError):
        copy_derived_outputs(src, tmp_path / "public")
