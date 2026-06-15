import re
from typing import Optional


def _strip_wrapping_quotes(value: str) -> str:
    return value.strip().strip("\"'`").strip()


def _extract_first_dataset_slug(value: str) -> Optional[str]:
    matches = re.findall(r"[\"']([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)[\"']", value)

    if not matches:
        return None

    return matches[0]


def normalize_dataset_source(
    source_type: str,
    source_uri: Optional[str],
) -> dict:
    raw_value = source_uri or ""
    value = _strip_wrapping_quotes(raw_value)

    if not value:
        return {
            "source_type": source_type,
            "source_uri": "",
            "kaggle_file_path": None,
            "changed": False,
        }

    huggingface_url = re.search(
        r"https?://huggingface\.co/datasets/([^?#\s]+)",
        value,
    )

    if huggingface_url:
        cleaned_path = (
            huggingface_url.group(1)
            .replace("/tree/", "/")
            .replace("/blob/", "/")
            .replace("/resolve/", "/")
            .rstrip("/")
        )

        # Keep only owner/dataset unless user included config/split manually elsewhere.
        parts = cleaned_path.split("/")
        dataset_id = "/".join(parts[:2]) if len(parts) >= 2 else cleaned_path

        return {
            "source_type": "huggingface",
            "source_uri": dataset_id,
            "kaggle_file_path": None,
            "changed": True,
        }

    huggingface_load_dataset = re.search(
        r"load_dataset\(\s*[\"']([^\"']+)[\"']",
        value,
    )

    if huggingface_load_dataset:
        return {
            "source_type": "huggingface",
            "source_uri": huggingface_load_dataset.group(1),
            "kaggle_file_path": None,
            "changed": True,
        }

    huggingface_parquet = re.search(
        r"hf://datasets/([^\"'\s]+)",
        value,
    )

    if huggingface_parquet:
        hf_path = huggingface_parquet.group(1)
        dataset_path = hf_path.split("/data/")[0].rstrip("/")
        split_match = re.search(r"/data/([A-Za-z0-9_-]+)-", hf_path)
        split = split_match.group(1) if split_match else None

        return {
            "source_type": "huggingface",
            "source_uri": f"{dataset_path}:default:{split}" if split else dataset_path,
            "kaggle_file_path": None,
            "changed": True,
        }

    kaggle_url = re.search(
        r"https?://(?:www\.)?kaggle\.com/datasets/([^?#\s]+/[^?#\s/]+)",
        value,
    )

    if kaggle_url:
        return {
            "source_type": "kaggle",
            "source_uri": kaggle_url.group(1),
            "kaggle_file_path": None,
            "changed": True,
        }

    kaggle_download = re.search(
        r"kagglehub\.dataset_download\(\s*[\"']([^\"']+)[\"']",
        value,
    )

    if kaggle_download:
        return {
            "source_type": "kaggle",
            "source_uri": kaggle_download.group(1),
            "kaggle_file_path": None,
            "changed": True,
        }

    if "kagglehub.load_dataset" in value:
        slug = _extract_first_dataset_slug(value)

        if slug:
            return {
                "source_type": "kaggle",
                "source_uri": slug,
                "kaggle_file_path": None,
                "changed": True,
            }

    github_blob = re.search(
        r"https?://github\.com/([^/\s]+)/([^/\s]+)/blob/([^/\s]+)/([^?\s#]+)",
        value,
    )

    if github_blob:
        owner, repo, branch, file_path = github_blob.groups()

        return {
            "source_type": "github_raw",
            "source_uri": f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}",
            "kaggle_file_path": None,
            "changed": True,
        }

    if "raw.githubusercontent.com" in value:
        return {
            "source_type": "github_raw",
            "source_uri": value,
            "kaggle_file_path": None,
            "changed": value != raw_value,
        }

    return {
        "source_type": source_type,
        "source_uri": value,
        "kaggle_file_path": None,
        "changed": value != raw_value,
    }
