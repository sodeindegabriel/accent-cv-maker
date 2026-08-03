import { createServerFn } from "@tanstack/react-start";

// All 21 supported languages — must match the build flow language list.
const SUPPORTED_LANGUAGES = [
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
  { code: "pt", name: "Portuguese" },
  { code: "es", name: "Spanish" },
  { code: "ar", name: "Arabic" },
  { code: "bn", name: "Bengali" },
  { code: "gu", name: "Gujarati" },
  { code: "fr", name: "French" },
  { code: "tr", name: "Turkish" },
  { code: "hi", name: "Hindi" },
  { code: "so", name: "Somali" },
  { code: "zh", name: "Mandarin Chinese" },
  { code: "fa", name: "Persian (Farsi)" },
  { code: "uk", name: "Ukrainian" },
  { code: "ku", name: "Kurdish (Kurmanji)" },
  { code: "ta", name: "Tamil" },
  { code: "am", name: "Amharic" },
  { code: "ti", name: "Tigrinya" },
];

export const generateJobTranslationsServer = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string }) => data)
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const apiKey = process.env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");

    const langList = SUPPORTED_LANGUAGES.map((l) => `${l.code} (${l.name})`).join(", ");

    const prompt = `Translate the UK job category label "${data.title}" into each of the following languages. These are short job type labels used in a CV-building app (2–6 words maximum each).

Languages: ${langList}

Return ONLY a valid JSON object with language codes as keys and translated labels as values. No explanation, no code fences, no other text.

Example format: {"pl": "...", "ro": "...", "pa": "...", ...}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const result = await response.json() as { content: { type: string; text: string }[] };
    const raw: string = result?.content?.[0]?.text ?? "{}";

    // Strip accidental code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    try {
      return JSON.parse(cleaned) as Record<string, string>;
    } catch {
      throw new Error(`Failed to parse translation response: ${raw.slice(0, 200)}`);
    }
  });
