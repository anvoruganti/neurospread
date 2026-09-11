from pipeline.cases import CHB01_CASES, get_case, window_for_case
from pipeline.disagreement import (
    analyze_disagreement,
    classify_peak_pair,
    compact_case,
    spread_order,
)
from pipeline.window import TimeWindow


def test_chb01_has_seven_annotated_seizures():
    assert len(CHB01_CASES) == 7
    assert CHB01_CASES[0]["id"] == "chb01_03"
    assert CHB01_CASES[0]["hero"] is True
    assert sum(1 for case in CHB01_CASES if case["hero"]) == 1


def test_window_for_case_matches_chb01_03():
    assert window_for_case("chb01_03") == TimeWindow(2996.0, 3036.0)
    assert get_case("chb01_04")["file"] == "chb01_04.edf"


def test_classify_agree_adjacent_distant_and_flip():
    assert classify_peak_pair("inferiortemporal-rh", "inferiortemporal-rh") == "agree"
    assert classify_peak_pair("parsopercularis-lh", "parstriangularis-lh") == "adjacent"
    assert classify_peak_pair("inferiortemporal-rh", "parstriangularis-rh") == "distant"
    assert classify_peak_pair("superiortemporal-lh", "superiortemporal-rh") == "hemisphere_flip"
    assert classify_peak_pair("unknown", "parstriangularis-rh") == "unknown"


def test_spread_order_uses_half_peak_crossing():
    parcels = {
        "times": [10.0, 11.0, 12.0],
        "parcels": {
            "a-lh": {
                "methods": {"dspm": {"mean": [1.0, 5.0, 10.0], "peak_time": 12.0, "peak_value": 10.0}}
            },
            "b-rh": {
                "methods": {"dspm": {"mean": [8.0, 8.0, 8.0], "peak_time": 10.0, "peak_value": 8.0}}
            },
        },
    }
    order = spread_order(parcels, "dspm", top_n=2)
    assert [row["parcel"] for row in order] == ["b-rh", "a-lh"]
    assert order[0]["time"] == 10.0
    assert order[1]["time"] == 11.0


def test_analyze_chb01_03_stats_is_distant_without_time_lag():
    stats = {
        "recording": "chb01_03.edf",
        "window": {"tmin": 2996.0, "tmax": 3036.0},
        "per_method": {
            "dspm": {"peak_time": 3031.54, "peak_label": "inferiortemporal-rh"},
            "sloreta": {"peak_time": 3031.54, "peak_label": "parstriangularis-rh"},
        },
    }
    result = analyze_disagreement(None, stats)
    assert result["type"] == "distant"
    assert result["time_lag"] is False
    assert result["source"] == "deterministic"
    assert result["highlight"] == ["inferiortemporal-rh", "parstriangularis-rh"]
    assert result["captions"][0]["t"] == 2996.0
    texts = " ".join(caption["text"] for caption in result["captions"])
    assert "inferiortemporal-rh" in texts
    assert "parstriangularis-rh" in texts
    assert "language model" in texts


def test_compact_case_omits_full_atlas():
    stats = {"recording": "chb01_03.edf", "window": {"tmin": 2996, "tmax": 3036}}
    disagreement = analyze_disagreement(
        {
            "times": [2996.0],
            "parcels": {
                "inferiortemporal-rh": {
                    "methods": {
                        "dspm": {"mean": [1.0], "peak_time": 2996.0, "peak_value": 1.0},
                        "sloreta": {"mean": [0.5], "peak_time": 2996.0, "peak_value": 0.5},
                    }
                }
            },
        },
        stats,
    )
    compact = compact_case(stats, disagreement)
    assert "parcels" not in compact
    assert compact["disagreement_type"] in {"agree", "distant", "adjacent", "unknown"}
    assert "Not diagnostic" in compact["limitations"]
