import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Editorial Team | WEBTVBD",
  description: "Meet the WEBTVBD Editorial Desk and understand its publishing responsibilities.",
  alternates: { canonical: "/editorial-team" },
};

const COPY = {
  en: {
    title: "The WEBTVBD Editorial Desk",
    intro: "The Editorial Desk is responsible for planning coverage, reviewing drafts, checking sources, maintaining article pages, and responding to correction or rights-related requests.",
    sections: [
      { title: "Coverage focus", body: "Our work focuses on Bangladesh television, broadcasting history, streaming technology, device guidance, media literacy, and practical viewing help." },
      { title: "Review responsibility", body: "The desk is accountable for verifying time-sensitive claims, improving drafts with original research, identifying conflicts or sponsored material, and keeping corrections visible." },
      { title: "Contact the desk", body: "Use the public Contact page for editorial feedback, source suggestions, factual corrections, or questions about how an article was prepared." },
    ],
  },
  bn: {
    title: "WEBTVBD সম্পাদকীয় ডেস্ক",
    intro: "Editorial Desk coverage পরিকল্পনা, draft review, source verification, article maintenance এবং correction বা rights-related request-এর উত্তর দেওয়ার দায়িত্ব পালন করে।",
    sections: [
      { title: "কভারেজের বিষয়", body: "আমাদের কাজ বাংলাদেশের টেলিভিশন, broadcasting history, streaming technology, device guide, media literacy এবং ব্যবহারিক viewing help-এ কেন্দ্রীভূত।" },
      { title: "রিভিউয়ের দায়িত্ব", body: "সময়-সংবেদনশীল claim যাচাই, original research দিয়ে draft উন্নত করা, conflict বা sponsored material চিহ্নিত করা এবং correction দৃশ্যমান রাখার দায়িত্ব desk-এর।" },
      { title: "ডেস্কের সাথে যোগাযোগ", body: "Editorial feedback, source suggestion, factual correction বা article কীভাবে প্রস্তুত হয়েছে সে প্রশ্নের জন্য public Contact page ব্যবহার করুন।" },
    ],
  },
};

export default async function EditorialTeamPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return <PublicInfoPage eyebrow="WEBTVBD" title={copy.title} intro={copy.intro} actions={[{ href: "/contact", label: locale === "bn" ? "সম্পাদকীয় ডেস্কে লিখুন" : "Contact the editorial desk" }]} sections={copy.sections} />;
}
