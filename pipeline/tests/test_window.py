import pytest

from pipeline.window import TimeWindow, annotated_seizure_window, crop_to_window


def test_annotated_window_is_chb01_03_seizure():
    window = annotated_seizure_window()
    assert window == TimeWindow(tmin=2996.0, tmax=3036.0)


def test_crop_accepts_window_inside_recording():
    cropped = crop_to_window(0.0, 3600.0, TimeWindow(2996.0, 3036.0))
    assert cropped == TimeWindow(2996.0, 3036.0)


def test_crop_rejects_window_past_end_of_recording():
    with pytest.raises(ValueError, match="inside"):
        crop_to_window(0.0, 2000.0, TimeWindow(2996.0, 3036.0))
