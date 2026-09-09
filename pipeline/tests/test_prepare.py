from pipeline.prepare import selected_channel_renames


def test_selected_channel_renames_drops_ecg_and_dedupes():
    mapping = selected_channel_renames(["FP1-F7", "FP1-F3", "ECG", "T8-P8"])
    assert mapping == {"FP1-F7": "Fp1", "T8-P8": "T8"}
