"use client";

import type { RefObject } from "react";
import type { WorkflowQuestion } from "@/lib/founder-workflow";
import { FounderComposer } from "./composer";
import { FounderQuestionPanel } from "./question-panel";
import type { FounderMessage } from "./types";

function MessageBubble({ message }: { message: FounderMessage }) {
  if (message.role === "user") {
    return (
      <div className="message-fade-in ml-auto max-w-[78%]">
        <div className="bg-[#dfeeed] px-4 py-3 text-[13px] leading-6 text-[#163c3b] transition-colors duration-200 hover:bg-[#d6e9e7]">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.kind === "json") {
    return (
      <div className="message-fade-in max-w-[86%] bg-[#f8fbfd] px-3 py-2 text-[13px] leading-6 text-[#50606f]">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#6f948f]">
          {message.title}
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-[#4c5967]">
          {JSON.stringify(message.value, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="message-fade-in max-w-[86%] bg-[#f8fbfd] px-3 py-2 text-[13px] leading-7 text-[#50606f]">
      {message.text}
    </div>
  );
}

export function FounderChatScreen({
  messages,
  error,
  draftInput,
  isSubmitting,
  pendingQuestion,
  messagesContainerRef,
  onDraftChange,
  onSubmit,
  onCancel,
  onQuestionSelect,
  composerPlaceholder,
  centeredLayout = false,
  composerMaxWidthClass,
  loadingMessage,
}: {
  messages: FounderMessage[];
  error: string | null;
  draftInput: string;
  isSubmitting: boolean;
  pendingQuestion?: WorkflowQuestion | null;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  onDraftChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onQuestionSelect?: (optionId: string, value: string) => void;
  composerPlaceholder?: string;
  centeredLayout?: boolean;
  composerMaxWidthClass?: string;
  loadingMessage?: string | null;
}) {
  const contentWrapClass = centeredLayout
    ? "mx-auto w-full max-w-[700px]"
    : "w-full";

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-[#fbfdfe]">
      <div className="px-6 py-6">
        <div className={contentWrapClass}>
          <div className="px-1 text-[12px] font-medium tracking-[-0.01em] text-[#95a3af]">
            New Workspace
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-6"
        ref={messagesContainerRef as RefObject<HTMLDivElement>}
      >
        <div className={contentWrapClass}>
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {loadingMessage ? (
              <div className="message-fade-in max-w-[86%] bg-[#f8fbfd] px-3 py-2 text-[13px] leading-6 text-[#50606f]">
                <span>{loadingMessage}</span>
                <span className="ml-2 inline-flex gap-1 align-middle">
                  <span
                    className="thinking-dot inline-block size-1.5 rounded-full bg-[#9aabb8]"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="thinking-dot inline-block size-1.5 rounded-full bg-[#9aabb8]"
                    style={{ animationDelay: "180ms" }}
                  />
                  <span
                    className="thinking-dot inline-block size-1.5 rounded-full bg-[#9aabb8]"
                    style={{ animationDelay: "360ms" }}
                  />
                </span>
              </div>
            ) : null}
            {error ? (
              <div className="bg-[#fff2f1] px-4 py-3 text-[12px] text-[#912d2d]">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 pb-6">
        <div className={contentWrapClass}>
          {pendingQuestion && onQuestionSelect ? (
            <FounderQuestionPanel
              isSubmitting={isSubmitting}
              onSelect={onQuestionSelect}
              question={pendingQuestion}
            />
          ) : null}

          <div className={centeredLayout ? "w-full" : "flex w-full justify-center"}>
            <FounderComposer
              draftInput={draftInput}
              isSubmitting={isSubmitting}
              maxWidthClass={composerMaxWidthClass ?? "max-w-[460px]"}
              minHeightClass="min-h-10"
              onCancel={onCancel}
              onChange={onDraftChange}
              onSubmit={onSubmit}
              placeholder={composerPlaceholder ?? "Describe your ICP and run lead discovery..."}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
