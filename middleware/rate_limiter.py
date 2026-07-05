"""
Rate Limiting Middleware
────────────────────────
Global and per-route rate limiting using slowapi (in-memory, no Redis required).

Limits:
  • Global default: 60 requests/minute per IP
  • /upload:          10 requests/minute per IP
  • /auth/login:       5 requests/minute per IP
  • /auth/forgot-password: 3 requests/minute per IP
  • /auth/register:    5 requests/minute per IP
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Create the limiter instance with the default rate.
# Key function: extracts the client IP from the request for per-IP limiting.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    # In-memory storage (no Redis). For multi-process deployments,
    # switch to: storage_uri="redis://localhost:6379"
)


def setup_rate_limiting(app):
    """Wire the rate limiter into the FastAPI application."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
