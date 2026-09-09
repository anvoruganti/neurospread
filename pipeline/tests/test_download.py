from pathlib import Path

import pytest

from pipeline.download import PHYSIONET_EDF_URL, DownloadError, download_edf, edf_path


def test_edf_path_uses_chb01_03_name(tmp_path: Path):
    assert edf_path(tmp_path) == tmp_path / "chb01_03.edf"


def test_download_skips_fetch_when_file_exists(tmp_path: Path):
    dest = tmp_path / "chb01_03.edf"
    dest.write_bytes(b"edf")
    calls = []

    def fetch(url: str, path: Path) -> None:
        calls.append((url, path))

    result = download_edf(tmp_path, fetch)
    assert result == dest
    assert calls == []


def test_download_error_includes_url_and_path(tmp_path: Path):
    def fetch(url: str, path: Path) -> None:
        raise OSError("network down")

    with pytest.raises(DownloadError) as exc:
        download_edf(tmp_path, fetch)
    message = str(exc.value)
    assert PHYSIONET_EDF_URL in message
    assert str(tmp_path / "chb01_03.edf") in message
