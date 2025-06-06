from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime

Base = declarative_base()

class Repository(Base):
    __tablename__ = "repositories"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    repo_url = Column(String, nullable=False)
    local_path = Column(String)
    branch = Column(String, default="main")
    last_scanned = Column(DateTime)
    last_commit = Column(String, nullable=True)

class Scan(Base):
    __tablename__ = "scans"
    id = Column(Integer, primary_key=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    scan_results = Column(JSON)
    repository = relationship("Repository", back_populates="scans")

Repository.scans = relationship("Scan", order_by=Scan.id, back_populates="repository")

# Update the connection string with your PostgreSQL credentials and database name.
engine = create_engine("postgresql://postgres:root@10.0.2.2/grad")
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
