from pathlib import Path

PHYSIONET_BASE = "https://physionet.org/files/chbmit/1.0.0"
EDF_FILENAME = "chb01_03.edf"
PHYSIONET_EDF_URL = f"{PHYSIONET_BASE}/chb01/{EDF_FILENAME}"


class DownloadError(RuntimeError):
    pass


def edf_url(filename: str = EDF_FILENAME) -> str:
    subject = filename.split("_")[0].replace(".edf", "")
    return f"{PHYSIONET_BASE}/{subject}/{filename}"


def edf_path(data_dir: Path, filename: str = EDF_FILENAME) -> Path:
    return data_dir / filename


def download_edf(data_dir: Path, fetch, filename: str = EDF_FILENAME) -> Path:
    dest = edf_path(data_dir, filename)
    if dest.exists():
        return dest
    data_dir.mkdir(parents=True, exist_ok=True)
    url = edf_url(filename)
    try:
        fetch(url, dest)
    except Exception as exc:
        raise DownloadError(f"failed to download {url} to {dest}") from exc
    if not dest.exists():
        raise DownloadError(f"failed to download {url} to {dest}")
    return dest
