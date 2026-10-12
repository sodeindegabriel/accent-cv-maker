import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

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
    postcode?: string;
    rightToWork: string;
  };
  experienceType: string;
  experience: { title: string; place: string; country?: string; duration: string; description: string }[];
  education?: { qualification: string; institution: string; country: string; year: string }[];
  skills: string[];
  availability: string[];
  personalStatementOverride?: string;
};

export type GeneratedCV = {
  native: string;
  english: string;
  language: string;
  raw: string;
};

// ── Input size limits ─────────────────────────────────────────────────────────
// These are validated server-side in the inputValidator before any API call.
const CV_LIMITS = {
  jobTypesMax: 10,
  skillMax: 200,
  skillsMax: 30,
  experienceMax: 10,
  experienceDescMax: 2000,
  experienceTitleMax: 120,
  experiencePlaceMax: 120,
  experienceDurationMax: 80,
  educationMax: 10,
  personalStatementMax: 4000,
  nameMax: 120,
  cityMax: 120,
  postcodeMax: 20,
  phoneMax: 30,
  emailMax: 120,
  rightToWorkMax: 200,
  availabilityMax: 10,
  availabilityItemMax: 80,
};

function capStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

function validateAndCapCVData(raw: CVData): CVData {
  const pd = raw.personalDetails ?? {};
  return {
    language: capStr(raw.language, 80),
    languageCode: capStr(raw.languageCode, 10),
    jobTypes: (Array.isArray(raw.jobTypes) ? raw.jobTypes.slice(0, CV_LIMITS.jobTypesMax) : []).map(
      (t) => capStr(t, 80)
    ),
    otherJobType: capStr(raw.otherJobType, 80),
    personalDetails: {
      name: capStr(pd.name, CV_LIMITS.nameMax),
      phone: capStr(pd.phone, CV_LIMITS.phoneMax),
      email: capStr(pd.email, CV_LIMITS.emailMax),
      city: capStr(pd.city, CV_LIMITS.cityMax),
      postcode: pd.postcode ? capStr(pd.postcode, CV_LIMITS.postcodeMax) : undefined,
      rightToWork: capStr(pd.rightToWork, CV_LIMITS.rightToWorkMax),
    },
    experienceType: capStr(raw.experienceType, 80),
    experience: (Array.isArray(raw.experience) ? raw.experience.slice(0, CV_LIMITS.experienceMax) : []).map(
      (e) => ({
        title: capStr(e.title, CV_LIMITS.experienceTitleMax),
        place: capStr(e.place, CV_LIMITS.experiencePlaceMax),
        country: e.country ? capStr(e.country, 80) : undefined,
        duration: capStr(e.duration, CV_LIMITS.experienceDurationMax),
        description: capStr(e.description, CV_LIMITS.experienceDescMax),
      })
    ),
    education: Array.isArray(raw.education)
      ? raw.education.slice(0, CV_LIMITS.educationMax).map((e) => ({
          qualification: capStr(e.qualification, 200),
          institution: capStr(e.institution, 200),
          country: capStr(e.country, 80),
          year: capStr(e.year, 20),
        }))
      : undefined,
    skills: (Array.isArray(raw.skills) ? raw.skills.slice(0, CV_LIMITS.skillsMax) : []).map(
      (s) => capStr(s, CV_LIMITS.skillMax)
    ),
    availability: (Array.isArray(raw.availability)
      ? raw.availability.slice(0, CV_LIMITS.availabilityMax)
      : []
    ).map((a) => capStr(a, CV_LIMITS.availabilityItemMax)),
    personalStatementOverride: raw.personalStatementOverride
      ? capStr(raw.personalStatementOverride, CV_LIMITS.personalStatementMax)
      : undefined,
  };
}

function isEnglishOnly(cvData: CVData) {
  const code = (cvData.languageCode || "").toLowerCase();
  const name = (cvData.language || "").toLowerCase();
  return code === "en" || name === "english";
}

function buildPrompt(cvData: CVData) {
  const { language, jobTypes, otherJobType, personalDetails, experience, education, skills, availability } = cvData;
  const resolvedJobTypes = jobTypes.map((t) =>
    t === "other" ? (otherJobType?.trim() || t) : t
  );
  const hasEducation = Array.isArray(education) && education.length > 0;

  return `You are a professional UK CV writer. Generate a complete, well-formatted UK CV as clean HTML only.

STRICT RULES:
- Output ONLY valid HTML. No markdown. No asterisks. No **bold** syntax. No explanatory text.
- Use semantic HTML tags: h1, h2, p, ul, li, strong, span
- Do NOT include html, head, body, or style tags — just the inner CV content div

CV STRUCTURE (follow this exact order):
<div class="cv-header">
  <h1 class="cv-name">[Full Name]</h1>
  <p class="cv-contact">[Town/City${personalDetails.postcode ? ", Postcode" : ""}] · [Phone] · [Email]</p>
</div>
<div class="cv-section">
  <h2>Personal Statement</h2>
  <p>[First paragraph: who they are, their background, what role they're seeking, their key strengths. Professional and compelling.]</p>
  <p>[Second paragraph: what they bring to an employer, availability, work ethic, and ambition. Rich and persuasive.]</p>
</div>
<div class="cv-section">
  <h2>Work Experience</h2>
  [For each role:]
  <div class="cv-job">
    <p><strong>[Job Title]</strong> — [Company Name] <span class="cv-date">[Dates]</span></p>
    <ul>
      <li>[Responsibility or achievement]</li>
    </ul>
  </div>
</div>
${hasEducation ? `<div class="cv-section">
  <h2>Education</h2>
  [For each qualification:]
  <div class="cv-edu">
    <p><strong>[Qualification]</strong> — [Institution, Country] <span class="cv-date">[Year]</span></p>
  </div>
</div>
` : `[OMIT the Education section entirely — no education has been provided.]
`}<div class="cv-section">
  <h2>Skills</h2>
  <ul>
    <li><strong>[Skill name]:</strong> [Brief description of that skill]</li>
  </ul>
</div>
<div class="cv-section">
  <h2>Availability</h2>
  <ul>
    <li>[Availability option]</li>
  </ul>
</div>
<div class="cv-section">
  <h2>Right to Work</h2>
  <p>[Right to work status]</p>
</div>
<div class="cv-section">
  <h2>References</h2>
  <p>Available upon request</p>
</div>

QUALITY STANDARDS:
- Personal statement must always be 2 full paragraphs minimum — rich, professional, no clichés
- Every skill must have a name AND a description, never just a single word
- Section headings are plain text inside h2 tags — no asterisks, no colons, no markdown
- Contact details: full name as h1, then one clean line below with location · phone · email
- Never output asterisks, hashtags, or any markdown syntax under any circumstances
- If a "Personal Statement (use this verbatim)" is provided in the user information, copy it exactly as written into the personal statement section — do NOT rewrite, summarise, or alter it in any way.
- If generating in ${language}, write all CV content in that language. For the English version, write everything in professional British English.
- The user may have written their answers in their native language. Some place names, company names, or details may be in the user's language — for example "Londres" means London, "Varsovie" means Warsaw. Intelligently translate and interpret all user inputs into the correct English equivalents when generating the English CV. Never leave foreign language place names or terms untranslated in the English CV version.

USER INFORMATION:
Name: ${personalDetails.name}
Location: ${personalDetails.city}${personalDetails.postcode ? `, ${personalDetails.postcode}` : ""}
Phone: ${personalDetails.phone}
Email: ${personalDetails.email || "Not provided"}
Right to work: ${personalDetails.rightToWork}
Job types wanted: ${resolvedJobTypes.join(", ")}

Work experience:
${
  experience.length === 0
    ? "No previous formal employment"
    : experience
        .map(
          (e) => `- ${e.title} at ${e.place || "unlisted"}${e.country ? ` (${e.country})` : ""} for ${e.duration}: ${e.description}`,
        )
        .join("\n")
}

Education:
${hasEducation
  ? education!
      .map((e) => `- ${e.qualification} at ${e.institution}${e.country ? `, ${e.country}` : ""} (${e.year || "year not given"})`)
      .join("\n")
  : "None provided — DO NOT include an Education section in the CV."}

Skills: ${skills.join(", ")}
Availability: ${availability.join(", ")}
${cvData.personalStatementOverride?.trim() ? `\nPersonal Statement (use this verbatim — do not rewrite it): ${cvData.personalStatementOverride.trim()}` : ""}



${isEnglishOnly(cvData) ? `Generate ONE CV written entirely in professional British English using the exact structure above.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS — no commentary before or after, no code fences:

===CV IN ENGLISH===
[Full HTML CV in English]` : `Generate TWO versions of the CV using the exact structure above:
1. One written entirely in ${language}
2. One written entirely in English

FORMAT YOUR RESPONSE EXACTLY LIKE THIS — no commentary before or after, no code fences:

===CV IN ${language.toUpperCase()}===
[Full HTML CV in ${language}]

===CV IN ENGLISH===
[Full HTML CV in English]`}`;

}

export type GenerateCVInput = CVData & { accessToken: string; editingCvId?: string };

export const generateCVServer = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateCVInput) => data)
  .handler(async ({ data: rawInput }): Promise<GeneratedCV> => {
    const { accessToken, editingCvId, ...rawCvData } = rawInput;

    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const supabaseUrl = process.env["VITE_SUPABASE_URL"];
    const supabaseAnonKey = process.env["VITE_SUPABASE_ANON_KEY"];
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Server configuration error.");
    }
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: authErr } = await sb.auth.getUser(accessToken);
    if (authErr || !user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    // ── 2. Pre-flight doc/edit cap (mirror server-side trigger logic) ─────────
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (!isAdmin) {
      if (!editingCvId) {
        const { count } = await sb
          .from("cv_documents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if ((count ?? 0) >= 2) {
          throw new Error("cv_limit_reached");
        }
      } else {
        const { count } = await sb
          .from("cv_edit_events")
          .select("id", { count: "exact", head: true })
          .eq("cv_id", editingCvId);
        if ((count ?? 0) >= 2) {
          throw new Error("edit_limit_reached");
        }
      }

      // ── 3. Rate-limit reservation (before API call) ───────────────────────
      const { error: rateErr } = await sb.rpc("ai_usage_reserve", { p_kind: "cv" });
      if (rateErr) {
        if (rateErr.message.includes("rate_limited")) {
          throw new Error("rate_limited");
        }
        throw new Error("Could not verify rate limit. Please try again.");
      }
    }

    // ── 4. Cap / sanitise input fields ────────────────────────────────────────
    const cvData = validateAndCapCVData(rawCvData as CVData);

    // ── 5. Call Claude ────────────────────────────────────────────────────────
    const apiKey = process.env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_KEY"];
    if (!apiKey) {
      throw new Error("Service temporarily unavailable. Please try again later.");
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
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      // Log server-side only — never expose to caller
      console.error(`[generateCVServer] Anthropic error ${response.status}:`, body.slice(0, 500));
      if (response.status === 429) throw new Error("rate_limited");
      throw new Error("CV generation failed. Please try again.");
    }

    const responseText = await response.text();
    const result = JSON.parse(responseText);
    const raw: string = result?.content?.[0]?.text ?? "";

    const language = cvData.language || "Native";
    const nativeMarker = `===CV IN ${language.toUpperCase()}===`;
    const englishMarker = `===CV IN ENGLISH===`;

    let native = "";
    let english = "";

    const englishIdx = raw.indexOf(englishMarker);
    const nativeIdx = raw.indexOf(nativeMarker);

    if (isEnglishOnly(cvData) && englishIdx !== -1) {
      english = raw.slice(englishIdx + englishMarker.length).trim();
      native = english;
    } else if (nativeIdx !== -1 && englishIdx !== -1) {
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
