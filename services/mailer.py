"""
Email service stub for the password-reset flow.
────────────────────────────────────────────────
Currently logs OTP emails to the application logger. Replace the body of
``send_otp_email`` with real SMTP / SendGrid / SES calls when ready.
"""

import logging

logger = logging.getLogger(__name__)


async def send_otp_email(email: str, otp: str) -> None:
    """
    Send a password-reset OTP to the given email address.

    **Current implementation:** Logs the email content for local development.
    Replace with an async SMTP client (e.g. ``aiosmtplib``) or a transactional
    email API (SendGrid, AWS SES) for production use.
    """
    logger.info(
        "─── PASSWORD RESET OTP EMAIL ───\n"
        "  To:      %s\n"
        "  Code:    %s\n"
        "  Expires: 10 minutes\n"
        "────────────────────────────────",
        email,
        otp,
    )
