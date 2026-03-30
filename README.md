# EffortGrid

EffortGrid is a full-stack productivity app for daily effort tracking. It combines:

- Time tracking with slot-based logging and timer controls
- Todo list management
- Dashboard insights with growth chart
- User authentication

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, React Router
- Backend: Node.js, Express, MongoDB (Mongoose), JWT auth

## Project Structure

- `client/` Frontend application
- `server/` Backend API

## Prerequisites

- Node.js 18+ recommended
- npm 9+ recommended
- MongoDB connection string

## Environment Setup

1. Copy `server/.env.example` to `server/.env`.
2. Set the values for your environment.

Example `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-strong-random-secret
CORS_ORIGINS=http://localhost:5173
```

Notes:

- Backend accepts either `MONGO_URI` or `MONGODB_URI`.
- If `JWT_SECRET` is missing, server uses a temporary dev secret and logs a warning.

## Installation

From repository root:

```bash
npm install
npm run install:all
```

## Run in Development

From repository root:

```bash
npm run dev
```

This starts both apps concurrently:

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

## Build and Start

Build client:

```bash
npm run build
```

Start server (production mode):

```bash
npm run start
```

## Available Root Scripts

- `npm run install:all` Install client and server dependencies
- `npm run dev` Run server and client together
- `npm run build` Build client
- `npm run start` Start server

## API Overview

Health:

- `GET /api/health`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`

Daily log:

- `GET /api/daily-log`
- `POST /api/daily-log/save`
- `DELETE /api/daily-log/row`

Protected logs:

- `GET /api/logs`
- `POST /api/logs`
- `DELETE /api/logs/:id`

## Key Features

- Glassmorphism-based responsive UI
- Home, Time Tracking, and Todo views
- Slot interval grouping based on 15-minute base units
- Timer mode and manual tick support
- Auto-save behavior with subtle saved indicator
- Daily effort trend chart

## Troubleshooting

- If CORS errors occur, update `CORS_ORIGINS` in `server/.env`.
- If DB connection fails, verify `MONGO_URI` and network access for your MongoDB cluster.
- If login token errors occur, verify `JWT_SECRET` is set and restart server.
