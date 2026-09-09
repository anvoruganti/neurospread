from dataclasses import dataclass
from pathlib import Path

MOVIE_FPS = 5


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


def movie_time_points(tmin: float, tmax: float, time_step_s: float) -> list[float]:
    if time_step_s <= 0:
        raise ValueError("time step must be positive")
    steps = int((tmax - tmin) / time_step_s)
    return [tmin + index * time_step_s for index in range(max(steps, 0) + 1)]


def still_indices(n_frames: int, n_stills: int) -> list[int]:
    if n_frames <= 0:
        raise ValueError("no frames to sample")
    count = max(min(n_stills, n_frames), 1)
    if count == 1:
        return [0]
    return [round(index * (n_frames - 1) / (count - 1)) for index in range(count)]


def _even_frame_size(frame) -> tuple[int, int]:
    height, width = frame.shape[:2]
    return width - width % 2, height - height % 2


def write_brain_movie(frames, path: Path, fps: int = MOVIE_FPS) -> Path:
    """Encode source-estimate screenshots to mp4. Frames come from mne.viz.Brain."""
    import imageio_ffmpeg
    import numpy as np

    if not frames:
        raise ValueError("no frames to encode")
    width, height = _even_frame_size(np.asarray(frames[0]))
    if width == 0 or height == 0:
        raise ValueError("frames are too small to encode")
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = imageio_ffmpeg.write_frames(
        str(path),
        size=(width, height),
        fps=fps,
        codec="libx264",
        pix_fmt_in="rgb24",
        pix_fmt_out="yuv420p",
        quality=7,
        macro_block_size=1,
    )
    writer.send(None)
    try:
        for frame in frames:
            cropped = np.asarray(frame)[:height, :width, :3]
            writer.send(np.ascontiguousarray(cropped, dtype=np.uint8).tobytes())
    finally:
        writer.close()
    return path


def write_still(frame, path: Path) -> Path:
    import imageio.v2 as imageio
    import numpy as np

    path.parent.mkdir(parents=True, exist_ok=True)
    imageio.imwrite(path, np.asarray(frame)[..., :3].astype(np.uint8))
    return path
