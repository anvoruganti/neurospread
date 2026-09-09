from types import SimpleNamespace

import pytest

from pipeline.render import (
    RenderSettings,
    assert_no_image_api,
    movie_time_points,
    require_source_estimate,
    shared_render_settings,
    still_indices,
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


def test_movie_samples_the_window_at_the_shared_step():
    assert movie_time_points(2996.0, 3000.0, 1.0) == [
        2996.0,
        2997.0,
        2998.0,
        2999.0,
        3000.0,
    ]
    with pytest.raises(ValueError, match="time step"):
        movie_time_points(2996.0, 3000.0, 0.0)


def test_stills_span_the_first_and_last_frame():
    assert still_indices(41, 4) == [0, 13, 27, 40]
    assert still_indices(3, 4) == [0, 1, 2]
    assert still_indices(1, 4) == [0]
    with pytest.raises(ValueError, match="no frames"):
        still_indices(0, 4)
