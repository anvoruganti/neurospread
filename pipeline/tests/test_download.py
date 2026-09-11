from pathlib import Path

import pytest

from pipeline.download import PHYSIONET_EDF_URL, DownloadError, download_edf, edf_path, edf_url


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


def test_edf_url_uses_subject_folder(tmp_path: Path):
    assert edf_url("chb01_04.edf") == "https://physionet.org/files/chbmit/1.0.0/chb01/chb01_04.edf"
    assert edf_path(tmp_path, "chb01_04.edf") == tmp_path / "chb01_04.edf"
