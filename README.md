# wifiScan

> **Real-time occupancy tracking and space intelligence powered by your existing Wi-Fi infrastructure.**

wifiScan is a privacy-first, full-stack application that turns any local network into a presence-sensing engine. By scanning for connected devices and analysing signal variance, it delivers an instant headcount of who is in a building — no extra hardware required.

🌐 **Live Demo (Admin Dashboard):** [https://qrytics.github.io/wifiScan/](https://qrytics.github.io/wifiScan/)

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Admin Dashboard Setup](#admin-dashboard-setup)
  - [Mobile App Setup](#mobile-app-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [CI/CD & GitHub Pages](#cicd--github-pages)
- [Project Structure](#project-structure)

---

## How It Works

1. **Scan** — The Python backend performs an ARP sweep of your local subnet (default `192.168.1.0/24`) every 30 seconds using [Scapy](https://scapy.net/), with an automatic fallback to `nmap`.
2. **Detect** — Every device that responds is recorded in a PostgreSQL database with its MAC address and a `last_seen` timestamp. Devices not seen in the last 5 minutes are considered offline.
3. **Analyse** — Round-trip time variance (pseudo-CSI) is measured to estimate physical movement. Occupancy counts are persisted to `OccupancyLog` for historical analytics.
4. **Present** — A React admin dashboard and a React Native mobile app both consume the FastAPI REST API to display live occupancy, trends, muster reports, and energy-saving recommendations.
5. **Geofence** — The mobile app runs a background task that sends a heartbeat to the backend when the user enters a 100 m radius around a configured home location, so the scanner can prioritise their device immediately.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Local Network                      │
│  ┌─────────────┐   ARP sweep    ┌────────────────────┐  │
│  │  Devices on │ ◄────────────  │  backend/scanner.py│  │
│  │  Wi-Fi      │                │  (Scapy / nmap)    │  │
│  └─────────────┘                └────────┬───────────┘  │
└─────────────────────────────────────────│───────────────┘
                                          │ SQLAlchemy ORM
                                          ▼
                                  ┌───────────────┐
                                  │  PostgreSQL DB │
                                  └───────┬───────┘
                                          │
                                  ┌───────▼───────┐
                                  │  FastAPI API  │
                                  │  (Uvicorn)    │
                                  └──┬────────┬──┘
                                     │        │
                          HTTP/REST  │        │  HTTP/REST
                       ┌─────────────┘        └─────────────┐
                       ▼                                     ▼
             ┌──────────────────┐               ┌───────────────────┐
             │  Admin Dashboard │               │  Mobile App       │
             │  React + Vite    │               │  React Native     │
             │  (GitHub Pages)  │               │  (Expo)           │
             └──────────────────┘               └───────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) | ≥ 0.115 |
| **ASGI Server** | [Uvicorn](https://www.uvicorn.org/) | ≥ 0.32 |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | 14+ |
| **ORM** | [SQLAlchemy](https://www.sqlalchemy.org/) | ≥ 2.0 |
| **Network Scanner** | [Scapy](https://scapy.net/) + nmap fallback | ≥ 2.5 |
| **Data Validation** | [Pydantic](https://docs.pydantic.dev/) | ≥ 2.0 |
| **Admin Frontend** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) | 18.3 / 5.4 |
| **Mobile App** | [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/) | 0.76 / 52 |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [NativeWind](https://www.nativewind.dev/) | 3.4 / 4.0 |
| **Icons** | [Lucide React / React Native](https://lucide.dev/) | 0.460 |
| **Language** | Python (backend) · TypeScript (frontend) | 3.11+ / 5.5+ |
| **CI/CD** | GitHub Actions → GitHub Pages | — |

---

## Features

- 📡 **Passive Wi-Fi Scanning** — ARP sweeps every 30 s; no client-side app required for device detection.
- 👥 **Real-time Occupancy** — Live headcount with a "who's here" list updated every 30–60 seconds.
- 🔥 **7-Day Heatmap** — Day-of-week × hour occupancy heatmap for pattern analysis.
- 📋 **Muster Report** — Full device list with online/offline status for emergency roll-calls.
- 💡 **Energy Recommendations** — Contextual suggestions based on current and predicted occupancy.
- 👻 **Ghost Mode** — Users can hide their name from the list while still being counted.
- 📱 **Background Geofencing** — Mobile app sends a heartbeat when arriving home (100 m radius).
- 🔔 **Guest Alerts** — Notification when an unregistered device is detected on the network.

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Python | 3.11 |
| Node.js | 20 |
| PostgreSQL | 14 |
| npm | 9 |
| Expo CLI | latest (`npm i -g expo-cli`) |
| nmap *(optional fallback)* | any |

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment variables (copy and edit)
cp ../.env.example .env           # or create manually — see below

# 5. Start the API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 6. In a second terminal, start the background scanner
#    (requires root / administrator for raw socket access)
sudo python scanner.py
```

The API will be available at `http://localhost:8000`.  
Interactive API docs (Swagger UI): `http://localhost:8000/docs`.

> **Note:** The scanner uses raw sockets for ARP sweeps and requires elevated privileges (`sudo` on Linux/macOS, Administrator on Windows).

---

### Admin Dashboard Setup

```bash
# 1. Navigate to the admin directory
cd admin

# 2. Install Node dependencies
npm install

# 3. Start the development server (with proxy to backend)
npm run dev
# → http://localhost:5173

# 4. Build for production
npm run build
# → output in admin/dist/

# 5. Preview the production build locally
npm run preview
```

During development, all `/api/*` requests are automatically proxied to `http://localhost:8000` via the Vite dev server configuration.

---

### Mobile App Setup

```bash
# 1. Navigate to the mobile directory
cd mobile

# 2. Install Node dependencies
npm install

# 3. Set your backend URL
# Edit mobile/app/index.tsx and mobile/tasks/geofence.ts
# or set EXPO_PUBLIC_API_URL in your environment

# 4. Start the Expo development server
npm start

# 5. Run on a specific platform
npm run android   # requires Android emulator or physical device
npm run ios       # requires macOS + Xcode
npm run web       # limited functionality preview
```

To receive background geofencing events on a physical device, build a development client:

```bash
npx expo run:ios     # or
npx expo run:android
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```dotenv
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wifiscan

# Optional: subnet to scan (defaults to 192.168.1.0/24)
SCAN_SUBNET=192.168.1.0/24
```

For the mobile app, set `EXPO_PUBLIC_API_URL` in `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.x:8000   # your backend's LAN IP
```

---

## API Reference

All endpoints are served by the FastAPI backend running on port **8000**.

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Current occupancy count and list of present residents (ghost users anonymised) |
| `POST` | `/register-device` | Register a mobile device's MAC address as a resident |
| `GET` | `/analytics` | 7-day occupancy heatmap data (day × hour grid) |
| `POST` | `/geofence` | Heartbeat from mobile app when entering the home geofence zone |
| `GET` | `/devices` | All known devices with online/offline status (muster report) |
| `PATCH` | `/users/{user_id}/ghost` | Toggle Ghost Mode for a specific user |

### Example Requests

```bash
# Check who is home
curl http://localhost:8000/status

# Register a new device
curl -X POST http://localhost:8000/register-device \
  -H "Content-Type: application/json" \
  -d '{"mac_address": "aa:bb:cc:dd:ee:ff", "name": "Alice"}'

# Get the 7-day analytics heatmap
curl http://localhost:8000/analytics

# Enable ghost mode for user ID 1
curl -X PATCH http://localhost:8000/users/1/ghost \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "is_ghost": true}'
```

---

## CI/CD & GitHub Pages

The repository uses **GitHub Actions** to automatically build and publish the admin dashboard to **GitHub Pages** on every push to `main`.

**Workflow file:** `.github/workflows/deploy.yml`

```
push to main
     │
     ▼
┌─────────────────────────┐
│  Build job              │
│  • actions/checkout@v4  │
│  • actions/setup-node@v4│
│  • npm ci               │
│  • npm run build        │   ← VITE_BASE_PATH=/wifiScan/
│  • upload-pages-artifact│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Deploy job             │
│  • actions/deploy-pages │
│  → https://qrytics      │
│    .github.io/wifiScan/ │
└─────────────────────────┘
```

To enable GitHub Pages in your own fork:

1. Go to **Settings → Pages** in your repository.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` — the workflow will handle the rest.

---

## Project Structure

```
wifiScan/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: build admin & deploy to GitHub Pages
├── backend/
│   ├── main.py                 # FastAPI application & all REST endpoints
│   ├── models.py               # SQLAlchemy ORM models (User, Device, OccupancyLog)
│   ├── database.py             # PostgreSQL engine, session factory & init_db()
│   ├── scanner.py              # Async ARP scanner loop (Scapy / nmap fallback)
│   └── requirements.txt        # Python dependencies
├── admin/
│   ├── src/
│   │   ├── App.tsx             # Root component — occupancy strip, heatmap, muster
│   │   ├── api.ts              # Typed API client (fetch wrappers)
│   │   ├── main.tsx            # React DOM entry point
│   │   └── components/
│   │       ├── OccupancyHeatmap.tsx   # 7×24 colour-coded grid
│   │       ├── MusterReport.tsx       # Online/offline device list
│   │       └── EnergySavingCard.tsx   # Context-aware recommendations
│   ├── index.html
│   ├── vite.config.ts          # Vite config with dev proxy & base path support
│   ├── tailwind.config.js
│   └── package.json
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx         # Expo Router root layout
│   │   └── index.tsx           # Dashboard screen (occupancy ring, who's here)
│   ├── tasks/
│   │   └── geofence.ts         # Background geofencing task (expo-task-manager)
│   ├── app.json                # Expo config (permissions, bundle IDs)
│   └── package.json
├── .gitignore
└── README.md
```

---

## License

This project is open source. See [LICENSE](LICENSE) for details.

