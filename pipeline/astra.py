from __future__ import annotations

import json
from typing import Any, Callable

ASTRA_MODEL = "gpt-6-astra"
_IMAGE_KEYS = {"image", "b64_json", "images"}


class ImageGenerationForbidden(ValueError):
    pass


class MissingAPIKeyError(RuntimeError):
    pass


def build_walkthrough_prompt(stats: dict) -> list[dict[str, str]]:
    system = (
        "You write short timestamped captions for an EEG source-localization demo. "
        "Use only the JSON stats. Do not generate images, heatmaps, or pictures. "
        "This is public de-identified data and is not a diagnosis. "
        "Reply with JSON {\"captions\": [{\"t\": number, \"method\": \"dspm\"|\"sloreta\", \"text\": string}]}."
    )
    user = json.dumps(stats)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _contains_image_keys(obj: Any) -> bool:
    if isinstance(obj, dict):
        if _IMAGE_KEYS.intersection(obj.keys()):
            return True
        return any(_contains_image_keys(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_contains_image_keys(v) for v in obj)
    return False


def parse_walkthrough_response(payload: dict) -> dict:
    if _contains_image_keys(payload):
        raise ImageGenerationForbidden("image payload is not allowed")
    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    captions = parsed.get("captions", [])
    return {"captions": captions}


def request_walkthrough(
    stats: dict,
    *,
    api_key: str | None,
    interactive: bool,
    complete: Callable,
) -> dict:
    if not api_key:
        if interactive:
            raise MissingAPIKeyError("OPENAI_API_KEY is missing. Ask the human before calling Astra.")
        return {"status": "skipped", "captions": []}
    try:
        payload = complete(build_walkthrough_prompt(stats), ASTRA_MODEL, api_key)
    except Exception as exc:
        return {"status": "error", "captions": [], "message": str(exc)}
    try:
        parsed = parse_walkthrough_response(payload)
    except ImageGenerationForbidden:
        raise
    except Exception as exc:
        return {"status": "error", "captions": [], "message": str(exc)}
    return {"status": "ok", "captions": parsed["captions"]}
