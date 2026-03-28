"use client";

import { Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  getSpreadsheetDownloadUrl,
  type LeadSessionResultResponse,
  type RankedLead,
  type StartLeadSessionResponse,
  startLeadSession,
  submitLeadSessionAnswers,
} from "@/lib/warmLeadsApi";
import type { WorkflowQuestion } from "@/lib/founder-workflow";
import { FounderChatScreen } from "./chat-screen";
import { FounderComposer } from "./composer";
import { FounderLoadingPreview } from "./loading-preview";
import { FounderSidebar } from "./sidebar";
import { FounderSpreadsheetPanel } from "./spreadsheet-panel";
import type { FounderMessage, SheetData } from "./types";

const EMPTY_COLUMN_COUNT = 6;
const EMPTY_ROW_COUNT = 18;

type FlowStage = "intake" | "qualifying" | "researching" | "results";
type IntakeStep = "product" | "ideal-customer" | "done";

let idCounter = 0;

function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function leadsToSheetData(leads: RankedLead[]): SheetData {
  const rows: Record<string, string>[] = leads.map((lead) => ({
    "Company Name": lead.company_name,
    Website: lead.website ?? "",
    Industry: lead.industry ?? "",
    "Company Size": lead.company_size ?? "",
    Location: lead.location ?? "",
    "Contact Person": lead.contact_person ?? "",
    "Contact Title": lead.contact_title ?? "",
    Email: lead.email ?? "",
    "LinkedIn URL": lead.linkedin_url ?? "",
    Score: lead.score.toFixed(2),
    Rank: String(lead.rank),
    "Match Reasons": lead.match_reasons.join(" | "),
  }));

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const dataRows = rows.map((row) => headers.map((header) => row[header] ?? ""));
  return { headers, rows: dataRows };
}

export function FounderWorkbench() {
  const [stage, setStage] = useState<FlowStage>("intake");
  const [intakeStep, setIntakeStep] = useState<IntakeStep>("product");
  const [messages, setMessages] = useState<FounderMessage[]>([]);
  const [idealCustomer, setIdealCustomer] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [draftInput, setDraftInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<
    StartLeadSessionResponse["follow_up_questions"]
  >([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Array<{ question_id: string; answer: string }>
  >([]);
  const [pendingQuestion, setPendingQuestion] = useState<WorkflowQuestion | null>(
    null
  );
  const [customAnswerQuestionId, setCustomAnswerQuestionId] = useState<string | null>(
    null
  );
  const [leads, setLeads] = useState<RankedLead[]>([]);
  const [pipelineStatusMessage, setPipelineStatusMessage] = useState<string>("");
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [spreadsheetDownloadUrl, setSpreadsheetDownloadUrl] = useState<string | null>(
    null
  );
  const [sheetName] = useState("mapped_accounts");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sheetData = useMemo(() => leadsToSheetData(leads), [leads]);

  const gridHeaders = useMemo(() => {
    if (sheetData.headers.length > 0) {
      return sheetData.headers;
    }
    return Array.from({ length: EMPTY_COLUMN_COUNT }, (_, index) =>
      String.fromCharCode(65 + index)
    );
  }, [sheetData.headers]);

  const gridColumns = useMemo(() => {
    const rowNumberColumn = {
      key: "__rowNumber__",
      name: "",
      width: 44,
      frozen: true,
      resizable: false,
      sortable: false,
      renderCell: ({ row }: { row: Record<string, string | number> }) =>
        row.__rowNumber__,
      headerCellClass: "bg-[#f7fafc] text-[#a2afba]",
      cellClass: "bg-[#f8fbfd] text-[#a2afba]",
    };

    const dataColumns = gridHeaders.map((header, index) => ({
      key: `col-${index}`,
      name: header,
      width: 168,
      resizable: true,
      sortable: false,
      headerCellClass: "bg-[#f7fafc] text-[#566575]",
      cellClass: "bg-white text-[#43505f]",
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [gridHeaders]);

  const gridRows = useMemo(() => {
    if (sheetData.rows.length > 0) {
      return sheetData.rows.map((row, rowIndex) => {
        const result: Record<string, string | number> = {
          id: rowIndex,
          __rowNumber__: rowIndex + 1,
        };
        gridHeaders.forEach((_, colIndex) => {
          result[`col-${colIndex}`] = row[colIndex] ?? "";
        });
        return result;
      });
    }

    return Array.from({ length: EMPTY_ROW_COUNT }, (_, rowIndex) => {
      const result: Record<string, string | number> = {
        id: rowIndex,
        __rowNumber__: rowIndex + 1,
      };
      gridHeaders.forEach((_, colIndex) => {
        result[`col-${colIndex}`] = "";
      });
      return result;
    });
  }, [gridHeaders, sheetData.rows]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isSubmitting]);

  function appendAssistantText(text: string) {
    if (!text.trim()) {
      return;
    }
    setMessages((current) => [
      ...current,
      { id: createId("assistant"), role: "assistant", kind: "text", text },
    ]);
  }

  function appendUserText(text: string) {
    setMessages((current) => [
      ...current,
      { id: createId("user"), role: "user", kind: "text", text },
    ]);
  }

  function toWorkflowQuestion(
    question: StartLeadSessionResponse["follow_up_questions"][number]
  ): WorkflowQuestion {
    return {
      id: question.question_id,
      prompt: question.question,
      helperText: "This changes the sourcing strategy and rank order.",
      options: question.options.map((option, index) => ({
        id: `${question.question_id}-${index + 1}`,
        label: option,
        value: option,
      })),
      allowCustomResponse: question.options.some((option) =>
        option.trim().toLowerCase().startsWith("other")
      ),
    };
  }

  function showFollowUpQuestion(
    index: number,
    sourceQuestions?: StartLeadSessionResponse["follow_up_questions"]
  ) {
    const questions = sourceQuestions ?? followUpQuestions;
    const nextQuestion = questions[index];
    if (!nextQuestion) {
      setPendingQuestion(null);
      return;
    }
    appendAssistantText(nextQuestion.question);
    setPendingQuestion(toWorkflowQuestion(nextQuestion));
  }

  async function runStartSession(ideal: string, business: string) {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await startLeadSession(
      {
        early_customer: ideal,
        product_description: business,
      },
      controller.signal
    );

    return response;
  }

  async function runSubmitAnswers(
    activeSessionId: string,
    answers: Array<{ question_id: string; answer: string }>
  ): Promise<LeadSessionResultResponse> {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    return submitLeadSessionAnswers(
      activeSessionId,
      {
        answers,
      },
      controller.signal
    );
  }

  async function beginSession(ideal: string, business: string) {
    setIsSubmitting(true);
    setError(null);
    setLoadingMessage("Generating follow-up questions");

    try {
      const started = await runStartSession(ideal, business);
      const normalizedFollowUps = (started.follow_up_questions ?? []).slice(0, 4);

      const hasInvalidOptions = normalizedFollowUps.some(
        (item) =>
          !Array.isArray(item.options) ||
          item.options.length !== 5 ||
          !item.options[4]?.trim().toLowerCase().startsWith("other")
      );

      if (normalizedFollowUps.length !== 4 || hasInvalidOptions) {
        throw new Error(
          "Backend follow_up_questions contract mismatch. Expected 4 questions with 5 options each and Other as the last option."
        );
      }

      setSessionId(started.session_id);
      setFollowUpQuestions(normalizedFollowUps);
      setFollowUpAnswers([]);
      setCustomAnswerQuestionId(null);

      showFollowUpQuestion(0, normalizedFollowUps);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to start lead session."
      );
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
      abortControllerRef.current = null;
    }
  }

  async function beginResearch(
    activeSessionId: string,
    answers: Array<{ question_id: string; answer: string }>
  ) {
    setIsSubmitting(true);
    setError(null);
    setLoadingMessage("Ranking warm leads");
    setStage("researching");
    setLeads([]);
    setPipelineStatusMessage("Building your lead sheet");

    try {
      const result = await runSubmitAnswers(activeSessionId, answers);
      setLeads(result.leads ?? []);
      setSpreadsheetDownloadUrl(
        getSpreadsheetDownloadUrl(result.spreadsheet_url || result.session_id)
      );

      appendAssistantText(
        `Done. Found ${(result.leads ?? []).length} warm leads with ranked signals.`
      );
      setStage("results");
    } catch (submissionError) {
      if (
        submissionError instanceof Error &&
        submissionError.name === "AbortError"
      ) {
        appendAssistantText("Lead search cancelled.");
      } else {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Lead research failed."
        );
      }
      setStage("qualifying");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage(null);
      abortControllerRef.current = null;
    }
  }

  function cancelInFlightRequest() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  function handleQuestionSelect(_optionId: string, value: string) {
    if (!pendingQuestion) {
      return;
    }

    const activeQuestionId = pendingQuestion.id;
    setError(null);

    if (value.trim().toLowerCase().startsWith("other")) {
      appendUserText(value);
      appendAssistantText("Please specify your answer.");
      setCustomAnswerQuestionId(activeQuestionId);
      setPendingQuestion(null);
      return;
    }

    appendUserText(value);
    setPendingQuestion(null);
    setCustomAnswerQuestionId(null);

    const nextAnswers = [...followUpAnswers, { question_id: activeQuestionId, answer: value }];
    setFollowUpAnswers(nextAnswers);

    const nextIndex = nextAnswers.length;
    if (nextIndex < followUpQuestions.length) {
      showFollowUpQuestion(nextIndex);
      return;
    }

    if (!sessionId) {
      setError("Missing session id from backend.");
      return;
    }

    void beginResearch(sessionId, nextAnswers);
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !draftInput.trim()) {
      return;
    }

    const submitted = draftInput.trim();
    setDraftInput("");
    setError(null);

    if (stage === "qualifying" && intakeStep === "ideal-customer") {
      appendUserText(submitted);
      setIdealCustomer(submitted);
      setIntakeStep("done");
      void beginSession(submitted, businessDescription);
      return;
    }

    if (stage === "qualifying" && customAnswerQuestionId) {
      appendUserText(submitted);
      const nextAnswers = [
        ...followUpAnswers,
        { question_id: customAnswerQuestionId, answer: submitted },
      ];
      setFollowUpAnswers(nextAnswers);
      setCustomAnswerQuestionId(null);

      const nextIndex = nextAnswers.length;
      if (nextIndex < followUpQuestions.length) {
        showFollowUpQuestion(nextIndex);
        return;
      }

      if (!sessionId) {
        setError("Missing session id from backend.");
        return;
      }

      void beginResearch(sessionId, nextAnswers);
      return;
    }

    if (stage === "qualifying" && pendingQuestion) {
      setError("Pick one option or choose Other and type your response.");
      return;
    }

    appendUserText(submitted);
  }

  function startProductIntake() {
    if (!draftInput.trim() || isSubmitting) {
      return;
    }

    const productAnswer = draftInput.trim();
    setDraftInput("");
    setError(null);
    setBusinessDescription(productAnswer);
    setStage("qualifying");
    setIntakeStep("ideal-customer");
    setMessages([
      {
        id: createId("assistant"),
        role: "assistant",
        kind: "text",
        text: "What does your product do?",
      },
      {
        id: createId("user"),
        role: "user",
        kind: "text",
        text: productAnswer,
      },
      {
        id: createId("assistant"),
        role: "assistant",
        kind: "text",
        text: "Who do you think your ideal customer is? (Don’t worry, this can be rough.)",
      },
    ]);
  }

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const shouldShowSplitPanel = stage === "researching" || stage === "results";
  const showProductIntake = stage === "intake" && intakeStep === "product";

  if (showProductIntake) {
    return (
      <main className="flex h-dvh overflow-hidden bg-[#fcfeff] text-[#1b2430]">
        <FounderSidebar />
        <section className="flex h-full min-h-0 flex-1 overflow-hidden">
          <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden px-8 py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,178,168,0.08),transparent_54%)]" />
            <div className="absolute inset-x-[26%] top-[18%] h-[280px] bg-[rgba(52,178,168,0.05)] blur-3xl" />
            <div className="relative z-10 w-full max-w-[920px]">
              <div className="text-center fade-in">
                <div className="mb-5 inline-flex items-center text-[#5e9892]">
                  <Sparkles className="size-3.5" />
                </div>
                <h1 className="text-[42px] font-semibold tracking-[-0.06em] text-[#1b2430]">
                  What does your product do?
                </h1>
              </div>

              <div className="mx-auto mt-8 w-full max-w-[700px]">
                <FounderComposer
                  draftInput={draftInput}
                  isSubmitting={isSubmitting}
                  maxWidthClass="max-w-full"
                  minHeightClass="min-h-14"
                  onChange={setDraftInput}
                  onSubmit={(event) => {
                    event.preventDefault();
                    startProductIntake();
                  }}
                  placeholder="Describe your product, value proposition, and core use-case."
                />
              </div>

              {error ? (
                <div className="mx-auto mt-4 max-w-[700px] bg-[#fff2f1] px-4 py-3 text-[12px] text-[#912d2d]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#fcfeff] text-[#1b2430]">
      <FounderSidebar />

      <section
        className={
          shouldShowSplitPanel
            ? "grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(560px,54%)_minmax(0,46%)]"
            : "flex h-full min-h-0 flex-1 overflow-hidden"
        }
      >
        <FounderChatScreen
          centeredLayout={!shouldShowSplitPanel}
          composerMaxWidthClass={
            shouldShowSplitPanel ? "max-w-[460px]" : "max-w-[700px]"
          }
          draftInput={draftInput}
          error={error}
          isSubmitting={isSubmitting}
          loadingMessage={loadingMessage}
          messages={messages}
          messagesContainerRef={messagesContainerRef}
          onCancel={cancelInFlightRequest}
          onDraftChange={setDraftInput}
          onQuestionSelect={handleQuestionSelect}
          onSubmit={handleChatSubmit}
          pendingQuestion={pendingQuestion}
          composerPlaceholder={
            customAnswerQuestionId
              ? "Type your custom answer..."
              : pendingQuestion
                ? "Select an option..."
                : "Type your answer..."
          }
        />

        {shouldShowSplitPanel
          ? stage === "researching"
            ? (
              <FounderLoadingPreview statusMessage={pipelineStatusMessage} />
            )
            : (
              <FounderSpreadsheetPanel
                leads={leads}
                sheetName={sheetName}
              />
            )
          : null}
      </section>

      {stage === "results" && spreadsheetDownloadUrl ? (
        <a
          className="fixed bottom-5 right-5 border border-[#bcd8d4] bg-[#e0f2ef] px-3 py-2 text-[12px] font-medium text-[#11776f] transition-colors hover:bg-[#d4ebe7]"
          href={spreadsheetDownloadUrl}
          rel="noreferrer"
          target="_blank"
        >
          Download CSV
        </a>
      ) : null}
    </main>
  );
}
