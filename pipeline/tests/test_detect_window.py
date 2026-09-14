from pipeline.window import TimeWindow


def test_time_window_accepts_detect_output_shape():
    window = TimeWindow(tmin=120.0, tmax=180.0)
    assert window.tmax - window.tmin >= 25.0
