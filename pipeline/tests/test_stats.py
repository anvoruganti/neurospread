import numpy as np

from pipeline.filters import FilterConfig
from pipeline.stats import build_seizure_stats, hemisphere_power, peak_from_source_data
from pipeline.window import TimeWindow


def test_peak_comes_from_largest_absolute_sample():
    times = np.array([2996.0, 3000.0, 3010.0, 3036.0])
    data = np.array(
        [
            [0.1, 0.2, 0.0, 0.0],
            [0.0, 0.0, -5.0, 0.1],
            [0.3, 0.1, 0.2, 0.4],
        ]
    )
    peak = peak_from_source_data(times, data, ["a", "lh.superiortemporal", "c"])
    assert peak == {
        "peak_time": 3010.0,
        "peak_label": "lh.superiortemporal",
        "peak_index": 1,
    }


def test_hemisphere_fraction_uses_mean_absolute_power():
    lh = np.array([2.0, 2.0])
    rh = np.array([1.0, 1.0])
    scores = hemisphere_power(lh, rh)
    assert scores["left"] == 2.0
    assert scores["right"] == 1.0
    assert scores["left_fraction"] == 2.0 / 3.0


def test_build_seizure_stats_has_required_keys():
    stats = build_seizure_stats(
        recording="chb01_03.edf",
        window=TimeWindow(2996.0, 3036.0),
        filters=FilterConfig(1.0, 40.0, 60.0),
        src="fsaverage",
        per_method={
            "dspm": {
                "peak_time": 3010.0,
                "peak_label": "lh.superiortemporal",
                "hemisphere": {"left": 2.0, "right": 1.0, "left_fraction": 2.0 / 3.0},
            }
        },
    )
    assert stats["recording"] == "chb01_03.edf"
    assert stats["window"] == {"tmin": 2996.0, "tmax": 3036.0}
    assert stats["filters"] == {"l_freq": 1.0, "h_freq": 40.0, "notch_freq": 60.0}
    assert stats["src"] == "fsaverage"
    assert stats["methods"] == ["dspm"]
    assert stats["per_method"]["dspm"]["peak_label"] == "lh.superiortemporal"
