import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from api.routes import router
from api.auth import router as auth_router
from models.database import Base, async_engine, AsyncSessionLocal
import models.user  # Ensure User model is registered
import models.password_reset  # Ensure OTP + ResetToken models are registered

from middleware.rate_limiter import setup_rate_limiting
from middleware.request_logger import RequestLoggerMiddleware


# ═══════════════════════════════════════════════════════════════════════════
# Structured JSON Logging Configuration
# ═══════════════════════════════════════════════════════════════════════════
# Replaces basicConfig with a dictConfig that outputs structured,
# parseable log lines for production observability tools.

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "uvicorn": {"level": "INFO", "handlers": ["console"], "propagate": False},
        "uvicorn.error": {"level": "INFO", "handlers": ["console"], "propagate": False},
        "uvicorn.access": {"level": "WARNING", "handlers": ["console"], "propagate": False},
        "parsegrid.access": {"level": "INFO", "handlers": ["console"], "propagate": False},
        "sqlalchemy.engine": {"level": "WARNING", "handlers": ["console"], "propagate": False},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Database Initialization
# ═══════════════════════════════════════════════════════════════════════════

async def init_db():
    """Initializes the database models on startup."""
    try:
        async with async_engine.begin() as conn:
            # Emits the DDL to create tables (only if they don't exist)
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


# ═══════════════════════════════════════════════════════════════════════════
# Application Lifespan
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Modern lifespan event handler for FastAPI initialization and teardown.
    """
    # Startup phase
    logger.info("Starting up application and running database initialization...")
    await init_db()
    
    yield  # Application serves requests while suspended here
    
    # Shutdown phase
    logger.info("Shutting down application...")
    await async_engine.dispose()
    logger.info("Database engine connections closed.")


# ═══════════════════════════════════════════════════════════════════════════
# FastAPI Application
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Parsegrid — Document Extraction API",
    description="Intelligent API for processing and extracting structured data from PDF contracts using AI.",
    version="2.0.0",
    lifespan=lifespan,
)


# ── Middleware Stack (order matters: last added = first executed) ─────────

# 1. CORS — must be outermost to handle preflight OPTIONS requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. GZip — compress JSON responses > 500 bytes (Pillar 3: Performance).
app.add_middleware(GZipMiddleware, minimum_size=500)

# 3. Request Logger — structured logging with X-Request-ID (Pillar 4: Observability).
app.add_middleware(RequestLoggerMiddleware)

# 4. Rate Limiting — abuse prevention via slowapi (Pillar 2: Security).
setup_rate_limiting(app)


# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(router)
app.include_router(auth_router, prefix="/api/v1")


# ═══════════════════════════════════════════════════════════════════════════
# Health Check Endpoint (Pillar 5: Reliability)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["Infrastructure"])
async def health_check():
    """
    Lightweight liveness probe for Kubernetes / AWS ECS / Docker healthchecks.
    Pings the PostgreSQL database with `SELECT 1` to verify the connection pool
    is actively accepting connections.

    Returns:
        200 OK:  Database is reachable.
        503 Service Unavailable: Database connection failed.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "unreachable",
                "error": str(e),
            },
        )
