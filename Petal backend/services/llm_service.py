from urllib.parse import urlparse

from typing import Any, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from config import settings
from models.schemas import (
    FollowUpQuestionsResult,
    ICPParseResult,
    ICPStructuredParseResult,
    SearchIntentResult,
    StructuredICP,
)
from services import clients


ICP_SYSTEM_PROMPT = """You are a B2B lead gen expert. Parse the raw ICP text into structured fields, write a plain-English
TinyFish goal telling it to find matching companies and return results as a JSON array called 'leads'
(fields: company_name, website, industry, company_size, location, contact_person, contact_title, email, linkedin_url),
and suggest 2-3 search URLs.

Search URL rules:
- Prefer software directory or category pages that list many relevant vendors.
- Prefer low-friction public pages on sites like Capterra, GetApp, and SaaSworthy.
- Avoid Google, LinkedIn, Bing, Yahoo, DuckDuckGo, and other search-engine or social-network result pages.
- Avoid URLs that obviously require login to browse results.
- Return direct URLs only."""

FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT = """You are a B2B lead generation strategist.
Given:
- the startup's early customer description
- what the product does
Generate the most important follow-up questions needed to identify high-quality warm leads.

Rules:
- Return 4 to 6 concise, practical questions.
- Focus on information that improves targeting quality (industry, geography, company size, tech stack, buying triggers, role seniority, budget urgency, etc.).
- Avoid yes/no wording when possible.
- Avoid repeating information already provided."""

SEARCH_INTENT_SYSTEM_PROMPT = """You are a B2B lead generation expert.
Using the startup context and Q&A responses, produce one precise search intent paragraph for downstream web automation.

Rules:
- Include target company profile, buyer persona/title, geography, company size, and relevant product-use context.
- Mention notable exclusions if present.
- Keep it practical and specific.
- Output only structured data."""


ModelT = TypeVar("ModelT", bound=BaseModel)
BLOCKED_HOST_FRAGMENTS = (
    "google.",
    "linkedin.com",
    "bing.com",
    "yahoo.com",
    "duckduckgo.com",
    "g2.com",
)
PREFERRED_HOST_FRAGMENTS = (
    "saasworthy.com",
    "getapp.com",
    "capterra.com",
)
HOST_PRIORITY = {
    "saasworthy.com": 0,
    "getapp.com": 1,
    "capterra.com": 2,
}
TINYFISH_GOAL_SUFFIX = (
    " Use the provided URL as the primary source of truth. Prefer extracting companies directly "
    "from that directory/category page and the vendor's own linked website. Avoid search engines, "
    "social networks, ZoomInfo, RocketReach, Crunchbase, and people-directory sites unless the "
    "current page clearly cannot provide enough matching companies. Stop once you have enough solid matches."
)


def get_openai_client() -> AsyncOpenAI:
    client = clients.get("openai")
    if client is None:
        raise RuntimeError("OpenAI client has not been initialized.")
    return client


def _filter_model_data(model_cls: type[ICPParseResult], data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key in model_cls.model_fields}


def _slugify_term(value: str) -> str:
    parts = ["".join(ch for ch in token.lower() if ch.isalnum()) for token in value.split()]
    return "-".join(part for part in parts if part)


def _extract_primary_category(structured_icp: StructuredICP, raw_icp: str) -> str:
    candidates: list[str] = []
    for field_value in (
        structured_icp.keywords,
        structured_icp.industries,
        structured_icp.departments,
        structured_icp.buyer_titles,
    ):
        if field_value:
            candidates.extend(item for item in field_value if isinstance(item, str) and item.strip())

    lowered_blob = " ".join(candidates).lower() + " " + raw_icp.lower()
    category_overrides = [
        ("customer success", "customer success"),
        ("help desk", "help desk"),
        ("customer support", "customer support"),
        ("customer service", "customer service"),
        ("crm", "crm"),
        ("sales enablement", "sales enablement"),
        ("marketing automation", "marketing automation"),
    ]
    for needle, category in category_overrides:
        if needle in lowered_blob:
            return category

    for candidate in candidates:
        if len(candidate.split()) <= 4:
            return candidate

    return "b2b software"


def _build_fallback_search_urls(structured_icp: StructuredICP, raw_icp: str) -> list[str]:
    category = _extract_primary_category(structured_icp, raw_icp)
    category_slug = _slugify_term(category) or "b2b-software"

    return [
        f"https://www.capterra.com/{category_slug}-software/",
        f"https://www.saasworthy.com/list/{category_slug}-software",
        "https://www.getapp.com/browse/",
    ]


def _is_blocked_search_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return True

    host = (parsed.netloc or "").lower()
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"http", "https"} or not host:
        return True

    return any(fragment in host for fragment in BLOCKED_HOST_FRAGMENTS)


def _normalize_search_urls(
    candidate_urls: list[str], structured_icp: StructuredICP, raw_icp: str
) -> list[str]:
    preferred_urls: list[tuple[int, str]] = []
    other_urls: list[str] = []
    seen: set[str] = set()

    def add_url(url: str) -> None:
        normalized_url = url.strip()
        if not normalized_url or normalized_url in seen or _is_blocked_search_url(normalized_url):
            return
        seen.add(normalized_url)

        host = urlparse(normalized_url).netloc.lower()
        if any(fragment in host for fragment in PREFERRED_HOST_FRAGMENTS):
            host_priority = min(
                HOST_PRIORITY.get(fragment, 99)
                for fragment in HOST_PRIORITY
                if fragment in host
            )
            preferred_urls.append((host_priority, normalized_url))
        else:
            other_urls.append(normalized_url)

    for url in candidate_urls:
        if isinstance(url, str):
            add_url(url)

    for fallback_url in _build_fallback_search_urls(structured_icp, raw_icp):
        add_url(fallback_url)

    preferred_urls.sort(key=lambda item: (item[0], item[1]))

    selected_urls: list[str] = []
    selected_hosts: set[str] = set()

    for _, url in preferred_urls:
        host = urlparse(url).netloc.lower()
        if host in selected_hosts:
            continue
        selected_urls.append(url)
        selected_hosts.add(host)
        if len(selected_urls) >= settings.tinyfish_max_search_urls:
            return selected_urls

    for url in [url for _, url in preferred_urls] + other_urls:
        host = urlparse(url).netloc.lower()
        if host in selected_hosts:
            continue
        selected_urls.append(url)
        selected_hosts.add(host)
        if len(selected_urls) >= settings.tinyfish_max_search_urls:
            break

    return selected_urls


def _extract_refusal(response: Any) -> str | None:
    if getattr(response, "refusal", None):
        return response.refusal

    for output in getattr(response, "output", []) or []:
        for content in getattr(output, "content", []) or []:
            refusal = getattr(content, "refusal", None)
            if refusal:
                return refusal
            if getattr(content, "type", None) == "refusal":
                return getattr(content, "text", None) or "The model refused the request."
    return None


async def _run_structured_prompt(
    system_prompt: str,
    user_prompt: str,
    response_model: type[ModelT],
) -> ModelT:
    client = get_openai_client()
    response = await client.responses.parse(
        model=settings.openai_model,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        text_format=response_model,
    )

    parsed = getattr(response, "output_parsed", None)
    if parsed is not None:
        return parsed

    refusal = _extract_refusal(response)
    if refusal:
        raise ValueError(f"OpenAI refused the request: {refusal}")

    raise ValueError("OpenAI did not return structured output.")


async def parse_icp(raw_icp: str) -> ICPParseResult:
    print("[LLM] Parsing raw ICP into structured search instructions.")
    response_model = await _run_structured_prompt(
        system_prompt=ICP_SYSTEM_PROMPT,
        user_prompt=f"Raw ICP text:\n{raw_icp}",
        response_model=ICPStructuredParseResult,
    )

    filtered = _filter_model_data(
        ICPParseResult,
        {
            "structured_icp": response_model.structured_icp.model_dump(),
            "tinyfish_goal": response_model.tinyfish_goal.strip() + TINYFISH_GOAL_SUFFIX,
            "search_urls": response_model.search_urls,
        },
    )
    search_urls = filtered.get("search_urls", [])
    if not isinstance(search_urls, list):
        search_urls = []

    filtered["search_urls"] = _normalize_search_urls(
        search_urls, response_model.structured_icp, raw_icp
    )
    icp_result = ICPParseResult(**filtered)
    print(f"[LLM] Parsed ICP. Generated {len(icp_result.search_urls)} search URL(s).")
    return icp_result


async def generate_follow_up_questions(
    early_customer: str, product_description: str
) -> list[str]:
    print("[LLM] Generating follow-up discovery questions.")
    response_model = await _run_structured_prompt(
        system_prompt=FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT,
        user_prompt=(
            "Early customer:\n"
            f"{early_customer}\n\n"
            "Product description:\n"
            f"{product_description}"
        ),
        response_model=FollowUpQuestionsResult,
    )

    questions: list[str] = []
    seen: set[str] = set()
    for question in response_model.questions:
        if not isinstance(question, str):
            continue
        normalized = " ".join(question.strip().split())
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        questions.append(normalized)
        if len(questions) >= 6:
            break

    if not questions:
        questions = [
            "Which specific industries should we prioritize first?",
            "What company size range should we target?",
            "Which buyer roles are most likely to respond early?",
            "Which geographic markets should we focus on first?",
        ]
    print(f"[LLM] Generated {len(questions)} follow-up question(s).")
    return questions


async def generate_search_intent(
    early_customer: str, product_description: str, follow_up_qa: list[dict[str, str]]
) -> str:
    print("[LLM] Generating final search intent from discovery answers.")
    qa_lines: list[str] = []
    for item in follow_up_qa:
        question = item.get("question", "").strip()
        answer = item.get("answer", "").strip()
        if question and answer:
            qa_lines.append(f"- Q: {question}\n  A: {answer}")

    response_model = await _run_structured_prompt(
        system_prompt=SEARCH_INTENT_SYSTEM_PROMPT,
        user_prompt=(
            "Early customer:\n"
            f"{early_customer}\n\n"
            "Product description:\n"
            f"{product_description}\n\n"
            "Follow-up Q&A:\n"
            f"{chr(10).join(qa_lines)}"
        ),
        response_model=SearchIntentResult,
    )
    return " ".join(response_model.search_intent.strip().split())


async def generate_structured_output(
    system_prompt: str,
    user_prompt: str,
    response_model: type[ModelT],
) -> ModelT:
    print("[LLM] Sending structured output request to OpenAI.")
    return await _run_structured_prompt(system_prompt, user_prompt, response_model)
