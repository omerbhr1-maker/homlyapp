export type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export function extractOutputText(data: OpenAIResponsesPayload) {
  return (
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .find((part) => part.type === "output_text" || part.type === "text")
      ?.text ||
    ""
  );
}
