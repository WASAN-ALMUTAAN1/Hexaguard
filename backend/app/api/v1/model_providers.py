from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

from app.schemas.model_provider import (
    ModelProviderListResponse,
    ModelProviderTestRequest,
    ModelProviderTestResponse,
    RegistryModelCreate,
    RegistryModelUpdate,
    RegistryModelListResponse,
    RegistryModelResponse,
    RegistryModelTestResponse,
)
from app.services.model_provider_svc import (
    list_model_providers,
    test_model_provider,
    list_registry_models,
    create_registry_model,
    get_registry_model,
    update_registry_model,
    delete_registry_model,
    test_registry_model,
    set_default_registry_model,
    list_registry_models_db,
    create_registry_model_db,
    get_registry_model_db,
    update_registry_model_db,
    delete_registry_model_db,
    test_registry_model_db,
    set_default_registry_model_db,
)

router = APIRouter(tags=["Model Providers"])


@router.get("/model-providers", response_model=ModelProviderListResponse)
async def get_model_providers():
    return list_model_providers()


@router.post("/model-providers/test", response_model=ModelProviderTestResponse)
async def test_provider_connection(payload: ModelProviderTestRequest):
    return test_model_provider(payload)



# --------------------------------------------------------------------------
# Model Registry endpoints
# Kept in this existing route file to avoid creating unnecessary files.
# --------------------------------------------------------------------------

@router.get("/models", response_model=RegistryModelListResponse)
async def get_registry_models(
    provider: str | None = None,
    status: str | None = None,
    usage: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await list_registry_models_db(db, provider=provider, status=status, usage=usage, q=q)
    except Exception:
        return list_registry_models(provider=provider, status=status, usage=usage, q=q)


@router.post("/models", response_model=RegistryModelResponse)
async def add_registry_model(payload: RegistryModelCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await create_registry_model_db(db, payload)
    except Exception:
        return create_registry_model(payload)


@router.get("/models/{model_id}", response_model=RegistryModelResponse)
async def read_registry_model(model_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await get_registry_model_db(db, model_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model not found")
    except Exception:
        try:
            return get_registry_model(model_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Model not found")


@router.patch("/models/{model_id}", response_model=RegistryModelResponse)
async def patch_registry_model(model_id: str, payload: RegistryModelUpdate, db: AsyncSession = Depends(get_db)):
    try:
        return await update_registry_model_db(db, model_id, payload)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model not found")
    except Exception:
        try:
            return update_registry_model(model_id, payload)
        except KeyError:
            raise HTTPException(status_code=404, detail="Model not found")


@router.delete("/models/{model_id}")
async def remove_registry_model(model_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await delete_registry_model_db(db, model_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model not found")
    except Exception:
        try:
            return delete_registry_model(model_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Model not found")


@router.post("/models/{model_id}/test", response_model=RegistryModelTestResponse)
async def check_registry_model(model_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await test_registry_model_db(db, model_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model not found")
    except Exception:
        try:
            return test_registry_model(model_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Model not found")


@router.post("/models/{model_id}/set-default", response_model=RegistryModelResponse)
async def make_registry_model_default(model_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return await set_default_registry_model_db(db, model_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        try:
            return set_default_registry_model(model_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Model not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
