"""
Request Logger Middleware
─────────────────────────
Starlette-compatible middleware that instruments every HTTP request with:
  • Auto-generated X-Request-ID (UUID4)
  • Client IP extraction
  • Structured JSON log line with method, path, status, and execution time (ms)
  • Automatic redaction of sensitive headers (Authorization, Cookie)
"""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("parsegrid.access")

# Headers whose values must never appear in logs.
_REDACTED_HEADERS = {"authorization", "cookie", "x-api-key"}


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Logs every request with timing, request ID, and redacted headers."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Attach request_id to request state so downstream handlers can use it.
        request.state.request_id = request_id

        # Extract client IP (respects X-Forwarded-For from reverse proxies).
        client_ip = request.headers.get(
            "x-forwarded-for", request.client.host if request.client else "unknown"
        )
        # X-Forwarded-For may contain a chain; take the first (original) IP.
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "Request failed with unhandled exception",
                extra={
                    "request_id": request_id,
                    "client_ip": client_ip,
                    "method": request.method,
                    "path": request.url.path,
                    "elapsed_ms": elapsed_ms,
                },
                exc_info=True,
            )
            raise

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Build the structured log payload.
        log_data = {
            "request_id": request_id,
            "client_ip": client_ip,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
        }

        # Log at appropriate level based on status code.
        if response.status_code >= 500:
            logger.error("Request completed", extra=log_data)
        elif response.status_code >= 400:
            logger.warning("Request completed", extra=log_data)
        else:
            logger.info("Request completed", extra=log_data)

        # Attach the request ID to the response headers for client-side tracing.
        response.headers["X-Request-ID"] = request_id

        return response
