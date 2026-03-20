"""
Ghost Scanner — The Engine

Scans 192.168.1.0/24 using scapy ARP sweeps, computes signal-strength
variance (pseudo-CSI via ICMP RTT spread) to detect physical movement,
and updates the PostgreSQL database on an async 30-second loop.
"""

import asyncio
import logging
import statistics
import subprocess
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from database import SessionLocal, init_db
from models import Device, OccupancyLog

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SCAN_NETWORK = "192.168.1.0/24"
SCAN_INTERVAL = 30       # seconds between scan cycles
PING_COUNT = 10          # pings per device for variance measurement
PING_WINDOW = 5          # seconds to spread pings across
VARIANCE_THRESHOLD = 10  # ms² RTT variance that indicates movement


# ---------------------------------------------------------------------------
# Network scanning
# ---------------------------------------------------------------------------

def arp_scan(network: str) -> dict[str, str]:
    """Return a ``{mac: ip}`` mapping of active hosts on *network*.

    Uses a scapy ARP sweep as the primary method, falling back to nmap
    when scapy is unavailable.
    """
    try:
        from scapy.layers.l2 import ARP, Ether
        from scapy.sendrecv import srp

        packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=network)
        answered, _ = srp(packet, timeout=3, verbose=False)
        return {rcv.hwsrc.lower(): rcv.psrc for _, rcv in answered}
    except Exception as exc:
        logger.error("scapy ARP scan failed: %s — falling back to nmap.", exc)
        return _nmap_scan(network)


def _nmap_scan(network: str) -> dict[str, str]:
    """Fallback: pull MAC+IP pairs from nmap host-discovery output."""
    results: dict[str, str] = {}
    current_ip = ""
    try:
        result = subprocess.run(
            ["nmap", "-sn", network],
            capture_output=True,
            text=True,
            timeout=30,
        )
        for line in result.stdout.splitlines():
            if "Nmap scan report for" in line:
                parts = line.split()
                current_ip = parts[-1].strip("()")
            elif "MAC Address:" in line and current_ip:
                mac = line.split()[2].lower()
                results[mac] = current_ip
    except Exception as exc:
        logger.error("nmap fallback failed: %s", exc)
    return results


# ---------------------------------------------------------------------------
# Signal variance (pseudo-CSI)
# ---------------------------------------------------------------------------

def ping_rtt_samples(ip: str) -> list[float]:
    """Ping *ip* PING_COUNT times and return RTT values in ms."""
    rtts: list[float] = []
    try:
        result = subprocess.run(
            [
                "ping",
                "-c", str(PING_COUNT),
                "-i", str(PING_WINDOW / PING_COUNT),
                ip,
            ],
            capture_output=True,
            text=True,
            timeout=PING_WINDOW + 5,
        )
        for line in result.stdout.splitlines():
            if "time=" in line:
                part = next(p for p in line.split() if p.startswith("time="))
                rtts.append(float(part.split("=")[1]))
    except Exception as exc:
        logger.warning("ping failed for %s: %s", ip, exc)
    return rtts


def signal_variance(ip: str) -> float | None:
    """Return RTT variance (ms²) as a proxy for physical movement.

    A variance above VARIANCE_THRESHOLD suggests the device owner is
    actively moving between the router and their phone, even if the
    phone appears idle on the network.
    """
    samples = ping_rtt_samples(ip)
    if len(samples) < 2:
        return None
    return statistics.variance(samples)


def is_moving(ip: str) -> bool:
    """Return True if RTT variance exceeds the movement threshold."""
    var = signal_variance(ip)
    if var is None:
        return False
    moving = var > VARIANCE_THRESHOLD
    if moving:
        logger.info("Movement detected for %s (variance=%.2f ms²)", ip, var)
    return moving


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def update_devices(db: Session, mac_to_ip: dict[str, str]) -> int:
    """Upsert seen devices, check for movement, and return resident count."""
    now = datetime.now(timezone.utc)
    resident_count = 0

    for mac, ip in mac_to_ip.items():
        device = db.query(Device).filter(Device.mac_address == mac).first()
        if device is None:
            device = Device(mac_address=mac, last_seen=now)
            db.add(device)
            logger.info("New device discovered: %s (%s)", mac, ip)
        else:
            device.last_seen = now

        # Pseudo-CSI: log movement hint when RTT variance is high
        if is_moving(ip):
            logger.info("Device %s (%s) appears to be in motion.", mac, ip)

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


# ---------------------------------------------------------------------------
# Async scan loop
# ---------------------------------------------------------------------------

async def scan_cycle() -> None:
    """Execute one full scan cycle: ARP sweep → upsert devices → log occupancy."""
    logger.info("Scan cycle starting on %s …", SCAN_NETWORK)
    loop = asyncio.get_event_loop()

    # ARP sweep runs in a thread-pool executor because scapy is blocking I/O
    mac_to_ip: dict[str, str] = await loop.run_in_executor(
        None, arp_scan, SCAN_NETWORK
    )
    logger.info("Found %d active device(s).", len(mac_to_ip))

    db: Session = SessionLocal()
    try:
        resident_count = update_devices(db, mac_to_ip)
        entry = log_occupancy(db, resident_count)
        logger.info(
            "Occupancy logged — id=%d count=%d", entry.id, entry.count
        )
    finally:
        db.close()


async def main() -> None:
    logger.info("Ghost Scanner starting — initialising database …")
    init_db()

    logger.info("Entering async scan loop (interval: %ds).", SCAN_INTERVAL)
    while True:
        try:
            await scan_cycle()
        except Exception:
            logger.exception("Unhandled error during scan cycle.")
        await asyncio.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
