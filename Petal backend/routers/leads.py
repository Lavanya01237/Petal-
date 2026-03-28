from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from models.schemas import (
    FollowUpAnswerItem,
    FollowUpQuestion,
    LeadSessionResultResponse,
    StartLeadSessionRequest,
    StartLeadSessionResponse,
    SubmitLeadSessionAnswersRequest,
)
from services.llm_service import generate_follow_up_questions, generate_search_intent, parse_icp
from services.ranking_service import rank_leads
from services.session_service import create_session, get_session, set_answers, set_result
from services.spreadsheet_service import build_ranked_leads_csv
from services.tinyfish_service import collect_leads


router = APIRouter(prefix="/api", tags=["leads"])


def _build_spreadsheet_url(session_id: str) -> str:
    return f"/api/lead-session/{session_id}/spreadsheet.csv"


def _to_follow_up_questions(raw_questions: list[str]) -> list[FollowUpQuestion]:
    return [
        FollowUpQuestion(
            question_id=f"q{index + 1}",
            question=question,
        )
        for index, question in enumerate(raw_questions)
    ]


def _normalize_answers_payload(
    request: SubmitLeadSessionAnswersRequest, questions: list[FollowUpQuestion]
) -> dict[str, str]:
    if not request.answers:
        return {}

    question_ids = [question.question_id for question in questions]
    question_set = set(question_ids)
    normalized: dict[str, str] = {}

    positional_answers: list[str] = []
    for item in request.answers:
        if isinstance(item, str):
            cleaned = item.strip()
            if cleaned:
                positional_answers.append(cleaned)
            continue

        if isinstance(item, FollowUpAnswerItem):
            cleaned = item.answer.strip()
            if not cleaned:
                continue
            if item.question_id and item.question_id in question_set:
                normalized[item.question_id] = cleaned
            else:
                positional_answers.append(cleaned)

    for index, answer in enumerate(positional_answers):
        if index >= len(question_ids):
            break
        normalized.setdefault(question_ids[index], answer)
    return normalized


@router.post("/lead-session/start")
async def start_lead_session(request: StartLeadSessionRequest):
    print("[API] Starting lead discovery session.")
    try:
        follow_up_questions = await generate_follow_up_questions(
            request.early_customer, request.product_description
        )
        typed_questions = _to_follow_up_questions(follow_up_questions)
        session = create_session(
            early_customer=request.early_customer,
            product_description=request.product_description,
            follow_up_questions=typed_questions,
            max_leads=request.max_leads,
        )
        return JSONResponse(
            content=StartLeadSessionResponse(
                session_id=session.session_id,
                follow_up_questions=session.follow_up_questions,
            ).model_dump()
        )
    except Exception as exc:
        print(f"[API] Failed to start session: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/lead-session/{session_id}/submit")
async def submit_lead_session_answers(session_id: str, request: SubmitLeadSessionAnswersRequest):
    print(f"[API] Submitting answers for session={session_id}.")
    try:
        session = get_session(session_id)
        mapped_answers = _normalize_answers_payload(request, session.follow_up_questions)
        if not mapped_answers:
            raise HTTPException(
                status_code=422,
                detail="No valid follow-up answers were provided.",
            )
        session = set_answers(session_id, mapped_answers)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    try:
        paired_qa: list[dict[str, str]] = []
        for question in session.follow_up_questions:
            cleaned_answer = session.follow_up_answers.get(question.question_id, "").strip()
            if not cleaned_answer:
                continue
            paired_qa.append(
                {
                    "question": question.question,
                    "answer": cleaned_answer,
                }
            )

        search_intent = await generate_search_intent(
            early_customer=session.early_customer,
            product_description=session.product_description,
            follow_up_qa=paired_qa,
        )

        raw_icp = (
            "Early customer:\n"
            f"{session.early_customer}\n\n"
            "Product:\n"
            f"{session.product_description}\n\n"
            "Discovery answers:\n"
            + "\n".join(
                f"- {item['question']} -> {item['answer']}"
                for item in paired_qa
            )
            + "\n\n"
            "Search intent:\n"
            f"{search_intent}"
        )

        icp_result = await parse_icp(raw_icp)
        raw_leads = await collect_leads(
            icp_result.search_urls,
            icp_result.tinyfish_goal,
            desired_leads=session.max_leads,
        )
        ranked_leads = await rank_leads(
            raw_icp=raw_icp,
            structured_icp=icp_result.structured_icp,
            leads=raw_leads,
            max_leads=session.max_leads,
        )

        csv_data = build_ranked_leads_csv(ranked_leads)
        session = set_result(
            session_id=session_id,
            search_intent=search_intent,
            structured_icp=icp_result.structured_icp,
            search_urls=icp_result.search_urls,
            ranked_leads=ranked_leads,
            spreadsheet_csv=csv_data,
        )
        print(f"[API] Session={session_id} completed with {len(ranked_leads)} ranked leads.")

        return JSONResponse(
            content=LeadSessionResultResponse(
                session_id=session.session_id,
                search_intent=session.search_intent or "",
                structured_icp=session.structured_icp,
                search_urls=session.search_urls,
                leads=session.leads,
                spreadsheet_url=_build_spreadsheet_url(session.session_id),
            ).model_dump()
        )
    except Exception as exc:
        print(f"[API] Session={session_id} failed while processing answers: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/lead-session/{session_id}/spreadsheet.csv")
async def download_spreadsheet(session_id: str):
    print(f"[API] Downloading spreadsheet for session={session_id}.")
    try:
        session = get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found.") from None

    if not session.spreadsheet_csv:
        raise HTTPException(
            status_code=409,
            detail="Spreadsheet is not ready yet. Submit follow-up answers first.",
        )

    return Response(
        content=session.spreadsheet_csv,
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="warm-leads-{session.session_id}.csv"'
            )
        },
    )
