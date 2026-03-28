import { z } from "zod";

export const TinyfishRawLeadSchema = z
  .object({
    company_name: z.string().optional(),
    company: z.string().optional(),
    name: z.string().optional(),
    website: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    company_url: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    company_size: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    contact_person: z.string().nullable().optional(),
    contact_title: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export const TinyfishRawResultSchema = z.object({
  leads: z.array(TinyfishRawLeadSchema),
});

export const NormalizedLeadForOpenAISchema = z.object({
  company_name: z.string().min(1),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  company_size: z.string().nullable(),
  location: z.string().nullable(),
  contact_person: z.string().nullable(),
  contact_title: z.string().nullable(),
  email: z.string().nullable(),
  linkedin_url: z.string().nullable(),
});

export const OpenAIRankedLeadSchema = z.object({
  company_name: z.string().min(1),
  score: z.number().min(0).max(1),
  match_reasons: z.array(z.string()),
});

export const OpenAIRankingResultSchema = z.object({
  leads: z.array(OpenAIRankedLeadSchema),
});

export const RankedLeadSchema = z.object({
  company_name: z.string().min(1),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  company_size: z.string().nullable(),
  location: z.string().nullable(),
  contact_person: z.string().nullable(),
  contact_title: z.string().nullable(),
  email: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  score: z.number().min(0).max(1),
  match_reasons: z.array(z.string()),
  rank: z.number().int().min(1),
});

export const LeadSessionResultResponseSchema = z.object({
  session_id: z.string().min(1),
  search_intent: z.string().min(1),
  structured_icp: z.record(z.string(), z.unknown()),
  search_urls: z.array(z.string()),
  leads: z.array(RankedLeadSchema),
  spreadsheet_url: z.string().min(1),
});

export const LeadSessionQuestionSchema = z.object({
  question_id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).length(5),
});

export const StartLeadSessionResponseSchema = z.object({
  session_id: z.string().min(1),
  follow_up_questions: z.array(LeadSessionQuestionSchema).length(4),
});

export type TinyfishRawLead = z.infer<typeof TinyfishRawLeadSchema>;
export type TinyfishRawResult = z.infer<typeof TinyfishRawResultSchema>;
export type NormalizedLeadForOpenAI = z.infer<typeof NormalizedLeadForOpenAISchema>;
export type OpenAIRankedLead = z.infer<typeof OpenAIRankedLeadSchema>;
export type OpenAIRankingResult = z.infer<typeof OpenAIRankingResultSchema>;
export type RankedLead = z.infer<typeof RankedLeadSchema>;
export type LeadSessionResultResponse = z.infer<typeof LeadSessionResultResponseSchema>;
export type StartLeadSessionResponse = z.infer<typeof StartLeadSessionResponseSchema>;
