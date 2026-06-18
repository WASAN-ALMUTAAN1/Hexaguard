# backend/app/worker.py
from celery import Celery
from app.core.config import settings

# Initialize Celery with Redis as the broker
celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

@celery_app.task(name="run_attack_campaign")
def run_attack_campaign(campaign_id: str, prompts: list):
    # In a real scenario, you'd integrate the ModelConnector here
    results = []
    for prompt in prompts:
        # Simulate testing logic
        results.append(f"Tested: {prompt}")
    return {"campaign_id": campaign_id, "results": results}