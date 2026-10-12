import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

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

export interface TranslationResult {
  canonicalTitle: string;
  translations: Record<string, string>;
}

export const generateJobTranslationsServer = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; sourceLanguage?: string; accessToken: string }) => data)
  .handler(async ({ data }): Promise<TranslationResult> => {
    // Verify caller is admin before touching the API key
    const supabaseUrl = process.env["VITE_SUPABASE_URL"];
    const supabaseAnonKey = process.env["VITE_SUPABASE_ANON_KEY"];
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env vars missing");

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: adminCheck, error: adminErr } = await sb.rpc("is_admin");
    if (adminErr || !adminCheck) throw new Error("Forbidden: admin only");

    const apiKey = process.env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");

    const langList = SUPPORTED_LANGUAGES.map((l) => `${l.code} (${l.name})`).join(", ");
    const sourceLangNote = data.sourceLanguage
      ? ` The user typed this in ${data.sourceLanguage}, so it may not be in English.`
      : "";

    const prompt = `You are helping manage a multilingual UK CV-building app.

The admin wants to approve a user-submitted job category label: "${data.title}".${sourceLangNote}

Your tasks:
1. Determine the English canonical version of this job category (short, professional, title-case, 2–6 words).
2. Translate that English canonical version into each of the following languages: ${langList}

Return ONLY a valid JSON object with this exact structure, no explanation, no code fences:
{
  "canonical_english": "...",
  "translations": {
    "pl": "...",
    "ro": "...",
    "pa": "...",
    "ur": "...",
    "pt": "...",
    "es": "...",
    "ar": "...",
    "bn": "...",
    "gu": "...",
    "fr": "...",
    "tr": "...",
    "hi": "...",
    "so": "...",
    "zh": "...",
    "fa": "...",
    "uk": "...",
    "ku": "...",
    "ta": "...",
    "am": "...",
    "ti": "..."
  }
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[generateJobTranslationsServer] Anthropic error ${response.status}:`, text.slice(0, 500));
      throw new Error("Translation generation failed. Please try again.");
    }

    const result = await response.json() as { content: { type: string; text: string }[] };
    const raw: string = result?.content?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    let parsed: { canonical_english?: string; translations?: Record<string, string> };
    try {
      parsed = JSON.parse(cleaned) as typeof parsed;
    } catch {
      console.error("[generateJobTranslationsServer] Failed to parse response:", raw.slice(0, 200));
      throw new Error("Failed to parse translation response. Please try again.");
    }

    const canonicalTitle = (parsed.canonical_english ?? data.title).trim();
    const translations = parsed.translations ?? {};

    // Validate translations — must be an object with string values
    for (const [k, v] of Object.entries(translations)) {
      if (typeof k !== "string" || typeof v !== "string") {
        throw new Error("Translation response contained non-string values");
      }
    }

    return { canonicalTitle, translations };
  });
