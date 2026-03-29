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
  const cacheKey = `${target}:${value}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const promise = (async () => {
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
      if (!Array.isArray(data?.[0])) return value;
      const translated = data[0]
        .map((item) => String(item?.[0] || ""))
        .join("")
        .trim();
      return translated || value;
    } catch {
      return value;
    }
  })();

  translationCache.set(cacheKey, promise);
  return promise;
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
    uniqueTexts.map(async (text) => [text, await fetchGoogleTranslate(text, locale)])
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
    shouldTranslate(article.title, locale) ? fetchGoogleTranslate(article.title, locale) : article.title,
    shouldTranslate(article.description, locale) ? fetchGoogleTranslate(article.description, locale) : article.description,
    shouldTranslate(article.excerpt, locale) ? fetchGoogleTranslate(article.excerpt, locale) : article.excerpt,
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
