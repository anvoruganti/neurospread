from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline.run import RunConfig, run_pipeline
from pipeline.window import TimeWindow


def test_run_pipeline_writes_stats_and_copies_movies(tmp_path: Path):
    data_dir = tmp_path / "data"
    out_dir = tmp_path / "out"
    public = tmp_path / "public"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")

    def fetch(url, dest):
        raise AssertionError("should not fetch")

    def localize(raw_path, window, filters, jobs):
        assert raw_path.name == "chb01_03.edf"
        assert window == TimeWindow(2996.0, 3036.0)
        assert [job.method for job in jobs] == ["dspm", "sloreta"]
        stc = SimpleNamespace(data=True)
        return {"dspm": stc, "sloreta": stc}

    def render_stc(method, stc, dest, settings):
        (dest / f"seizure-{method}.mp4").write_bytes(b"movie")
        stills = dest / "stills"
        stills.mkdir(exist_ok=True)
        (stills / f"{method}-0.png").write_bytes(b"png")

    def complete(messages, model, api_key):
        return {
            "choices": [
                {
                    "message": {
                        "content": '{"captions": [{"t": 3010, "method": "dspm", "text": "peak"}]}'
                    }
                }
            ]
        }

    result = run_pipeline(
        RunConfig(
            data_dir=data_dir,
            out_dir=out_dir,
            web_public=public,
            interactive=False,
            api_key="sk-test",
        ),
        fetch=fetch,
        localize=localize,
        render_stc=render_stc,
        complete=complete,
    )
    assert (public / "seizure-dspm.mp4").exists()
    assert (public / "seizure-stats.json").exists()
    assert result["walkthrough"]["status"] == "ok"


def test_run_pipeline_stops_when_interactive_and_key_missing(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")

    def localize(raw_path, window, filters, jobs):
        stc = SimpleNamespace(data=True)
        return {"dspm": stc, "sloreta": stc}

    def render_stc(method, stc, dest, settings):
        dest.mkdir(parents=True, exist_ok=True)
        (dest / f"seizure-{method}.mp4").write_bytes(b"movie")

    from pipeline.astra import MissingAPIKeyError

    with pytest.raises(MissingAPIKeyError):
        run_pipeline(
            RunConfig(
                data_dir=data_dir,
                out_dir=tmp_path / "out",
                web_public=tmp_path / "public",
                interactive=True,
                api_key=None,
            ),
            fetch=lambda *a, **k: None,
            localize=localize,
            render_stc=render_stc,
            complete=lambda *a, **k: {},
        )
