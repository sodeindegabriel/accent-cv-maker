import { createServerFn } from "@tanstack/react-start";

export type CVData = {
  language: string;
  languageCode: string;
  jobTypes: string[];
  otherJobType: string;
  personalDetails: {
    name: string;
    phone: string;
    email: string;
    city: string;
    rightToWork: string;
  };
  experienceType: string;
  experience: { title: string; place: string; duration: string; description: string }[];
  skills: string[];
  availability: string[];
};

export type GeneratedCV = {
  native: string;
  english: string;
  language: string;
  raw: string;
};

function buildPrompt(cvData: CVData) {
  const { language, jobTypes, personalDetails, experience, skills, availability } = cvData;

  return `You are a professional UK CV writer helping immigrants find employment.

The user has provided their information. Generate TWO versions of their CV:
1. A professional CV written entirely in ${language}
2. The same CV written entirely in English

The CV should:
- Follow standard UK CV format (no photo, no date of birth, no nationality)
- Be appropriate for entry-level / hands-on roles (cleaning, care, warehouse, kitchen, etc.)
- Be warm, professional, and highlight transferable skills
- Be honest — do not invent qualifications they did not mention
- Be concise — ideally one page
- Include a short personal statement (2-3 sentences) that sounds human, not corporate

USER INFORMATION:
Name: ${personalDetails.name}
Location: ${personalDetails.city}
Phone: ${personalDetails.phone}
Email: ${personalDetails.email || "Not provided"}
Right to work: ${personalDetails.rightToWork}
Job types wanted: ${jobTypes.join(", ")}

Work experience:
${
  experience.length === 0
    ? "No previous formal employment"
    : experience
        .map(
          (e) => `- ${e.title} at ${e.place || "unlisted"} for ${e.duration}: ${e.description}`,
        )
        .join("\n")
}

Skills: ${skills.join(", ")}
Availability: ${availability.join(", ")}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS — no commentary before or after:

===CV IN ${language.toUpperCase()}===
[Full CV in ${language}]

===CV IN ENGLISH===
[Full CV in English]`;
}

export const generateCVServer = createServerFn({ method: "POST" })
  .inputValidator((data: CVData) => data)
  .handler(async ({ data: cvData }): Promise<GeneratedCV> => {
    const apiKey = process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_KEY secret on the server.");
    }

    const prompt = buildPrompt(cvData);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Anthropic API error ${response.status}: ${text || response.statusText}`);
    }

    const result = await response.json();
    const raw: string = result?.content?.[0]?.text ?? "";

    const language = cvData.language || "Native";
    const nativeMarker = `===CV IN ${language.toUpperCase()}===`;
    const englishMarker = `===CV IN ENGLISH===`;

    let native = "";
    let english = "";

    const englishIdx = raw.indexOf(englishMarker);
    const nativeIdx = raw.indexOf(nativeMarker);

    if (nativeIdx !== -1 && englishIdx !== -1) {
      native = raw.slice(nativeIdx + nativeMarker.length, englishIdx).trim();
      english = raw.slice(englishIdx + englishMarker.length).trim();
    } else if (englishIdx !== -1) {
      native = raw.slice(0, englishIdx).trim();
      english = raw.slice(englishIdx + englishMarker.length).trim();
    } else {
      english = raw.trim();
      native = raw.trim();
    }

    return { native, english, language, raw };
  });
