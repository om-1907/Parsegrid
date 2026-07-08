import asyncio
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date

logger = logging.getLogger(__name__)

INR = "INR"

# Used only if the public rates endpoint is unavailable. The live path uses
# Frankfurter daily rates; these values keep extraction from failing outright.
FALLBACK_TO_INR_RATES: dict[str, float] = {
    "INR": 1.0,
    "USD": 95.11,
    "EUR": 111.68,
    "GBP": 129.6,
    "AED": 25.89,
    "SGD": 74.5,
    "AUD": 62.4,
    "CAD": 69.7,
    "JPY": 0.65,
}


@dataclass(frozen=True)
class CurrencyConversion:
    amount_inr: float
    currency: str
    rate_to_inr: float
    rate_date: str | None


def normalize_currency_code(value: str | None) -> str:
    if not value:
        return INR
    code = value.strip().upper()
    aliases = {
        "₹": "INR",
        "RS": "INR",
        "RS.": "INR",
        "RUPEE": "INR",
        "RUPEES": "INR",
        "$": "USD",
        "US$": "USD",
        "DOLLAR": "USD",
        "DOLLARS": "USD",
        "€": "EUR",
        "£": "GBP",
    }
    return aliases.get(code, code[:3] if len(code) >= 3 else INR)


async def convert_to_inr(amount: float | None, currency: str | None) -> CurrencyConversion | None:
    if amount is None:
        return None

    code = normalize_currency_code(currency)
    if code == INR:
        return CurrencyConversion(amount_inr=float(amount), currency=INR, rate_to_inr=1.0, rate_date=None)

    try:
        rate, rate_date = await _fetch_rate_to_inr(code)
    except Exception as exc:
        rate = FALLBACK_TO_INR_RATES.get(code)
        rate_date = None
        if rate is None:
            logger.warning("Unknown currency %s; storing amount as INR without conversion.", code)
            return CurrencyConversion(amount_inr=float(amount), currency=code, rate_to_inr=1.0, rate_date=None)
        logger.warning("Currency conversion API failed for %s; using fallback rate. Reason: %s", code, exc)

    return CurrencyConversion(
        amount_inr=round(float(amount) * rate, 2),
        currency=code,
        rate_to_inr=rate,
        rate_date=rate_date,
    )


async def _fetch_rate_to_inr(currency: str) -> tuple[float, str | None]:
    return await asyncio.to_thread(_fetch_rate_to_inr_sync, currency)


def _fetch_rate_to_inr_sync(currency: str) -> tuple[float, str | None]:
    params = urllib.parse.urlencode({"base": currency, "quotes": INR})
    url = f"https://api.frankfurter.dev/v2/rates?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "Parsegrid/1.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if isinstance(payload, list):
        if not payload:
            raise ValueError("empty exchange-rate response")
        row = payload[0]
        rate = row.get("rate")
        rate_date = row.get("date")
    else:
        rates = payload.get("rates") or {}
        rate = rates.get(INR) or payload.get("rate")
        rate_date = payload.get("date")

    if not isinstance(rate, (int, float)):
        raise ValueError(f"missing INR rate for {currency}")

    return float(rate), str(rate_date) if rate_date else str(date.today())
