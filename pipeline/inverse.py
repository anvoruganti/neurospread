from dataclasses import dataclass

from pipeline.window import TimeWindow


@dataclass(frozen=True)
class InverseJob:
    method: str
    src: str
    tmin: float
    tmax: float


def inverse_jobs(window: TimeWindow) -> tuple[InverseJob, InverseJob]:
    shared = dict(src="fsaverage", tmin=window.tmin, tmax=window.tmax)
    return (
        InverseJob(method="dspm", **shared),
        InverseJob(method="sloreta", **shared),
    )
