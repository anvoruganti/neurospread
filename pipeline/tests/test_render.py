from types import SimpleNamespace

import pytest

from pipeline.render import (
    RenderSettings,
    assert_no_image_api,
    require_source_estimate,
    shared_render_settings,
)


def test_both_methods_share_colormap_and_step():
    assert shared_render_settings() == RenderSettings(
        colormap="hot", time_step_s=1.0, n_stills=4
    )


def test_missing_stc_is_an_error():
    with pytest.raises(ValueError, match="source estimate"):
        require_source_estimate(None)
    with pytest.raises(ValueError, match="source estimate"):
        require_source_estimate(SimpleNamespace())


def test_openai_image_modules_are_rejected():
    with pytest.raises(ValueError, match="image"):
        assert_no_image_api(["numpy", "openai.images"])
    assert_no_image_api(["mne", "pyvista"]) is None
