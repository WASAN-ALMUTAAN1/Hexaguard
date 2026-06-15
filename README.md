# HexaGuard AI
Red Teaming and Blue Teaming Platform for Secure AI Deployment.

## Overview
A professional SOC-style web platform to test AI models against adversarial attacks, evaluate responses, map vulnerabilities to OWASP LLM Top 10 2025, and generate actionable Blue Team mitigations.

## Tech Stack
* **Frontend**: Next.js, React, Tailwind CSS, TypeScript
* **Backend**: FastAPI, Python, PostgreSQL, SQLAlchemy, Alembic
* **Workers**: Celery, Redis
* **Deployment**: Docker Compose

## Local Setup
1. Clone the repository.
2. Run `docker-compose up -d` to start PostgreSQL and Redis.
3. Check backend and frontend directories for specific setup instructions.