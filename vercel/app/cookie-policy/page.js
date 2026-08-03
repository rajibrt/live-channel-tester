import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Cookie Policy | WEBTVBD",
  description: "Learn how WEBTVBD uses cookies, local storage, and consent preferences on public and signed-in experiences.",
  alternates: { canonical: "/cookie-policy" },
};

const COPY = {
  en: {
    eyebrow: "Cookie Policy",
    title: "Cookie and local storage notice",
    intro: "WEBTVBD uses cookies and browser storage to keep the site functional, remember user preferences, and support analytics or advertising where allowed.",
    essential: "Essential storage",
    essentialBody: "Essential cookies or storage may be used for sign-in state, security, language preference, playback continuity, and basic site operation. These are required for core features to work properly.",
    pref: "Preference storage",
    prefBody: "Preference storage may remember theme mode, selected categories, last viewed channels, recent items, and similar usability settings so the site feels consistent between visits.",
    ads: "Measurement and advertising",
    adsBody: "Where supported and permitted by your consent choices, advertising or measurement services may set cookies or use similar technologies to understand traffic, deliver ads, limit repetition, and improve site performance.",
    manage: "Managing cookies",
    manageBody: "You can use the site’s consent controls where available, clear browser storage, or change browser settings to block certain categories of cookies. Blocking essential storage may prevent sign-in or playback-related features from working correctly.",
  },
  bn: {
    eyebrow: "কুকি পলিসি",
    title: "কুকি ও local storage নোটিশ",
    intro: "WEBTVBD সাইট সচল রাখা, user preference মনে রাখা এবং যেখানে অনুমোদিত সেখানে analytics বা advertising support করার জন্য cookie এবং browser storage ব্যবহার করে।",
    essential: "Essential storage",
    essentialBody: "Sign-in state, security, language preference, playback continuity এবং basic site operation-এর জন্য essential cookie বা storage ব্যবহার হতে পারে। core feature ঠিকভাবে কাজ করতে এগুলো প্রয়োজন।",
    pref: "Preference storage",
    prefBody: "Theme mode, selected category, last viewed channel, recent item এবং অনুরূপ usability setting মনে রাখতে preference storage ব্যবহার হতে পারে, যাতে ভিজিটের মধ্যে site consistent লাগে।",
    ads: "Measurement ও বিজ্ঞাপন",
    adsBody: "আপনার consent choice অনুযায়ী যেখানে অনুমোদিত, advertising বা measurement service cookie বা similar technology ব্যবহার করে traffic বুঝতে, ad deliver করতে, repetition limit করতে এবং site performance উন্নত করতে পারে।",
    manage: "কুকি ম্যানেজ করা",
    manageBody: "যেখানে available সেখানে site-এর consent control ব্যবহার করতে পারেন, browser storage clear করতে পারেন বা browser setting বদলে কিছু cookie category block করতে পারেন। Essential storage block করলে sign-in বা playback-related feature ঠিকমতো কাজ নাও করতে পারে।",
  },
};

export default async function CookiePolicyPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return (
    <PublicInfoPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      sections={[
        {
          title: copy.essential,
          body: copy.essentialBody,
        },
        {
          title: copy.pref,
          body: copy.prefBody,
        },
        {
          title: copy.ads,
          body: copy.adsBody,
        },
        {
          title: copy.manage,
          body: copy.manageBody,
        },
      ]}
    />
  );
}
