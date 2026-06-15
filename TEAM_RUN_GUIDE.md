# HexaGuard Clean Team Version

## Status
This is the clean working version of the HexaGuard AI Red Teaming platform.

## What is included
- Active frontend source code
- Active backend source code
- Required configuration files
- Environment example files
- Project inventory files

## What is not included
- node_modules
- .next build cache
- Python __pycache__
- Real .env files
- Old backup folders
- Local generated cache files

## Frontend setup
cd frontend
cp .env.example .env.local
npm install
npm run build
npm run dev

## Backend setup
cd backend
cp .env.example .env
python -m compileall app
python -m uvicorn app.main:app --reload

## Important
The code is included, but the database records are not included unless a separate database dump is shared.

For local testing, configure DATABASE_URL in backend/.env.
