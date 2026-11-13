/** Compact JSON Schema subset used by Gemini structured output. */
export const LEARNING_ANALYZER_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    objectives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: {
            type: "string",
            description: "Satu tujuan pembelajaran yang jelas, berpusat pada kemampuan siswa, dan dapat diamati.",
          },
          basis: {
            type: "string",
            enum: ["explicit", "inferred"],
            description: "explicit bila dinyatakan langsung; inferred bila disimpulkan secara konservatif dari materi.",
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_id: { type: "string" },
                quote: {
                  type: "string",
                  description: "Kutipan verbatim dari sumber yang diberikan, bukan parafrasa.",
                },
              },
              required: ["source_id", "quote"],
              additionalProperties: false,
            },
          },
        },
        required: ["statement", "basis", "evidence"],
        additionalProperties: false,
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["objectives", "warnings"],
  additionalProperties: false,
};
