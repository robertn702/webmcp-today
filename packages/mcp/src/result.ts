export interface TextResult {
  content: { type: "text"; text: string }[];
  [key: string]: unknown;
}

export function jsonResult(value: unknown): TextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}
