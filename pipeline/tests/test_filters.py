from pipeline.filters import FilterConfig, default_filter_config


def test_default_filters_are_bandpass_1_40_and_notch_60():
    cfg = default_filter_config()
    assert cfg == FilterConfig(l_freq=1.0, h_freq=40.0, notch_freq=60.0)
    assert cfg.l_freq < cfg.h_freq
