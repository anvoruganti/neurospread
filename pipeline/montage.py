_TO_1020 = {
    "FP1": "Fp1",
    "FP2": "Fp2",
    "FZ": "Fz",
    "F3": "F3",
    "F4": "F4",
    "F7": "F7",
    "F8": "F8",
    "CZ": "Cz",
    "C3": "C3",
    "C4": "C4",
    "T7": "T7",
    "T8": "T8",
    "T3": "T7",
    "T4": "T8",
    "PZ": "Pz",
    "P3": "P3",
    "P4": "P4",
    "P7": "P7",
    "P8": "P8",
    "T5": "P7",
    "T6": "P8",
    "O1": "O1",
    "O2": "O2",
    "OZ": "Oz",
}


def map_bipolar_channel(name: str) -> str | None:
    cleaned = name.strip().upper().replace(" ", "")
    if cleaned in {"ECG", "EKG", "VNS", "EDF"} or "ECG" in cleaned:
        return None
    first = cleaned.split("-", 1)[0]
    return _TO_1020.get(first)


def map_channel_list(names: list[str]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for original in names:
        mapped = map_bipolar_channel(original)
        if mapped is None or mapped in seen:
            continue
        seen.add(mapped)
        out.append((original, mapped))
    return out
