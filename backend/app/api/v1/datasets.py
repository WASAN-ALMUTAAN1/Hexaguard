from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.dataset import (
    DatasetImportRequest,
    DatasetImportResponse,
    DatasetListResponse,
    DatasetResponse,
    DatasetRowsListResponse,
    DatasetUploadResponse,
)
from app.services.dataset_svc import DatasetService
from app.services.security_modules.dataset_source_normalizer import normalize_dataset_source
from app.services.dataset_connector_svc import DatasetConnectorService


router = APIRouter()


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await DatasetService.upload_dataset(db, file=file, name=name)


@router.post("/import", response_model=DatasetImportResponse)
async def import_dataset(
    payload: DatasetImportRequest,
    db: AsyncSession = Depends(get_db),
):
    normalized_source = normalize_dataset_source(
        source_type=payload.source_type,
        source_uri=payload.source_uri,
    )

    payload_update = {
        "source_type": normalized_source["source_type"],
        "source_uri": normalized_source["source_uri"],
    }

    if (
        normalized_source.get("kaggle_file_path")
        and not getattr(payload, "kaggle_file_path", None)
    ):
        payload_update["kaggle_file_path"] = normalized_source["kaggle_file_path"]

    try:
        payload = payload.model_copy(update=payload_update)
    except AttributeError:
        payload = payload.copy(update=payload_update)

    if payload.source_type in {"huggingface", "kaggle"}:
        return await DatasetConnectorService.import_connector_dataset(db, payload)

    return await DatasetService.import_dataset(db, payload)


@router.get("", response_model=DatasetListResponse)
@router.get("/", response_model=DatasetListResponse)
async def list_datasets(db: AsyncSession = Depends(get_db)):
    return await DatasetService.list_datasets(db)


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await DatasetService.get_dataset(db, dataset_id)


@router.get("/{dataset_id}/rows", response_model=DatasetRowsListResponse)
async def get_dataset_rows(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await DatasetService.get_dataset_rows(db, dataset_id)
