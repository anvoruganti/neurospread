from pathlib import Path

PHYSIONET_EDF_URL = "https://physionet.org/files/chbmit/1.0.0/chb01/chb01_03.edf"
EDF_FILENAME = "chb01_03.edf"


class DownloadError(RuntimeError):
    pass


def edf_path(data_dir: Path) -> Path:
    return data_dir / EDF_FILENAME


def download_edf(data_dir: Path, fetch) -> Path:
    dest = edf_path(data_dir)
    if dest.exists():
        return dest
    data_dir.mkdir(parents=True, exist_ok=True)
    try:
        fetch(PHYSIONET_EDF_URL, dest)
    except Exception as exc:
        raise DownloadError(
            f"failed to download {PHYSIONET_EDF_URL} to {dest}"
        ) from exc
    if not dest.exists():
        raise DownloadError(f"failed to download {PHYSIONET_EDF_URL} to {dest}")
    return dest
