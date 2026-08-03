import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Advertising Disclosure | WEBTVBD",
  description: "How advertising is separated from editorial content and where WEBTVBD permits ad placement.",
  alternates: { canonical: "/advertising-disclosure" },
};

const COPY = {
  en: {
    title: "Advertising and editorial independence",
    intro: "Advertising may help fund WEBTVBD, but it does not purchase favorable coverage or determine our editorial conclusions.",
    sections: [
      { title: "Where ads may appear", body: "Ads are intended for substantial public editorial pages. We avoid ad placement on sign-in, password recovery, account, dashboard, empty-state, and other utility screens." },
      { title: "Clear separation", body: "Advertising should be visually distinguishable from articles, navigation, playback controls, and download or action buttons. We do not encourage accidental clicks." },
      { title: "Sponsored material", body: "Paid or sponsored editorial material must be clearly labeled near the title. The relationship and sponsor should be understandable before a reader engages with the content." },
      { title: "Privacy choices", body: "Optional advertising and measurement technologies load on supported public pages only after the visitor's privacy choice. More detail is available in our Privacy and Cookie policies." },
    ],
  },
  bn: {
    title: "বিজ্ঞাপন ও সম্পাদকীয় স্বাধীনতা",
    intro: "বিজ্ঞাপন WEBTVBD পরিচালনায় সহায়তা করতে পারে, কিন্তু অনুকূল coverage কিনতে বা editorial সিদ্ধান্ত নিয়ন্ত্রণ করতে পারে না।",
    sections: [
      { title: "কোথায় বিজ্ঞাপন থাকতে পারে", body: "বিজ্ঞাপন substantial public editorial page-এর জন্য সীমিত। Sign-in, password recovery, account, dashboard, empty-state এবং utility screen-এ ad placement এড়িয়ে চলা হয়।" },
      { title: "পরিষ্কার পার্থক্য", body: "বিজ্ঞাপনকে article, navigation, playback control এবং download বা action button থেকে দৃশ্যত আলাদা রাখা হয়। Accidental click উৎসাহিত করা হয় না।" },
      { title: "Sponsored material", body: "Paid বা sponsored editorial material title-এর কাছাকাছি স্পষ্টভাবে label করতে হবে। পাঠক content দেখার আগেই sponsor ও সম্পর্ক বুঝতে পারবেন।" },
      { title: "প্রাইভেসি পছন্দ", body: "Supported public page-এ visitor-এর privacy choice-এর পর optional advertising ও measurement technology load হয়। বিস্তারিত Privacy এবং Cookie Policy-তে আছে।" },
    ],
  },
};

export default async function AdvertisingDisclosurePage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return <PublicInfoPage eyebrow="WEBTVBD" title={copy.title} intro={copy.intro} sections={copy.sections} />;
}
