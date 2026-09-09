from pipeline.montage import map_bipolar_channel, map_channel_list


def test_bipolar_pair_maps_to_first_electrode_1020_spelling():
    assert map_bipolar_channel("FP1-F7") == "Fp1"
    assert map_bipolar_channel("T8-P8") == "T8"
    assert map_bipolar_channel("FZ-CZ") == "Fz"


def test_non_eeg_channels_are_dropped():
    assert map_bipolar_channel("ECG") is None
    assert map_bipolar_channel("VNS") is None


def test_duplicate_standard_names_keep_first_only():
    mapped = map_channel_list(["FP1-F7", "FP1-F3", "ECG", "F7-T7"])
    assert mapped == [("FP1-F7", "Fp1"), ("F7-T7", "F7")]
