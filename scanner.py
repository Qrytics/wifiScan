"""
Ghost Runner — The Engine
Scans the local Wi-Fi network for active devices, updates the database, and
logs an occupancy snapshot after every scan cycle.
"""

import logging
import subprocess
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from database import SessionLocal, init_db
from models import Device, OccupancyLog

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SCAN_INTERVAL_SECONDS = 60


def get_active_mac_addresses() -> list[str]:
    """Return a list of MAC addresses currently visible on the LAN using arp-scan."""
    try:
        result = subprocess.run(
            ["arp-scan", "--localnet", "--quiet"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        macs = []
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and ":" in parts[1]:
                macs.append(parts[1].lower())
        return macs
    except FileNotFoundError:
        logger.warning("arp-scan not found — falling back to ARP table.")
        return _get_macs_from_arp_table()
    except subprocess.TimeoutExpired:
        logger.error("arp-scan timed out.")
        return []


def _get_macs_from_arp_table() -> list[str]:
    """Parse /proc/net/arp as a fallback MAC-address source."""
    macs = []
    try:
        with open("/proc/net/arp") as fh:
            next(fh)  # skip header
            for line in fh:
                parts = line.split()
                if len(parts) >= 4 and parts[3] != "00:00:00:00:00:00":
                    macs.append(parts[3].lower())
    except OSError as exc:
        logger.error("Could not read ARP table: %s", exc)
    return macs


def update_devices(db: Session, mac_addresses: list[str]) -> int:
    """
    Upsert seen devices and return the count of *resident* devices online.
    A device is marked as a ghost when it disappears from the scan; this
    function only handles the *present* side of that lifecycle.
    """
    now = datetime.now(timezone.utc)
    resident_count = 0

    for mac in mac_addresses:
        device = db.query(Device).filter(Device.mac_address == mac).first()
        if device is None:
            device = Device(mac_address=mac, last_seen=now)
            db.add(device)
            logger.info("New device discovered: %s", mac)
        else:
            device.last_seen = now

        if device.is_resident:
            resident_count += 1

    db.commit()
    return resident_count


def log_occupancy(db: Session, count: int) -> OccupancyLog:
    """Append an occupancy snapshot to the log table."""
    entry = OccupancyLog(count=count)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def run_scan_cycle(db: Session) -> None:
    """Execute a single scan cycle: detect → update → log."""
    logger.info("Starting scan cycle…")
    macs = get_active_mac_addresses()
    logger.info("Found %d active MAC address(es).", len(macs))

    resident_count = update_devices(db, macs)
    entry = log_occupancy(db, resident_count)
    logger.info(
        "Occupancy logged — id=%d timestamp=%s count=%d",
        entry.id,
        entry.timestamp,
        entry.count,
    )


def main() -> None:
    logger.info("Ghost Runner starting — initialising database…")
    init_db()

    logger.info("Entering scan loop (interval: %ds).", SCAN_INTERVAL_SECONDS)
    while True:
        db = SessionLocal()
        try:
            run_scan_cycle(db)
        except Exception:
            logger.exception("Unhandled error during scan cycle.")
        finally:
            db.close()
        time.sleep(SCAN_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
