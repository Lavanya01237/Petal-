"use client";

import type { WorkflowQuestion } from "@/lib/founder-workflow";

export function FounderQuestionPanel({
  question,
  isSubmitting,
  onSelect,
}: {
  question: WorkflowQuestion;
  isSubmitting: boolean;
  onSelect: (optionId: string, value: string) => void;
}) {
  return (
    <div className="fade-up mb-4 px-1">
      <div className="border border-[#d9e1e8] bg-white p-4 transition-colors duration-200 hover:bg-[#fcfeff]">
        <div className="text-[18px] font-medium tracking-[-0.02em] text-[#1b2430]">
          {question.prompt}
        </div>
        {question.helperText ? (
          <div className="mt-2 text-[12px] leading-5 text-[#97a4b0]">
            {question.helperText}
          </div>
        ) : null}
        {question.options.length > 0 ? (
          <div className="mt-4 divide-y divide-[#edf2f6] border border-[#edf2f6] bg-[#fcfeff]">
            {question.options.map((option) => (
              <button
                className="flex w-full items-start justify-between gap-4 px-3 py-2.5 text-left text-[13px] text-[#485665] transition-colors hover:bg-[#f5f9fb] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                key={option.id}
                onClick={() => onSelect(option.id, option.value)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block text-[#1b2430]">{option.label}</span>
                  {option.description ? (
                    <span className="mt-1 block text-[12px] leading-5 text-[#9aa7b4]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[#6f948f]">+</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
