# Warm Leads Backend

FastAPI backend for a chat-driven warm leads pipeline:

1. User provides:
   - who the early customer is
   - what the product does
2. OpenAI generates the best follow-up discovery questions.
3. User submits answers to those follow-up questions.
4. Backend generates final search intent, runs TinyFish collection, ranks leads, and produces a spreadsheet-ready CSV.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
```

Required environment variables:

```env
OPENAI_API_KEY=your_key_here
TINYFISH_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

Recommended production variables:

```env
REDIS_URL=redis://localhost:6379/0
SESSION_TTL_SECONDS=86400
TINYFISH_RETRY_ATTEMPTS=2
TINYFISH_RETRY_BACKOFF_SECONDS=2.0
```

## Run

From `/Users/lavanyasharma/Documents/New project/Petal backend`:

```bash
uvicorn main:app --reload
```

## Endpoints

### `GET /`

Health check:

```json
{ "status": "running" }
```

### `POST /api/lead-session/start`

Starts a backend-owned session and returns AI-generated follow-up questions.

Request:

```json
{
  "early_customer": "B2B SaaS support teams in North America",
  "product_description": "AI assistant that reduces ticket resolution time",
  "max_leads": 10
}
```

Response:

```json
{
  "session_id": "uuid",
  "follow_up_questions": [
    {
      "question_id": "q1",
      "question": "Which company size range should we prioritize first?"
    },
    {
      "question_id": "q2",
      "question": "Which buyer title is most important to target?"
    }
  ]
}
```

### `POST /api/lead-session/{session_id}/submit`

Submits follow-up answers and runs the full lead pipeline.

Request:

```json
{
  "answers": [
    { "question_id": "q1", "answer": "50-500 employees" },
    { "question_id": "q2", "answer": "VP Customer Success" }
  ]
}
```

Backward-compatible payload is also accepted (positional mapping):

```json
{
  "answers": [
    "50-500 employees",
    "VP Customer Success"
  ]
}
```

Response:

```json
{
  "session_id": "uuid",
  "search_intent": "...",
  "structured_icp": {},
  "search_urls": [],
  "leads": [],
  "spreadsheet_url": "/api/lead-session/uuid/spreadsheet.csv"
}
```

### `GET /api/lead-session/{session_id}/spreadsheet.csv`

Downloads ranked warm leads as CSV.

## Notes

- OpenAI Structured Outputs are used for:
  - generating follow-up discovery questions
  - generating final search intent
  - ranking leads
- TinyFish SSE is parsed via `requests.post(..., stream=True)` and `response.iter_lines()`.
- Sessions are stored in Redis when `REDIS_URL` is configured; otherwise backend falls back to in-memory storage.
- Session data expires automatically based on `SESSION_TTL_SECONDS`.
- TinyFish source attempts include retry + exponential backoff for transient failures.
