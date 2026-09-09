from dataclasses import dataclass


@dataclass(frozen=True)
class FilterConfig:
    l_freq: float
    h_freq: float
    notch_freq: float


def default_filter_config() -> FilterConfig:
    return FilterConfig(l_freq=1.0, h_freq=40.0, notch_freq=60.0)
