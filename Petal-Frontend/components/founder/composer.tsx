"use client";

import { ArrowUp, CircleNotch } from "phosphor-react";
import type { FormEvent } from "react";

const composerClass =
  "w-full border border-[#d9e1e8] bg-white p-2 transition-all duration-200 ease-out focus-within:border-[#b8ccd8] focus-within:bg-[#fcfeff]";

type FounderComposerProps = {
  draftInput: string;
  isSubmitting: boolean;
  maxWidthClass?: string;
  minHeightClass?: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function FounderComposer({
  draftInput,
  isSubmitting,
  maxWidthClass = "max-w-[620px]",
  minHeightClass = "min-h-12",
  placeholder,
  onChange,
  onCancel,
  onSubmit,
}: FounderComposerProps) {
  return (
    <form className={`${maxWidthClass} ${composerClass}`} onSubmit={onSubmit}>
      <textarea
        className={`${minHeightClass} w-full resize-none border-0 bg-transparent px-2 py-0.5 text-[13px] leading-5 text-[#1b2430] outline-none placeholder:text-[#a6b1bc]`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={draftInput}
      />
      <div className="flex items-center justify-between px-1 pt-0.5">
        <div className="text-[12px] text-[#a3aeb9]">
          {isSubmitting && onCancel ? (
            <button
              className="text-[#6e7d8b] transition-colors hover:text-[#3f4b58]"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          ) : (
            "Lite"
          )}
        </div>
        <button
          className="flex size-7 items-center justify-center rounded-[3px] border border-[#bcd8d4] bg-[#e0f2ef] text-[#11776f] transition-colors hover:bg-[#d4ebe7] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || !draftInput.trim()}
          type="submit"
        >
          {isSubmitting ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" weight="bold" />
          )}
        </button>
      </div>
    </form>
  );
}
