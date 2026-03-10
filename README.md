# Puppy MVP API

Minimal FastAPI backend for the Puppy MVP spec.

## Run

```bash
uvicorn app.main:app --reload
```

## Next.js Frontend

The project also includes a separate Next.js frontend in `frontend/`.

```bash
cd frontend
npm install
npm run dev
```

By default it talks to `http://127.0.0.1:8000`. Override with `NEXT_PUBLIC_API_BASE_URL` if needed.

## Test

```bash
python -m unittest discover -s tests -v
```

## Deploy Stats Output

`scripts/deploy_ec2.sh` now prints admin stats after restarting services.

Set an admin token before running deploy:

```bash
export PUPPY_ADMIN_TOKEN='your-strong-random-token'
```

Optional:

```bash
export ADMIN_STATS_URL='http://127.0.0.1:8000/admin/stats'
```
