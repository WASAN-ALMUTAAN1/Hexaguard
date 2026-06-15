from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class DatasetColumnMapping(BaseModel):
    prompt: Optional[str] = None
    row_id: Optional[str] = None
    attack_category: Optional[str] = None
    severity: Optional[str] = None
    risk_level: Optional[str] = None
    subcategory: Optional[str] = None
    owasp_category: Optional[str] = None
    expected_safe_behavior: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[str] = None


class DatasetImportRequest(BaseModel):
    source_type: Literal["direct_url", "github_raw", "huggingface", "kaggle"]
    source_uri: str = Field(..., min_length=5, max_length=2000)
    name: Optional[str] = None
    column_mapping: Optional[DatasetColumnMapping] = None

    # Request-only credentials. Do not store these in the database.
    kaggle_username: Optional[str] = None
    kaggle_key: Optional[str] = None
    kaggle_api_token: Optional[str] = None
    kaggle_file_path: Optional[str] = None
    hf_token: Optional[str] = None
    max_rows: int = Field(default=500, ge=1, le=500)


class DatasetCompatibilityReport(BaseModel):
    total_rows_detected: int
    valid_rows: int
    invalid_rows: int
    original_columns: list[str]
    detected_mapping: dict[str, Optional[str]]
    missing_prompt_rows: int
    detected_categories: list[str]
    detected_severities: list[str]
    owasp_mapping_coverage_percent: float
    ready_for_campaign: bool
    messages: list[str]


class DatasetRowResponse(BaseModel):
    id: int
    dataset_pk: int
    dataset_id: str
    row_id: str

    prompt: str
    attack_category: str
    severity: str
    risk_level: str
    subcategory: Optional[str]
    owasp_category: Optional[str]

    expected_safe_behavior: Optional[str]
    language: Optional[str]
    tags: list[str]
    row_metadata: dict[str, Any]

    created_at: datetime

    class Config:
        from_attributes = True


class DatasetResponse(BaseModel):
    id: int
    dataset_id: str

    name: str
    filename: str
    file_type: str

    source_type: str
    source_uri: Optional[str]

    row_count: int
    validation_status: str
    validation_message: Optional[str]

    original_columns: Optional[list[str]]
    detected_mapping: Optional[dict[str, Any]]
    validation_report: Optional[dict[str, Any]]

    created_at: datetime

    class Config:
        from_attributes = True


class DatasetListResponse(BaseModel):
    total: int
    items: list[DatasetResponse]


class DatasetUploadResponse(BaseModel):
    dataset: DatasetResponse
    preview_rows: list[DatasetRowResponse]


class DatasetImportResponse(BaseModel):
    dataset: DatasetResponse
    preview_rows: list[DatasetRowResponse]
    compatibility_report: DatasetCompatibilityReport


class DatasetRowsListResponse(BaseModel):
    dataset_id: str
    total: int
    items: list[DatasetRowResponse]
