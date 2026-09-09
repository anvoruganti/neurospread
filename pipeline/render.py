from dataclasses import dataclass


@dataclass(frozen=True)
class RenderSettings:
    colormap: str
    time_step_s: float
    n_stills: int


def shared_render_settings() -> RenderSettings:
    return RenderSettings(colormap="hot", time_step_s=1.0, n_stills=4)


def require_source_estimate(stc) -> None:
    if stc is None or not hasattr(stc, "data"):
        raise ValueError("source estimate is required for render")


def assert_no_image_api(imported_modules: list[str]) -> None:
    for name in imported_modules:
        lowered = name.lower()
        if lowered == "openai.images" or "images.generate" in lowered:
            raise ValueError("image generation API is not allowed")
