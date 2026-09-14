"""CHB-MIT chb01 annotated seizures used by the disagreement probe."""

from __future__ import annotations

from typing import TypedDict

from pipeline.window import TimeWindow


class Case(TypedDict):
    id: str
    file: str
    subject: str
    tmin: float
    tmax: float
    hero: bool
    title: str
    summary: str


CHB01_CASES: tuple[Case, ...] = (
    {
        "id": "chb01_03",
        "file": "chb01_03.edf",
        "subject": "chb01",
        "tmin": 2996.0,
        "tmax": 3036.0,
        "hero": True,
        "title": "Seizure 3 — temporal spread",
        "summary": "Classic annotated window with clear dSPM vs sLORETA disagreement.",
    },
    {
        "id": "chb01_04",
        "file": "chb01_04.edf",
        "subject": "chb01",
        "tmin": 1467.0,
        "tmax": 1494.0,
        "hero": False,
        "title": "Seizure 4 — shorter burst",
        "summary": "27-second window; good for comparing peak timing across inverses.",
    },
    {
        "id": "chb01_15",
        "file": "chb01_15.edf",
        "subject": "chb01",
        "tmin": 1732.0,
        "tmax": 1772.0,
        "hero": False,
        "title": "Seizure 15 — frontal build-up",
        "summary": "40-second segment from the same CHB-MIT subject.",
    },
    {
        "id": "chb01_16",
        "file": "chb01_16.edf",
        "subject": "chb01",
        "tmin": 1015.0,
        "tmax": 1066.0,
        "hero": False,
        "title": "Seizure 16 — early recording",
        "summary": "51-second window with a different spread signature.",
    },
    {
        "id": "chb01_18",
        "file": "chb01_18.edf",
        "subject": "chb01",
        "tmin": 1720.0,
        "tmax": 1810.0,
        "hero": False,
        "title": "Seizure 18 — long evolution",
        "summary": "90-second seizure; watch propagation order change over time.",
    },
    {
        "id": "chb01_21",
        "file": "chb01_21.edf",
        "subject": "chb01",
        "tmin": 327.0,
        "tmax": 420.0,
        "hero": False,
        "title": "Seizure 21",
        "summary": "Extended CHB-MIT window (probe set).",
    },
    {
        "id": "chb01_26",
        "file": "chb01_26.edf",
        "subject": "chb01",
        "tmin": 1862.0,
        "tmax": 1963.0,
        "hero": False,
        "title": "Seizure 26",
        "summary": "Extended CHB-MIT window (probe set).",
    },
)

# Five recordings surfaced on the public site (hero + four more from PhysioNet CHB-MIT).
WEB_FEATURED_CASE_IDS: tuple[str, ...] = (
    "chb01_03",
    "chb01_04",
    "chb01_15",
    "chb01_16",
    "chb01_18",
)


def featured_web_cases() -> tuple[Case, ...]:
    by_id = {case["id"]: case for case in CHB01_CASES}
    return tuple(by_id[cid] for cid in WEB_FEATURED_CASE_IDS)


def get_case(case_id: str) -> Case:
    for case in CHB01_CASES:
        if case["id"] == case_id:
            return case
    raise KeyError(f"unknown case {case_id}")


def window_for_case(case_id: str) -> TimeWindow:
    case = get_case(case_id)
    return TimeWindow(tmin=case["tmin"], tmax=case["tmax"])
