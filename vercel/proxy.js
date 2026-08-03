import { NextResponse } from "next/server";

const LEGACY_ARTICLE_REDIRECTS = new Map([
  ["/articles/article-313b1b73", "/articles/ক্যাপশন-অ্যাক্সেসিবিলিটি-ও-টিভিতে-কাস্টিং-সবার-জন্য-ভালো-দেখার-অভিজ্ঞতা-313b1b73"],
  ["/articles/হঠাৎ-বিতর্কে-সাইয়ারা-নায়িকা-অনীত-পড্ডা-কী-নিয়ে-এত-আলোচনা-313b1b73", "/articles/ক্যাপশন-অ্যাক্সেসিবিলিটি-ও-টিভিতে-কাস্টিং-সবার-জন্য-ভালো-দেখার-অভিজ্ঞতা-313b1b73"],
  ["/articles/article-26dd31c2", "/articles/লাইভ-স্ট্রিম-বারবার-বাফার-করলে-কী-করবেন-ধাপে-ধাপে-সমাধান-26dd31c2"],
  ["/articles/ঈদে-দর্শকের-পছন্দে-কোন-নাটকগুলো-এগিয়ে-26dd31c2", "/articles/লাইভ-স্ট্রিম-বারবার-বাফার-করলে-কী-করবেন-ধাপে-ধাপে-সমাধান-26dd31c2"],
  ["/articles/popular-actor-rahul-dies-after-drowning-193f727c", "/articles/ভিডিও-স্ট্রিমিংয়ে-কত-ডেটা-লাগে-কোয়ালিটি-ও-খরচের-গাইড-193f727c"],
  ["/articles/how-to-watch-live-tv-channels-in-bangladesh-for-free-on-any-device-5474a282", "/articles/অনলাইনে-বাংলাদেশি-টিভি-বৈধ-ও-নিরাপদভাবে-দেখার-গাইড-5474a282"],
  ["/articles/top-10-bangladeshi-tv-channels-you-can-watch-online-in-2026-b77246e3", "/articles/বাংলাদেশি-টিভি-চ্যানেল-বেছে-নেওয়ার-ব্যবহারিক-গাইড-b77246e3"],
  ["/articles/online-live-tv-ott-platform-2cb453ce", "/articles/বাংলাদেশে-টেলিভিশন-ও-ott-দর্শকের-অভ্যাস-কীভাবে-বদলাচ্ছে-2cb453ce"],
  ["/articles/বাংলাদেশে-online-live-tv-ও-ott-platform-ভবিষ্যৎ-কোথায়-2cb453ce", "/articles/বাংলাদেশে-টেলিভিশন-ও-ott-দর্শকের-অভ্যাস-কীভাবে-বদলাচ্ছে-2cb453ce"],
  ["/articles/bangladesh-television-the-pioneer-of-broadcasting-in-bangladesh-064a26f9", "/articles/বাংলাদেশ-টেলিভিশনের-ইতিহাস-১৯৬৪-থেকে-ডিজিটাল-যুগ-064a26f9"],
]);

export function proxy(req) {
  const forwardedHost = String(req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedHost === "www.webtvbd.com") {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.hostname = "webtvbd.com";
    canonicalUrl.port = "";
    canonicalUrl.protocol = "https:";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  let decodedPathname = req.nextUrl.pathname;
  try {
    decodedPathname = decodeURIComponent(decodedPathname);
  } catch {
    // Keep the original pathname when a malformed escape sequence is supplied.
  }
  const legacyArticleTarget = LEGACY_ARTICLE_REDIRECTS.get(decodedPathname);
  if (legacyArticleTarget) {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.pathname = legacyArticleTarget;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (req.method === "POST" && req.headers.has("next-action")) {
    return NextResponse.json(
      {
        error: "Stale Server Action reference. Reload the page and try again.",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
