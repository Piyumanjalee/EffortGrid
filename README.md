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

- **Glassmorphism UI**: Premium glass-morphic design with `bg-white/80`, `backdrop-blur-xl` throughout
- **Home, Time Tracking, and Todo Views**: Multi-view dashboard with tab navigation
- **Slot Interval Grouping**: Based on 15-minute base units (15, 30, 45, 60 min intervals)
- **Timer Controls**: Start, pause, resume, and cancel timers with intuitive UI
  - **Cancel Timer Modal**: Clean confirmation dialog (replaces `window.confirm`) with orange-themed design
  - **Timer Completion Notifications**: Audio alert (CDN-hosted) + success toast + visual slot flash
- **Manual Tick Support**: Manually check slots without using timer
- **Auto-save**: Debounced saves (700ms) with subtle saved indicator
- **Daily Effort Trend Chart**: Visual growth tracking with Recharts
- **Responsive Design**: Mobile-friendly layout with Tailwind CSS

## Timer & Notifications

### Timer Controls
- **Start Timer**: Begin tracking effort for a slot
- **Pause/Resume**: Temporarily halt timer without losing progress
- **Cancel Timer**: Stop and reset slot with confirmation modal
- **Auto-Complete**: Automatically checks slot when timer reaches 0:00

### Cancel Timer Modal
When you click on an active timer or the cancel button (×), a custom glassmorphic confirmation modal appears:
- **Design**: Matches premium UI with orange-themed TimerOff icon
- **Buttons**: "Keep Running" (cancel) and "Stop Timer" (confirm) with clear intent
- **Backdrop**: Click outside to dismiss without action

### Timer Completion Feedback
When a timer finishes:
1. **Audio Notification**: Plays CDN-hosted completion sound (volume: 0.5)
2. **Success Toast**: "Success: timer finished" message (auto-dismisses after 1.8s)
3. **Visual Flash**: Slot background flashes emerald green (1.2s duration)

## Troubleshooting

- If CORS errors occur, update `CORS_ORIGINS` in `server/.env`.
- If DB connection fails, verify `MONGO_URI` and network access for your MongoDB cluster.
- If login token errors occur, verify `JWT_SECRET` is set and restart server.
