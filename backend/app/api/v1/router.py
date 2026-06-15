from fastapi import APIRouter

from app.api.v1 import (
    auth,
    blue_team,
    campaigns,
    dashboard,
    datasets,
    manual_red_team,
    model_providers,
    reports,
    sandbox,
    users,
    scenarios,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(sandbox.router, prefix="/sandbox", tags=["Sandbox"])
api_router.include_router(scenarios.router, prefix="/scenarios", tags=["Scenarios"])
api_router.include_router(manual_red_team.router, prefix="/manual-red-team", tags=["Manual Red Team"])
api_router.include_router(blue_team.router, prefix="/blue-team", tags=["Blue Team"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(model_providers.router)
