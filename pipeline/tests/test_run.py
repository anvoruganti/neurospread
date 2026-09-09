import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline.run import RunConfig, _complete, run_pipeline
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


def test_complete_posts_chat_completion_with_api_key(monkeypatch):
    captured = {}
    response_payload = {
        "choices": [{"message": {"content": '{"captions": []}'}}],
    }

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def read(self):
            return json.dumps(response_payload).encode()

    def fake_urlopen(request, *, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr("pipeline.run.urllib.request.urlopen", fake_urlopen)
    messages = [{"role": "user", "content": "{}"}]

    result = _complete(messages, "gpt-6-astra", "test-api-key")

    request = captured["request"]
    assert request.full_url == "https://api.openai.com/v1/chat/completions"
    assert request.get_method() == "POST"
    assert request.get_header("Authorization") == "Bearer test-api-key"
    assert request.get_header("Content-type") == "application/json"
    assert json.loads(request.data) == {
        "model": "gpt-6-astra",
        "messages": messages,
    }
    assert captured["timeout"] == 60
    assert result == response_payload


def test_run_pipeline_rejects_missing_localization_method(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")

    with pytest.raises(ValueError, match="sloreta"):
        run_pipeline(
            RunConfig(
                data_dir=data_dir,
                out_dir=tmp_path / "out",
                web_public=tmp_path / "public",
                interactive=False,
                api_key=None,
            ),
            fetch=lambda *a, **k: None,
            localize=lambda *a, **k: {"dspm": SimpleNamespace(data=True)},
            render_stc=lambda *a, **k: None,
            complete=lambda *a, **k: {},
        )


@pytest.mark.parametrize(
    ("api_key", "complete", "expected_status"),
    [
        (None, lambda *a, **k: {}, "skipped"),
        (
            "test-api-key",
            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("unavailable")),
            "error",
        ),
    ],
)
def test_run_pipeline_copies_movies_after_degraded_walkthrough(
    tmp_path: Path,
    api_key,
    complete,
    expected_status,
):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "chb01_03.edf").write_bytes(b"edf")
    public = tmp_path / "public"

    def localize(*args):
        stc = SimpleNamespace(data=True)
        return {"dspm": stc, "sloreta": stc}

    def render_stc(method, stc, dest, settings):
        (dest / f"seizure-{method}.mp4").write_bytes(b"movie")

    result = run_pipeline(
        RunConfig(
            data_dir=data_dir,
            out_dir=tmp_path / "out",
            web_public=public,
            interactive=False,
            api_key=api_key,
        ),
        fetch=lambda *a, **k: None,
        localize=localize,
        render_stc=render_stc,
        complete=complete,
    )

    assert result["walkthrough"]["status"] == expected_status
    assert (public / "seizure-dspm.mp4").exists()
    assert (public / "seizure-sloreta.mp4").exists()
