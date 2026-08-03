import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";

export const runtime = "nodejs";

function cleanText(value) {
  return String(value || "").trim();
}

function getConfig() {
  const provider = cleanText(process.env.AI_ARTICLE_PROVIDER || "gemini").toLowerCase();
  const rawModel = cleanText(process.env.AI_ARTICLE_MODEL);
  const rawBaseUrl = cleanText(process.env.AI_ARTICLE_BASE_URL);
  const normalizedGeminiModel =
    rawModel === "gemini-1.5-flash" || rawModel === "gemini-1.5-flash-latest" ? "gemini-2.0-flash" : rawModel;
  const normalizedGeminiBaseUrl = rawBaseUrl.includes("/v1beta")
    ? rawBaseUrl.replace(/\/v1beta\/?$/, "/v1")
    : rawBaseUrl;
  return {
    provider,
    apiKey: cleanText(process.env.AI_ARTICLE_API_KEY),
    model: cleanText(
      provider === "gemini"
        ? normalizedGeminiModel || "gemini-2.0-flash"
        : rawModel || "gpt-4o-mini"
    ),
    baseUrl: cleanText(
      provider === "gemini"
        ? normalizedGeminiBaseUrl || "https://generativelanguage.googleapis.com/v1"
        : rawBaseUrl || "https://api.openai.com/v1"
    ),
  };
}

function buildPrompt({ title, language, tone, length }) {
  const targetLanguage = language === "bn" ? "Bangla" : "English";
  const toneLabel = tone === "news" ? "news analysis" : tone === "guide" ? "practical guide" : "informative editorial";
  const lengthLabel = length === "long" ? "900-1400 words" : length === "short" ? "450-650 words" : "650-950 words";

  return `
You are preparing a research draft for a human WEBTVBD editor. It is not publish-ready until an editor verifies it.

Requirements:
- Article title/topic: "${title}"
- Write in ${targetLanguage}
- Tone: ${toneLabel}
- Target length: ${lengthLabel}
- Output valid semantic HTML only for the article body, not a full HTML document
- Use tags like article, header, h1, h2, h3, p, ul, ol, strong when relevant
- Do not use Tailwind classes or utility CSS classes
- Do not mention AI, automation, or that the article was generated
- Make the draft original, useful, readable, and suitable for rigorous human review before publication
- Include a concise intro, 3-5 structured sections, practical reader value, and a short closing section
- Focus on Bangladesh / WEBTVBD context when relevant
- Never invent a quote, statistic, event detail, source, test result, or first-hand experience
- Mark any time-sensitive or unsupported factual claim with [VERIFY] so the editor can research it before publishing
- Do not add generic keyword labels, "Published on WEBTVBD", or repetitive promotional conclusions
- Suggest where primary sources, original screenshots, testing, or data would materially improve the article

Return strict JSON with this shape:
{
  "title": "final title",
  "excerpt": "1-2 sentence summary",
  "html": "<article>...</article>"
}
  `.trim();
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Empty AI response.");
  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }
  throw new Error("AI response was not valid JSON.");
}

function normalizeHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();
}

async function generateWithOpenAICompatible({ apiKey, model, baseUrl, prompt }) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You generate clean publisher-ready article drafts and always return strict JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error?.message || payload?.message || "Failed to generate article draft.");
  }
  return String(payload?.choices?.[0]?.message?.content || "");
}

async function generateWithGemini({ apiKey, model, baseUrl, prompt }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.7,
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error?.message || payload?.message || "Failed to generate article draft.");
  }
  return String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { provider, apiKey, model, baseUrl } = getConfig();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI article generation is not configured. Set AI_ARTICLE_API_KEY in vercel/.env.local." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const title = cleanText(body?.title);
  const language = cleanText(body?.language || "bn").toLowerCase() === "en" ? "en" : "bn";
  const tone = ["informative", "guide", "news"].includes(cleanText(body?.tone).toLowerCase())
    ? cleanText(body?.tone).toLowerCase()
    : "informative";
  const length = ["short", "medium", "long"].includes(cleanText(body?.length).toLowerCase())
    ? cleanText(body?.length).toLowerCase()
    : "medium";

  if (title.length < 6) {
    return NextResponse.json({ error: "Title must be at least 6 characters to generate a draft." }, { status: 400 });
  }

  try {
    const prompt = buildPrompt({ title, language, tone, length });
    const content =
      provider === "gemini"
        ? await generateWithGemini({ apiKey, model, baseUrl, prompt })
        : await generateWithOpenAICompatible({ apiKey, model, baseUrl, prompt });
    const parsed = extractJson(content);
    const finalTitle = cleanText(parsed?.title || title);
    const excerpt = cleanText(parsed?.excerpt);
    const html = normalizeHtml(parsed?.html);

    if (!html) {
      return NextResponse.json({ error: "AI draft did not include HTML content." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      draft: {
        title: finalTitle,
        excerpt,
        html,
        language,
        tone,
        length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to generate article draft." }, { status: 500 });
  }
}
