export const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ?? "http://127.0.0.1:8000";

export const workflowActionPaths = {
  start: "/workflow/start",
  answer: "/workflow/answer",
  approve: "/workflow/intents/approve",
  research: "/workflow/research",
} as const;

export type WorkflowAction = keyof typeof workflowActionPaths;

export type WorkflowOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
};

export type WorkflowQuestion = {
  id: string;
  prompt: string;
  helperText?: string;
  options: WorkflowOption[];
  allowCustomResponse?: boolean;
};

export type WorkflowSummary = {
  totalLeads?: number;
  projectedPrice?: string;
  currency?: string;
  rowCount?: number;
  columnCount?: number;
};

export type WorkflowResponse = {
  sessionId?: string;
  phase?: string;
  message?: string;
  question?: WorkflowQuestion;
  intents?: string[];
  csv?: string;
  sheetName?: string;
  secondarySheetName?: string;
  summary?: WorkflowSummary;
  raw?: Record<string, unknown>;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return (
          asString(record.label) ??
          asString(record.value) ??
          asString(record.intent) ??
          asString(record.text)
        );
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));

  return items.length > 0 ? items : undefined;
}

function normalizeOption(option: unknown, index: number): WorkflowOption | null {
  if (typeof option === "string") {
    const value = option.trim();
    return value
      ? {
          id: `option-${index + 1}`,
          label: value,
          value,
        }
      : null;
  }

  if (!option || typeof option !== "object") {
    return null;
  }

  const record = option as Record<string, unknown>;
  const label =
    asString(record.label) ??
    asString(record.text) ??
    asString(record.title) ??
    asString(record.value);

  if (!label) {
    return null;
  }

  return {
    id: asString(record.id) ?? `option-${index + 1}`,
    label,
    value: asString(record.value) ?? label,
    description:
      asString(record.description) ?? asString(record.helperText) ?? undefined,
  };
}

function normalizeQuestion(data: Record<string, unknown>): WorkflowQuestion | undefined {
  const candidate =
    (data.question as Record<string, unknown> | undefined) ?? data;
  const rawOptions =
    (candidate.options as unknown[]) ??
    (candidate.choices as unknown[]) ??
    (candidate.answers as unknown[]);
  const options = rawOptions
    ?.map((option, index) => normalizeOption(option, index))
    .filter((option): option is WorkflowOption => option !== null);

  const prompt =
    asString(candidate.prompt) ??
    asString(candidate.text) ??
    asString(candidate.question) ??
    asString(data.prompt) ??
    asString(data.message);

  if (!prompt || !options || options.length === 0) {
    return undefined;
  }

  return {
    id: asString(candidate.id) ?? asString(data.questionId) ?? "question-1",
    prompt,
    helperText:
      asString(candidate.helperText) ??
      asString(candidate.description) ??
      undefined,
    options,
    allowCustomResponse: Boolean(
      candidate.allowCustomResponse ?? candidate.allowCustom
    ),
  };
}

function normalizeSummary(data: Record<string, unknown>, csv?: string): WorkflowSummary | undefined {
  const candidate =
    (data.summary as Record<string, unknown> | undefined) ??
    (data.metrics as Record<string, unknown> | undefined) ??
    (data.meta as Record<string, unknown> | undefined);

  const totalLeads =
    Number(candidate?.totalLeads ?? candidate?.leadCount ?? candidate?.rows) ||
    undefined;
  const projectedPrice =
    asString(candidate?.projectedPrice) ?? asString(candidate?.pricePerLead);
  const currency = asString(candidate?.currency);
  const rowCount = Number(candidate?.rowCount ?? candidate?.rows) || undefined;
  const columnCount =
    Number(candidate?.columnCount ?? candidate?.columns) || undefined;

  if (totalLeads || projectedPrice || currency || rowCount || columnCount) {
    return { totalLeads, projectedPrice, currency, rowCount, columnCount };
  }

  if (!csv) {
    return undefined;
  }

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return {
    totalLeads: Math.max(lines.length - 1, 0),
    rowCount: Math.max(lines.length - 1, 0),
    columnCount: lines[0]?.split(",").length ?? 0,
  };
}

export function normalizeWorkflowResponse(payload: unknown): WorkflowResponse {
  const data =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const csv =
    asString(data.csv) ??
    asString(data.csvText) ??
    asString(data.leadsCsv) ??
    asString(data.resultCsv) ??
    asString((data.result as Record<string, unknown> | undefined)?.csv);

  const intents =
    asStringArray(data.intents) ??
    asStringArray(data.searchIntents) ??
    asStringArray(data.intentSuggestions) ??
    asStringArray((data.result as Record<string, unknown> | undefined)?.intents);

  return {
    sessionId:
      asString(data.sessionId) ??
      asString(data.workflowId) ??
      asString(data.conversationId),
    phase:
      asString(data.phase) ??
      asString(data.stage) ??
      (csv ? "completed" : intents ? "intent-review" : undefined),
    message:
      asString(data.message) ??
      asString(data.text) ??
      asString(data.response) ??
      asString(data.status),
    question: normalizeQuestion(data),
    intents,
    csv,
    sheetName:
      asString(data.sheetName) ??
      asString(data.tableName) ??
      asString(data.datasetName) ??
      "mapped_accounts",
    secondarySheetName:
      asString(data.secondarySheetName) ??
      asString(data.intentSheetName) ??
      "Search Intents",
    summary: normalizeSummary(data, csv),
    raw: data,
  };
}
