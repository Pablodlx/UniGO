import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://unigo:unigo@localhost:5432/unigo")

Base = declarative_base()

# Try to create engine, but don't fail if it's not available (e.g., during Alembic imports)
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
except Exception as e:
    # During Alembic imports, engine creation might fail
    # Alembic will create its own engine, so this is okay
    import sys
    if "alembic" in sys.modules or "alembic" in " ".join(sys.argv):
        # We're being imported by Alembic, it's okay to not have an engine here
        engine = None
        SessionLocal = None
    else:
        # For the main app, we need the engine, so re-raise
        raise


def get_db():
    # Lazy initialization if engine wasn't created at import time
    if engine is None or SessionLocal is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)
    else:
        _engine = engine
        _SessionLocal = SessionLocal
    
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
