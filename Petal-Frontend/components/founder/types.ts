export type FounderMessage =
  | {
      id: string;
      role: "assistant" | "user";
      kind: "text";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "json";
      title: string;
      value: unknown;
    };

export type SheetData = {
  headers: string[];
  rows: string[][];
};
