import json
from typing import Any

from models.schemas import Lead, LeadScore, LeadScoresResult, RankedLead
from services.llm_service import generate_structured_output
from services.tinyfish_service import normalize_company_name


RANKING_SYSTEM_PROMPT = """You are a B2B lead scoring expert.
Score each lead against the structured ICP from 0.0 to 1.0 and explain why.
Return a structured result with a 'leads' array containing:
- company_name
- score
- match_reasons"""


def _clamp_score(score: float) -> float:
    return max(0.0, min(1.0, score))


async def rank_leads(
    raw_icp: str, structured_icp: dict[str, Any], leads: list[Lead], max_leads: int
) -> list[RankedLead]:
    if not leads:
        print("[Ranking] No leads available for ranking.")
        return []

    print(f"[Ranking] Scoring {len(leads)} lead(s) against the ICP.")
    user_prompt = (
        "Raw ICP:\n"
        f"{raw_icp}\n\n"
        "Structured ICP:\n"
        f"{json.dumps(structured_icp, ensure_ascii=False, indent=2)}\n\n"
        "Raw leads:\n"
        f"{json.dumps([lead.model_dump() for lead in leads], ensure_ascii=False, indent=2)}"
    )
    response_data = await generate_structured_output(
        system_prompt=RANKING_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_model=LeadScoresResult,
    )

    scores: dict[str, LeadScore] = {}
    for score in response_data.leads:
        scores[normalize_company_name(score.company_name)] = LeadScore(
            company_name=score.company_name,
            score=_clamp_score(score.score),
            match_reasons=score.match_reasons,
        )

    ranked_leads: list[RankedLead] = []
    for lead in leads:
        score = scores.get(normalize_company_name(lead.company_name))
        ranked_lead = RankedLead(
            **lead.model_dump(),
            score=score.score if score is not None else 0.0,
            match_reasons=(
                score.match_reasons
                if score is not None
                else ["No ranking rationale returned for this lead."]
            ),
            rank=1,
        )
        ranked_leads.append(ranked_lead)

    ranked_leads.sort(key=lambda item: item.score, reverse=True)

    final_ranked_leads: list[RankedLead] = []
    for index, lead in enumerate(ranked_leads[:max_leads], start=1):
        final_ranked_leads.append(
            RankedLead(
                **lead.model_dump(exclude={"rank"}),
                rank=index,
            )
        )

    print(f"[Ranking] Ranking complete. Returning top {len(final_ranked_leads)} lead(s).")
    return final_ranked_leads
