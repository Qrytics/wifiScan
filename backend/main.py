"""
OmniPresence — FastAPI Backend

Endpoints
---------
GET  /status           — Current occupancy (ghost users anonymised).
POST /register-device  — Register a mobile device's MAC address.
GET  /analytics        — Peak occupancy heatmap data for the last 7 days.
POST /geofence         — Heartbeat from mobile app when entering home zone.
GET  /devices          — All known devices (admin / muster report).
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal, get_db, init_db
from models import Device, OccupancyLog, User

app = FastAPI(title="OmniPresence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DeviceRegistration(BaseModel):
    mac_address: str
    name: str | None = None
    phone_mac_address: str | None = None


class GeofenceHeartbeat(BaseModel):
    mac_address: str
    latitude: float
    longitude: float


class GhostToggle(BaseModel):
    user_id: int
    is_ghost: bool


# ---------------------------------------------------------------------------
# GET /status
# ---------------------------------------------------------------------------

@app.get("/status")
def get_status(db: Session = Depends(get_db)):
    """Return current occupancy count and who is present.

    If a user has ``is_ghost=True`` their name is replaced with
    "Unknown Resident" so privacy is preserved while the total count
    remains accurate.
    """
    five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    active_devices = (
        db.query(Device)
        .filter(Device.is_resident == True, Device.last_seen >= five_min_ago)  # noqa: E712
        .all()
    )

    present = []
    for device in active_devices:
        if device.user and device.user.is_ghost:
            present.append({"name": "Unknown Resident", "is_ghost": True})
        elif device.user:
            present.append({"name": device.user.name, "is_ghost": False})
        else:
            present.append(
                {"name": device.nickname or "Unknown Device", "is_ghost": False}
            )

    return {
        "total_count": len(present),
        "present": present,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /register-device
# ---------------------------------------------------------------------------

@app.post("/register-device", status_code=201)
def register_device(payload: DeviceRegistration, db: Session = Depends(get_db)):
    """Allow a mobile app to register its MAC address as a resident device."""
    mac = payload.mac_address.lower()

    device = db.query(Device).filter(Device.mac_address == mac).first()
    if device is None:
        device = Device(
            mac_address=mac,
            nickname=payload.name,
            is_resident=True,
            last_seen=datetime.now(timezone.utc),
        )
        db.add(device)
    else:
        device.is_resident = True
        if payload.name:
            device.nickname = payload.name

    if payload.name:
        phone_mac = (payload.phone_mac_address or mac).lower()
        user = db.query(User).filter(User.name == payload.name).first()
        if user is None:
            user = User(
                name=payload.name,
                phone_mac_address=phone_mac,
                is_ghost=False,
            )
            db.add(user)
            db.flush()
        device.user = user

    db.commit()
    return {"status": "registered", "mac_address": mac}


# ---------------------------------------------------------------------------
# GET /analytics
# ---------------------------------------------------------------------------

@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Return peak occupancy data for the last 7 days.

    Response includes a flat list of ``{ day, hour, avg_count, max_count }``
    objects suitable for rendering a day-of-week × hour heatmap.
    """
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    logs = (
        db.query(OccupancyLog)
        .filter(OccupancyLog.timestamp >= seven_days_ago)
        .all()
    )

    # Build a (day_of_week, hour) → [counts] index
    grid: dict[tuple[int, int], list[int]] = {}
    for log in logs:
        key = (log.timestamp.weekday(), log.timestamp.hour)
        grid.setdefault(key, []).append(log.count)

    heatmap = [
        {
            "day": day,
            "hour": hour,
            "avg_count": round(sum(counts) / len(counts), 2),
            "max_count": max(counts),
        }
        for (day, hour), counts in sorted(grid.items())
    ]

    return {
        "period_days": 7,
        "heatmap": heatmap,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /geofence  (Phase 5 — mobile geofencing heartbeat)
# ---------------------------------------------------------------------------

@app.post("/geofence")
def geofence_heartbeat(payload: GeofenceHeartbeat, db: Session = Depends(get_db)):
    """Receive a geofence 'entering zone' heartbeat from the mobile app.

    Marks the device as recently active so the scanner prioritises scanning
    for its MAC address on the next cycle.
    """
    mac = payload.mac_address.lower()
    device = db.query(Device).filter(Device.mac_address == mac).first()
    if device is None:
        raise HTTPException(
            status_code=404,
            detail=f"Device {mac} not registered. Call /register-device first.",
        )

    device.last_seen = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "acknowledged",
        "mac_address": mac,
        "message": "Scanner will prioritise this device on the next cycle.",
    }


# ---------------------------------------------------------------------------
# GET /devices  (admin / muster report)
# ---------------------------------------------------------------------------

@app.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    """Return all known devices with their last-seen timestamp (muster report)."""
    devices = db.query(Device).order_by(Device.last_seen.desc().nullslast()).all()
    five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)

    return [
        {
            "id": d.id,
            "mac_address": d.mac_address,
            "nickname": d.nickname,
            "is_resident": d.is_resident,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            "online": bool(d.last_seen and d.last_seen >= five_min_ago),
            "user": {"id": d.user.id, "name": d.user.name, "is_ghost": d.user.is_ghost}
            if d.user
            else None,
        }
        for d in devices
    ]


# ---------------------------------------------------------------------------
# PATCH /users/{user_id}/ghost  (ghost mode toggle)
# ---------------------------------------------------------------------------

@app.patch("/users/{user_id}/ghost")
def toggle_ghost(user_id: int, payload: GhostToggle, db: Session = Depends(get_db)):
    """Toggle Ghost Mode for a user."""
    if user_id != payload.user_id:
        raise HTTPException(status_code=400, detail="user_id mismatch.")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_ghost = payload.is_ghost
    db.commit()
    return {"user_id": user.id, "is_ghost": user.is_ghost}
