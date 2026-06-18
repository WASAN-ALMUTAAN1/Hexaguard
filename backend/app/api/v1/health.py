from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "online", "message": "HexaGuard AI Backend is operational"}