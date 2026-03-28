import {
  LeadSessionResultResponseSchema,
  StartLeadSessionResponseSchema,
  type LeadSessionResultResponse,
  type RankedLead,
  type StartLeadSessionResponse,
} from "./leadSchemas";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://127.0.0.1:8000";

export type { LeadSessionResultResponse, RankedLead, StartLeadSessionResponse };

export type StartLeadSessionRequest = {
  early_customer: string;
  product_description: string;
  max_leads?: number;
};

export type SubmitLeadSessionAnswersRequest = {
  answers: Array<{
    question_id: string;
    answer: string;
  }>;
};

type ApiErrorShape = { detail?: string };

async function parseJsonOrThrow<T>(
  res: Response,
  parser: (value: unknown) => T
): Promise<T> {
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (body as ApiErrorShape)?.detail?.trim() || `Request failed (${res.status})`;
    throw new Error(message);
  }

  try {
    return parser(body);
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Invalid response payload: ${error.message}` : "Invalid response payload."
    );
  }
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/`);
  return parseJsonOrThrow(res, (value) => {
    const parsed = value as { status?: unknown };
    if (typeof parsed?.status !== "string" || parsed.status.length === 0) {
      throw new Error("Health check payload missing `status`.");
    }
    return { status: parsed.status };
  });
}

export async function startLeadSession(
  payload: StartLeadSessionRequest,
  signal?: AbortSignal
): Promise<StartLeadSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/lead-session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  return parseJsonOrThrow(res, (value) => StartLeadSessionResponseSchema.parse(value));
}

export async function submitLeadSessionAnswers(
  sessionId: string,
  payload: SubmitLeadSessionAnswersRequest,
  signal?: AbortSignal
): Promise<LeadSessionResultResponse> {
  const res = await fetch(`${API_BASE_URL}/api/lead-session/${sessionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  return parseJsonOrThrow(res, (value) => LeadSessionResultResponseSchema.parse(value));
}

export function getSpreadsheetDownloadUrl(
  spreadsheetUrlOrSessionId: string
): string {
  if (spreadsheetUrlOrSessionId.startsWith("/api/")) {
    return `${API_BASE_URL}${spreadsheetUrlOrSessionId}`;
  }
  return `${API_BASE_URL}/api/lead-session/${spreadsheetUrlOrSessionId}/spreadsheet.csv`;
}
