# EffortGrid - Daily Log (MERN)

A full MERN application implementing the Daily Log table from the sketch with:

- Exact heading: **Welcome to Daily Log**
- Dynamic time-slot columns
- Editable dates
- Red `[+]` row insertion button with +1 day auto-date logic
- `click here change slots` control for interval configuration
- MongoDB persistence with Save/Load

## Project Structure

- `client/` React + Vite + Tailwind frontend
- `server/` Express + MongoDB backend

## 1) Configure Environment

1. Copy `server/.env.example` to `server/.env`
2. Set `MONGODB_URI` in `server/.env`

Example:

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/effort-grid
```

## 2) Install Dependencies

From repository root:

```bash
npm install
npm run install:all
```

## 3) Run in Development

From repository root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## 4) Build

```bash
npm run build
```

## API Endpoints

- `GET /api/daily-log` -> Load current table structure and rows
- `POST /api/daily-log/save` -> Save full table structure and rows

## Default Seeded Rows

When DB has no data yet, backend initializes:

- `2026/3/27`
- `2026/3/28`
