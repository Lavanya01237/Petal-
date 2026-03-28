import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any

import requests
from requests import RequestException
from pydantic import ValidationError

from config import settings
from models.schemas import Lead


@dataclass
class SourceAttempt:
    url: str
    leads: list[Lead]
    error: str | None
    duration_seconds: float


def _source_priority(search_url: str) -> tuple[int, str]:
    host = search_url.lower()
    if "saasworthy.com" in host:
        return (0, host)
    if "getapp.com" in host:
        return (1, host)
    if "capterra.com" in host:
        return (2, host)
    return (3, host)


def normalize_company_name(company_name: str) -> str:
    return " ".join(company_name.lower().split())


def _filter_model_data(model_cls: type[Lead], data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key in model_cls.model_fields}


def _coerce_lead(raw_lead: dict[str, Any]) -> Lead | None:
    normalized = _filter_model_data(Lead, raw_lead)

    if not normalized.get("company_name"):
        fallback_name = raw_lead.get("company") or raw_lead.get("name")
        if isinstance(fallback_name, str) and fallback_name.strip():
            normalized["company_name"] = fallback_name.strip()

    if not normalized.get("website"):
        fallback_website = raw_lead.get("url") or raw_lead.get("company_url")
        if isinstance(fallback_website, str) and fallback_website.strip():
            normalized["website"] = fallback_website.strip()

    if not normalized.get("linkedin_url"):
        fallback_linkedin = raw_lead.get("linkedin")
        if isinstance(fallback_linkedin, str) and fallback_linkedin.strip():
            normalized["linkedin_url"] = fallback_linkedin.strip()

    try:
        return Lead(**normalized)
    except ValidationError:
        return None


def _build_source_goal(goal: str, desired_leads: int) -> str:
    return (
        f"{goal} Stop once you have {max(1, desired_leads)} matching lead(s) "
        "from this source."
    )


def fetch_leads_for_search_url(search_url: str, goal: str, desired_leads: int) -> list[Lead]:
    if not settings.tinyfish_api_key:
        raise RuntimeError("TINYFISH_API_KEY is required to query TinyFish.")

    print(f"[TinyFish] Starting TinyFish run for search URL: {search_url}")
    with requests.post(
        settings.tinyfish_url,
        headers={
            "X-API-Key": settings.tinyfish_api_key,
            "Content-Type": "application/json",
        },
        json={
            "url": search_url,
            "goal": _build_source_goal(goal, desired_leads),
            "proxy_config": {"enabled": False},
        },
        stream=True,
        timeout=(
            settings.tinyfish_connect_timeout_seconds,
            settings.tinyfish_read_timeout_seconds,
        ),
    ) as response:
        response.raise_for_status()

        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line:
                continue

            line = raw_line.strip()
            if not line.startswith("data: "):
                continue

            try:
                event = json.loads(line[6:])
            except json.JSONDecodeError:
                continue

            if event.get("streamingUrl"):
                print(f"[TinyFish] Live stream available for {search_url}: {event['streamingUrl']}")

            step_message = event.get("purpose") or event.get("action") or event.get("message")
            if step_message:
                print(f"[TinyFish] Step for {search_url}: {step_message}")

            if event.get("type") == "ERROR" or event.get("status") == "FAILED":
                raise RuntimeError(event.get("message") or f"TinyFish failed for {search_url}")

            if event.get("type") == "COMPLETE" and event.get("status") == "COMPLETED":
                result = event.get("resultJson") or event.get("result") or {}
                raw_leads = result.get("leads", []) if isinstance(result, dict) else result

                if not isinstance(raw_leads, list):
                    raise RuntimeError("TinyFish completed without a valid leads array.")

                leads = []
                for raw_lead in raw_leads:
                    if isinstance(raw_lead, dict):
                        lead = _coerce_lead(raw_lead)
                        if lead is not None:
                            leads.append(lead)

                print(
                    f"[TinyFish] Completed TinyFish run for {search_url}. Parsed {len(leads)} lead(s)."
                )
                return leads

    raise RuntimeError("TinyFish stream ended before a completed result was received.")


def _is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, RequestException):
        return True
    message = str(exc).lower()
    retryable_markers = [
        "timeout",
        "timed out",
        "connection",
        "temporarily unavailable",
        "429",
        "502",
        "503",
        "504",
        "stream ended",
    ]
    return any(marker in message for marker in retryable_markers)


def fetch_leads_for_search_url_with_retries(
    search_url: str, goal: str, desired_leads: int
) -> list[Lead]:
    attempts = max(1, settings.tinyfish_retry_attempts)
    backoff = max(0.0, settings.tinyfish_retry_backoff_seconds)
    last_exc: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            if attempt > 1:
                print(f"[TinyFish] Retry attempt {attempt}/{attempts} for {search_url}")
            return fetch_leads_for_search_url(search_url, goal, desired_leads)
        except Exception as exc:
            last_exc = exc
            if attempt >= attempts or not _is_retryable_error(exc):
                raise
            sleep_seconds = backoff * (2 ** (attempt - 1))
            if sleep_seconds > 0:
                print(
                    f"[TinyFish] Transient failure for {search_url}: {exc}. "
                    f"Retrying in {sleep_seconds:.1f}s."
                )
                time.sleep(sleep_seconds)

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("TinyFish request failed with unknown error.")


async def _run_source_attempt(search_url: str, goal: str, desired_leads: int) -> SourceAttempt:
    started_at = time.monotonic()
    try:
        leads = await asyncio.wait_for(
            asyncio.to_thread(
                fetch_leads_for_search_url_with_retries,
                search_url,
                goal,
                desired_leads,
            ),
            timeout=settings.tinyfish_task_timeout_seconds,
        )
        return SourceAttempt(
            url=search_url,
            leads=leads,
            error=None,
            duration_seconds=time.monotonic() - started_at,
        )
    except asyncio.TimeoutError:
        return SourceAttempt(
            url=search_url,
            leads=[],
            error=(
                "Timed out after "
                f"{settings.tinyfish_task_timeout_seconds} second(s)"
            ),
            duration_seconds=time.monotonic() - started_at,
        )
    except Exception as exc:
        return SourceAttempt(
            url=search_url,
            leads=[],
            error=str(exc),
            duration_seconds=time.monotonic() - started_at,
        )


async def collect_leads(search_urls: list[str], goal: str, desired_leads: int = 10) -> list[Lead]:
    if not search_urls:
        print("[TinyFish] No search URLs provided. Returning no leads.")
        return []

    ordered_urls = sorted(search_urls, key=_source_priority)
    print(f"[TinyFish] Collecting leads across {len(ordered_urls)} search URL(s).")

    deduped_leads: dict[str, Lead] = {}
    errors: list[str] = []
    successful_sources = 0

    for index, url in enumerate(ordered_urls, start=1):
        print(f"[TinyFish] Trying source {index}/{len(ordered_urls)}: {url}")
        attempt = await _run_source_attempt(url, goal, desired_leads)

        if attempt.error:
            message = f"{attempt.url}: {attempt.error}"
            print(f"[TinyFish] Error while collecting from {attempt.url}: {attempt.error}")
            errors.append(message)
            continue

        successful_sources += 1
        print(
            "[TinyFish] Source completed in "
            f"{attempt.duration_seconds:.1f}s with {len(attempt.leads)} lead(s)."
        )
        for lead in attempt.leads:
            key = normalize_company_name(lead.company_name)
            if key not in deduped_leads:
                deduped_leads[key] = lead

        if len(deduped_leads) >= desired_leads:
            print(
                f"[TinyFish] Reached desired lead count ({desired_leads}). Stopping early."
            )
            break

    if not deduped_leads and errors:
        raise RuntimeError(" | ".join(errors))

    if errors:
        print(f"[TinyFish] Partial source failures encountered: {len(errors)}")
    print(f"[TinyFish] Successful sources: {successful_sources}/{len(ordered_urls)}")
    print(f"[TinyFish] Deduplicated to {len(deduped_leads)} unique lead(s).")
    return list(deduped_leads.values())
