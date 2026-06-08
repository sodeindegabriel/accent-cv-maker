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
    postcode?: string;
    rightToWork: string;
  };
  experienceType: string;
  experience: { title: string; place: string; country?: string; duration: string; description: string }[];
  education?: { qualification: string; institution: string; country: string; year: string }[];
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
  const { language, jobTypes, personalDetails, experience, education, skills, availability } = cvData;
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
- If generating in ${language}, write all CV content in that language. For the English version, write everything in professional British English.

USER INFORMATION:
Name: ${personalDetails.name}
Location: ${personalDetails.city}${personalDetails.postcode ? `, ${personalDetails.postcode}` : ""}
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



Generate TWO versions of the CV using the exact structure above:
1. One written entirely in ${language}
2. One written entirely in English

FORMAT YOUR RESPONSE EXACTLY LIKE THIS — no commentary before or after, no code fences:

===CV IN ${language.toUpperCase()}===
[Full HTML CV in ${language}]

===CV IN ENGLISH===
[Full HTML CV in English]`;
}

export const generateCVServer = createServerFn({ method: "POST" })
  .inputValidator((data: CVData) => data)
  .handler(async ({ data: cvData }): Promise<GeneratedCV> => {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY secret on the server.");
    }

    const prompt = buildPrompt(cvData);

    const requestBody = {
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    };

    console.log("[generateCVServer] Anthropic request:", {
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": `${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (len=${apiKey.length})`,
        "anthropic-version": "2023-06-01",
      },
      body: requestBody,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log("[generateCVServer] Anthropic response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${responseText || response.statusText}`);
    }

    const result = JSON.parse(responseText);
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
