from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_ghost = Column(Boolean, default=False, nullable=False)
    phone_mac_address = Column(String, unique=True, nullable=True)

    devices = relationship("Device", back_populates="user")

    def __repr__(self):
        return f"<User id={self.id} name={self.name!r} is_ghost={self.is_ghost}>"


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    mac_address = Column(String, unique=True, nullable=False, index=True)
    nickname = Column(String, nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    is_resident = Column(Boolean, default=False, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="devices")

    def __repr__(self):
        return (
            f"<Device id={self.id} mac={self.mac_address!r} "
            f"nickname={self.nickname!r} is_resident={self.is_resident}>"
        )


class OccupancyLog(Base):
    __tablename__ = "occupancy_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    count = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<OccupancyLog id={self.id} timestamp={self.timestamp} count={self.count}>"
