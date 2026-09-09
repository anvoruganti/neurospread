import json

import pytest

from pipeline.astra import (
    ASTRA_MODEL,
    ImageGenerationForbidden,
    MissingAPIKeyError,
    build_walkthrough_prompt,
    parse_walkthrough_response,
    request_walkthrough,
)


STATS = {
    "recording": "chb01_03.edf",
    "window": {"tmin": 2996.0, "tmax": 3036.0},
    "methods": ["dspm", "sloreta"],
}


def test_prompt_sends_stats_and_forbids_images():
    messages = build_walkthrough_prompt(STATS)
    blob = json.dumps(messages)
    assert "chb01_03.edf" in blob
    assert "2996" in blob
    assert "image" in blob.lower()
    assert messages[0]["role"] == "system"


def test_parse_rejects_image_payload():
    with pytest.raises(ImageGenerationForbidden):
        parse_walkthrough_response({"b64_json": "aaaa"})
    with pytest.raises(ImageGenerationForbidden):
        parse_walkthrough_response({"data": [{"image": "aaaa"}]})


def test_parse_reads_captions_from_message_content():
    payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {"captions": [{"t": 3010.0, "method": "dspm", "text": "peak"}]}
                    )
                }
            }
        ]
    }
    parsed = parse_walkthrough_response(payload)
    assert parsed["captions"][0]["text"] == "peak"


def test_missing_key_interactive_asks_human():
    with pytest.raises(MissingAPIKeyError):
        request_walkthrough(STATS, api_key=None, interactive=True, complete=lambda *a, **k: {})


def test_missing_key_ci_skips():
    result = request_walkthrough(
        STATS, api_key=None, interactive=False, complete=lambda *a, **k: {}
    )
    assert result == {"status": "skipped", "captions": []}


def test_api_error_degrades_without_captions():
    def complete(messages, model, api_key):
        raise RuntimeError("timeout")

    result = request_walkthrough(
        STATS, api_key="sk-test", interactive=False, complete=complete
    )
    assert result["status"] == "error"
    assert result["captions"] == []
    assert "timeout" in result["message"]


def test_complete_image_forbidden_returns_error():
    def complete(messages, model, api_key):
        raise ImageGenerationForbidden("image payload is not allowed")

    result = request_walkthrough(
        STATS, api_key="sk-test", interactive=False, complete=complete
    )
    assert result["status"] == "error"
    assert result["captions"] == []
    assert "image payload is not allowed" in result["message"]


def test_complete_is_called_with_gpt_6_astra():
    captured = {}

    def complete(messages, model, api_key):
        captured["model"] = model
        return {
            "choices": [
                {"message": {"content": json.dumps({"captions": []})}}
            ]
        }

    result = request_walkthrough(
        STATS, api_key="sk-test", interactive=False, complete=complete
    )
    assert captured["model"] == ASTRA_MODEL
    assert result["status"] == "ok"
