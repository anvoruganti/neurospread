from dataclasses import dataclass


@dataclass(frozen=True)
class TimeWindow:
    tmin: float
    tmax: float


def annotated_seizure_window() -> TimeWindow:
    """Hero case chb01_03. Other chb01 windows live in pipeline.cases."""
    return TimeWindow(tmin=2996.0, tmax=3036.0)


def crop_to_window(raw_tmin: float, raw_tmax: float, window: TimeWindow) -> TimeWindow:
    if window.tmin < raw_tmin or window.tmax > raw_tmax:
        raise ValueError("seizure window is not fully inside the recording")
    if window.tmax <= window.tmin:
        raise ValueError("seizure window is not fully inside the recording")
    return TimeWindow(tmin=window.tmin, tmax=window.tmax)
