from pipeline.inverse import InverseJob, inverse_jobs
from pipeline.window import TimeWindow


def test_inverse_jobs_are_dspm_and_sloreta_on_fsaverage_window():
    window = TimeWindow(2996.0, 3036.0)
    jobs = inverse_jobs(window)
    assert jobs == (
        InverseJob(method="dspm", src="fsaverage", tmin=2996.0, tmax=3036.0),
        InverseJob(method="sloreta", src="fsaverage", tmin=2996.0, tmax=3036.0),
    )
