from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.sandbox import router as sandbox_router
from app.db.session import engine
from app.models.models import ModelRegistry


app = FastAPI(title="HEXAGUARD API")

@app.on_event("startup")
async def ensure_model_registry_table():
    """Create the model registry table if it does not exist.

    This keeps Phase 2 persistent without adding a new migration file.
    """
    async with engine.begin() as conn:
        await conn.run_sync(ModelRegistry.__table__.create, checkfirst=True)



# CORS: allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Main API routes
app.include_router(api_router, prefix="/api/v1")

# HEXAGUARD Sandbox routes
app.include_router(sandbox_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "HEXAGUARD API is running",
        "docs": "/docs",
        "sandbox": "/api/v1/sandbox/run",
    }


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "service": "HexaGuard API",
        "version": "1.0.0",
    }


@app.get("/api/v1/health", tags=["System"])
async def api_health_check():
    return {
        "status": "ok",
        "service": "HexaGuard API",
        "version": "1.0.0",
    }

