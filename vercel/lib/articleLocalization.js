import { cache } from "react";

const translationCache = new Map();

function cleanText(value) {
  return String(value || "").trim();
}

function looksBangla(text) {
  return /[\u0980-\u09ff]/.test(String(text || ""));
}

function shouldTranslate(text, locale) {
  if (locale !== "bn") return false;
  const value = cleanText(text);
  if (!value) return false;
  return !looksBangla(value);
}

async function fetchGoogleTranslate(text, target = "bn") {
  const value = cleanText(text);
  if (!value) return "";
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", value);
    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json,text/plain,*/*",
      },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`Translate request failed with ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.[0])) return "";
    return data[0]
      .map((item) => String(item?.[0] || ""))
      .join("")
      .trim();
  } catch {
    return "";
  }
}

async function fetchGeminiTranslate(text, target = "bn") {
  const value = cleanText(text);
  if (!value) return "";
  const provider = String(process.env.AI_ARTICLE_PROVIDER || "").trim().toLowerCase();
  const apiKey = String(process.env.AI_ARTICLE_API_KEY || "").trim();
  if (provider !== "gemini" || !apiKey) return "";

  const baseUrl = String(process.env.AI_ARTICLE_BASE_URL || "https://generativelanguage.googleapis.com/v1").trim().replace(/\/+$/, "");
  const model = String(process.env.AI_ARTICLE_MODEL || "gemini-2.0-flash").trim();

  try {
    const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  target === "bn"
                    ? `Translate the following text into natural Bangla. Return only the translated text with no explanation:\n\n${value}`
                    : `Translate the following text into ${target}. Return only the translated text with no explanation:\n\n${value}`,
              },
            ],
          },
        ],
      }),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  } catch {
    return "";
  }
}

async function fetchTranslatedText(text, target = "bn") {
  const value = cleanText(text);
  if (!value) return "";
  const cacheKey = `${target}:${value}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const promise = (async () => {
    const translated = cleanText(await fetchGoogleTranslate(value, target)) || cleanText(await fetchGeminiTranslate(value, target));
    if (!translated) {
      translationCache.delete(cacheKey);
      return value;
    }
    return translated;
  })();

  translationCache.set(cacheKey, promise);
  const resolved = await promise;
  if (resolved === value && shouldTranslate(value, target)) {
    translationCache.delete(cacheKey);
  }
  return resolved;
}

async function translateHtmlPreservingMarkup(html, locale) {
  if (!shouldTranslate(html, locale)) return String(html || "");
  const parts = String(html || "").split(/(<[^>]+>)/g);
  const uniqueTexts = Array.from(
    new Set(
      parts
        .filter((part) => part && !part.startsWith("<") && cleanText(part))
        .map((part) => String(part))
    )
  );
  const translatedEntries = await Promise.all(
    uniqueTexts.map(async (text) => [text, await fetchTranslatedText(text, locale)])
  );
  const translatedMap = new Map(translatedEntries);

  return parts
    .map((part) => {
      if (!part || part.startsWith("<")) return part;
      return translatedMap.get(part) || part;
    })
    .join("");
}

async function localizeArticleInternal(article, locale) {
  if (!article || locale !== "bn") return article;

  const [title, description, excerpt, html] = await Promise.all([
    shouldTranslate(article.title, locale) ? fetchTranslatedText(article.title, locale) : article.title,
    shouldTranslate(article.description, locale) ? fetchTranslatedText(article.description, locale) : article.description,
    shouldTranslate(article.excerpt, locale) ? fetchTranslatedText(article.excerpt, locale) : article.excerpt,
    translateHtmlPreservingMarkup(article.html, locale),
  ]);

  return {
    ...article,
    title,
    description,
    excerpt,
    html,
  };
}

export const localizeArticle = cache(localizeArticleInternal);

export async function localizeArticles(articles, locale) {
  if (!Array.isArray(articles) || locale !== "bn") return Array.isArray(articles) ? articles : [];
  return await Promise.all(articles.map((article) => localizeArticle(article, locale)));
}
