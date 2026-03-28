"use client";

export function FounderLoadingPreview({
  statusMessage,
}: {
  statusMessage?: string;
}) {
  return (
    <div className="fade-in flex h-full flex-col items-center justify-center px-10">
      <div className="mb-6 inline-flex items-center gap-2 bg-white px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#84a3a0]">
        {statusMessage?.trim() ? statusMessage : "Awaiting next steps"}
        <span className="inline-flex gap-1">
          <span className="thinking-dot inline-block size-1.5 rounded-full bg-[#85a8a5]" />
          <span
            className="thinking-dot inline-block size-1.5 rounded-full bg-[#85a8a5]"
            style={{ animationDelay: "180ms" }}
          />
          <span
            className="thinking-dot inline-block size-1.5 rounded-full bg-[#85a8a5]"
            style={{ animationDelay: "360ms" }}
          />
        </span>
      </div>
      <div className="w-full max-w-[520px] bg-white p-5">
        <div className="mb-4 flex items-center justify-between text-[11px] text-[#a3afba]">
          <span>leads</span>
          <span>20 rows running</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              className="grid grid-cols-[48px_1fr_1fr_96px] gap-2"
              key={`loading-row-${index + 1}`}
            >
              <div className="shimmer h-7 bg-[#f3f6fa]" />
              <div className="shimmer h-7 bg-[#f3f6fa]" />
              <div className="shimmer h-7 bg-[#f3f6fa]" />
              <div className="shimmer h-7 bg-[#e4f4f1]" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 max-w-[440px] text-center">
        <div className="text-[28px] font-semibold tracking-[-0.05em] text-[#1b2430]">
          Building your lead sheet
        </div>
        <p className="mt-2 text-[14px] leading-6 text-[#97a4b0]">
          The backend is refining ICP inputs, generating search intents, and
          preparing rows for the spreadsheet.
        </p>
      </div>
    </div>
  );
}
