from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from config import settings
from models.schemas import FollowUpQuestion, RankedLead
from services import clients

try:
    from redis import Redis
except Exception:  # pragma: no cover
    Redis = None  # type: ignore[assignment]


SESSION_KEY_PREFIX = "warm-leads:session:"


@dataclass
class LeadSession:
    session_id: str
    early_customer: str
    product_description: str
    follow_up_questions: list[FollowUpQuestion]
    max_leads: int
    created_at: float = field(default_factory=time.time)
    follow_up_answers: dict[str, str] = field(default_factory=dict)
    search_intent: str | None = None
    structured_icp: dict[str, Any] = field(default_factory=dict)
    search_urls: list[str] = field(default_factory=list)
    leads: list[RankedLead] = field(default_factory=list)
    spreadsheet_csv: str | None = None


_sessions: dict[str, LeadSession] = {}


def _session_key(session_id: str) -> str:
    return f"{SESSION_KEY_PREFIX}{session_id}"


def _is_expired(session: LeadSession) -> bool:
    return (time.time() - session.created_at) > settings.session_ttl_seconds


def _get_redis_client() -> Redis | None:
    client = clients.get("redis")
    if client is None:
        return None
    return client


def _serialize_session(session: LeadSession) -> dict[str, Any]:
    return {
        "session_id": session.session_id,
        "early_customer": session.early_customer,
        "product_description": session.product_description,
        "follow_up_questions": [item.model_dump() for item in session.follow_up_questions],
        "max_leads": session.max_leads,
        "created_at": session.created_at,
        "follow_up_answers": session.follow_up_answers,
        "search_intent": session.search_intent,
        "structured_icp": session.structured_icp,
        "search_urls": session.search_urls,
        "leads": [item.model_dump() for item in session.leads],
        "spreadsheet_csv": session.spreadsheet_csv,
    }


def _deserialize_session(payload: dict[str, Any]) -> LeadSession:
    return LeadSession(
        session_id=payload["session_id"],
        early_customer=payload["early_customer"],
        product_description=payload["product_description"],
        follow_up_questions=[
            FollowUpQuestion(**item) for item in payload.get("follow_up_questions", [])
        ],
        max_leads=int(payload.get("max_leads", 10)),
        created_at=float(payload.get("created_at", time.time())),
        follow_up_answers={
            key: value
            for key, value in payload.get("follow_up_answers", {}).items()
            if isinstance(key, str) and isinstance(value, str)
        },
        search_intent=payload.get("search_intent"),
        structured_icp=payload.get("structured_icp", {}),
        search_urls=[item for item in payload.get("search_urls", []) if isinstance(item, str)],
        leads=[RankedLead(**item) for item in payload.get("leads", []) if isinstance(item, dict)],
        spreadsheet_csv=payload.get("spreadsheet_csv"),
    )


def _save_session(session: LeadSession) -> None:
    _sessions[session.session_id] = session
    redis_client = _get_redis_client()
    if redis_client is None:
        return

    try:
        redis_client.setex(
            _session_key(session.session_id),
            settings.session_ttl_seconds,
            json.dumps(_serialize_session(session), ensure_ascii=False),
        )
    except Exception as exc:
        print(f"[Session] Redis write failed. Falling back to memory: {exc}")


def _load_session(session_id: str) -> LeadSession | None:
    local = _sessions.get(session_id)
    if local is not None:
        if _is_expired(local):
            _sessions.pop(session_id, None)
            return None
        return local

    redis_client = _get_redis_client()
    if redis_client is None:
        return None

    try:
        raw = redis_client.get(_session_key(session_id))
        if not raw:
            return None
        payload = json.loads(raw)
        session = _deserialize_session(payload)
        if _is_expired(session):
            redis_client.delete(_session_key(session_id))
            return None
        _sessions[session.session_id] = session
        redis_client.expire(_session_key(session_id), settings.session_ttl_seconds)
        return session
    except Exception as exc:
        print(f"[Session] Redis read failed. Falling back to memory: {exc}")
        return None


def create_session(
    early_customer: str,
    product_description: str,
    follow_up_questions: list[FollowUpQuestion],
    max_leads: int,
) -> LeadSession:
    session = LeadSession(
        session_id=str(uuid.uuid4()),
        early_customer=early_customer.strip(),
        product_description=product_description.strip(),
        follow_up_questions=follow_up_questions,
        max_leads=max_leads,
    )
    _save_session(session)
    return session


def get_session(session_id: str) -> LeadSession:
    session = _load_session(session_id)
    if session is None:
        raise KeyError(f"Session not found: {session_id}")
    return session


def set_answers(session_id: str, answers: dict[str, str]) -> LeadSession:
    session = get_session(session_id)
    session.follow_up_answers = {
        key: value.strip()
        for key, value in answers.items()
        if isinstance(value, str) and value.strip()
    }
    _save_session(session)
    return session


def set_result(
    session_id: str,
    search_intent: str,
    structured_icp: dict[str, Any],
    search_urls: list[str],
    ranked_leads: list[RankedLead],
    spreadsheet_csv: str,
) -> LeadSession:
    session = get_session(session_id)
    session.search_intent = search_intent
    session.structured_icp = structured_icp
    session.search_urls = search_urls
    session.leads = ranked_leads
    session.spreadsheet_csv = spreadsheet_csv
    _save_session(session)
    return session
