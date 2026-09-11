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


CHB01_CASES: tuple[Case, ...] = (
    {
        "id": "chb01_03",
        "file": "chb01_03.edf",
        "subject": "chb01",
        "tmin": 2996.0,
        "tmax": 3036.0,
        "hero": True,
    },
    {
        "id": "chb01_04",
        "file": "chb01_04.edf",
        "subject": "chb01",
        "tmin": 1467.0,
        "tmax": 1494.0,
        "hero": False,
    },
    {
        "id": "chb01_15",
        "file": "chb01_15.edf",
        "subject": "chb01",
        "tmin": 1732.0,
        "tmax": 1772.0,
        "hero": False,
    },
    {
        "id": "chb01_16",
        "file": "chb01_16.edf",
        "subject": "chb01",
        "tmin": 1015.0,
        "tmax": 1066.0,
        "hero": False,
    },
    {
        "id": "chb01_18",
        "file": "chb01_18.edf",
        "subject": "chb01",
        "tmin": 1720.0,
        "tmax": 1810.0,
        "hero": False,
    },
    {
        "id": "chb01_21",
        "file": "chb01_21.edf",
        "subject": "chb01",
        "tmin": 327.0,
        "tmax": 420.0,
        "hero": False,
    },
    {
        "id": "chb01_26",
        "file": "chb01_26.edf",
        "subject": "chb01",
        "tmin": 1862.0,
        "tmax": 1963.0,
        "hero": False,
    },
)


def get_case(case_id: str) -> Case:
    for case in CHB01_CASES:
        if case["id"] == case_id:
            return case
    raise KeyError(f"unknown case {case_id}")


def window_for_case(case_id: str) -> TimeWindow:
    case = get_case(case_id)
    return TimeWindow(tmin=case["tmin"], tmax=case["tmax"])
