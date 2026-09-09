from pathlib import Path


def test_pipeline_package_importable():
    import pipeline

    assert pipeline.__name__ == "pipeline"


def test_gitignore_covers_secrets_and_edf_dir():
    text = Path(".gitignore").read_text(encoding="utf-8")
    for token in (".env", "pipeline/data/", "node_modules/", "__pycache__/", ".next/"):
        assert token in text
