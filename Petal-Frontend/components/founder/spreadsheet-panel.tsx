"use client";

import { Lightning, MapPin } from "phosphor-react";
import type { RankedLead } from "@/lib/warmLeadsApi";

function scoreLabel(score: number) {
  if (score >= 0.9) {
    return "Very Warm";
  }
  if (score >= 0.8) {
    return "Warm";
  }
  if (score >= 0.65) {
    return "Promising";
  }
  return "Monitor";
}

function toSectionMap(reasons: string[]) {
  const map = new Map<string, string>();
  for (const reason of reasons) {
    const [label, ...rest] = reason.split(":");
    if (rest.length > 0) {
      map.set(label.trim().toLowerCase(), rest.join(":").trim());
    }
  }
  return map;
}

export function FounderSpreadsheetPanel({
  leads,
  sheetName,
}: {
  leads: RankedLead[];
  sheetName: string;
}) {
  const topLeads = leads.slice(0, 5);
  const avgScore =
    topLeads.length > 0
      ? topLeads.reduce((sum, lead) => sum + lead.score, 0) / topLeads.length
      : 0;

  return (
    <div className="flex min-h-dvh flex-col border-l border-[#e6edf2] bg-[#f7fbfc]">
      <div className="border-b border-[#e3ecef] bg-white px-5 py-4">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[#7f95a4]">
          Warm Lead Board
        </div>
        <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-[#122130]">
          Top 5 Signals
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="border border-[#dbe8ec] bg-[#fbfefe] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#90a2af]">
              List
            </div>
            <div className="mt-1 text-[14px] font-medium text-[#1a2b3a]">{sheetName}</div>
          </div>
          <div className="border border-[#dbe8ec] bg-[#fbfefe] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#90a2af]">
              Leads Shown
            </div>
            <div className="mt-1 text-[14px] font-medium text-[#1a2b3a]">{topLeads.length} / 5</div>
          </div>
          <div className="border border-[#dbe8ec] bg-[#fbfefe] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#90a2af]">
              Avg Fit Score
            </div>
            <div className="mt-1 text-[14px] font-medium text-[#1a2b3a]">{avgScore.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-3">
          {topLeads.map((lead, index) => (
            <article
              className="border border-[#dce9ee] bg-white p-4"
              key={`${lead.company_name}-${lead.rank}-${index}`}
            >
              {(() => {
                const sectionMap = toSectionMap(lead.match_reasons);
                const whyLead =
                  sectionMap.get("why she's a lead") ??
                  sectionMap.get("why he's a lead") ??
                  lead.match_reasons[0];
                const buyingIntent =
                  sectionMap.get("buying intent") ?? lead.match_reasons[1];
                const urgency = sectionMap.get("urgency") ?? lead.match_reasons[2];
                const reachOut = sectionMap.get("reach out") ?? lead.match_reasons[3];

                return (
                  <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center border border-[#c9dce5] bg-[#f3f9fb] px-1 text-[11px] font-medium text-[#507184]">
                      #{lead.rank || index + 1}
                    </span>
                    <h3 className="truncate text-[17px] font-medium tracking-[-0.02em] text-[#1a2b3a]">
                      {lead.company_name}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[#5f7484]">
                    {lead.website ? <span>{lead.website}</span> : null}
                    {lead.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {lead.location}
                      </span>
                    ) : null}
                    {lead.industry ? <span>{lead.industry}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] text-[#6f8594]">{scoreLabel(lead.score)}</div>
                  <div className="text-[20px] font-semibold tracking-[-0.03em] text-[#0f6f68]">
                    {(lead.score * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 bg-[#e8f1f4]">
                <div
                  className="h-2 bg-[#59b4ac]"
                  style={{ width: `${Math.max(8, Math.min(100, lead.score * 100))}%` }}
                />
              </div>

              <div className="mt-3 space-y-2 text-[12px] leading-5 text-[#3b5160]">
                {whyLead ? (
                  <div className="border border-[#e3edf2] bg-[#fbfdff] px-3 py-2">
                    <div className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-[#88a0af]">
                      Why This Is A Lead
                    </div>
                    {whyLead}
                  </div>
                ) : null}
                {buyingIntent ? (
                  <div className="border border-[#e3edf2] bg-[#fbfdff] px-3 py-2">
                    <div className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-[#88a0af]">
                      Buying Intent
                    </div>
                    {buyingIntent}
                  </div>
                ) : null}
                {urgency ? (
                  <div className="border border-[#e3edf2] bg-[#fbfdff] px-3 py-2">
                    <div className="mb-0.5 text-[10px] uppercase tracking-[0.12em] text-[#88a0af]">
                      Urgency
                    </div>
                    {urgency}
                  </div>
                ) : null}
                {reachOut ? (
                  <div className="border border-[#d7e7df] bg-[#f5fcf8] px-3 py-2">
                    <div className="mb-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#5f8676]">
                      <Lightning className="size-3" />
                      Reach Out
                    </div>
                    {reachOut}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[#607585]">
                <div className="border border-[#e6edf1] bg-[#fbfdff] px-2 py-1.5">
                  <span className="text-[#8ca0ad]">Contact</span>
                  <div className="mt-0.5 text-[#263a4a]">
                    {lead.contact_person || "Not available"}
                  </div>
                </div>
                <div className="border border-[#e6edf1] bg-[#fbfdff] px-2 py-1.5">
                  <span className="text-[#8ca0ad]">Title</span>
                  <div className="mt-0.5 text-[#263a4a]">
                    {lead.contact_title || "Not available"}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </article>
          ))}

          {topLeads.length === 0 ? (
            <div className="border border-dashed border-[#d7e2e8] bg-white p-6 text-center text-[13px] text-[#7f91a0]">
              No warm leads available yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
