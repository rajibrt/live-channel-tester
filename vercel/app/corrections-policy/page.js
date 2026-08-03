import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Corrections Policy | WEBTVBD",
  description: "How readers can report errors and how WEBTVBD reviews, corrects, and records material changes.",
  alternates: { canonical: "/corrections-policy" },
};

const COPY = {
  en: {
    title: "Corrections and reader feedback",
    intro: "Accuracy matters. Readers, sources, and rights holders can ask us to review a factual error, misleading description, broken reference, or attribution concern.",
    sections: [
      { title: "How to report an issue", body: "Use the Contact page and include the exact URL, the statement or media in question, the reason it may be wrong, and a reliable supporting source when available." },
      { title: "How we review", body: "We compare the report with primary or authoritative evidence, review the publication history, and contact relevant parties when clarification is necessary." },
      { title: "How corrections appear", body: "Minor spelling or formatting changes may be made silently. A material factual correction should update the page date and include a clear editor's note explaining what changed." },
      { title: "Rights and removals", body: "Copyright and ownership reports follow the separate DMCA and rights-review process. Content may be restricted while a credible claim is investigated." },
    ],
  },
  bn: {
    title: "সংশোধন ও পাঠকের মতামত",
    intro: "নির্ভুলতা গুরুত্বপূর্ণ। পাঠক, সূত্র ও rights holder কোনো factual error, বিভ্রান্তিকর বর্ণনা, broken reference বা attribution concern review করার অনুরোধ করতে পারেন।",
    sections: [
      { title: "ভুল জানানোর নিয়ম", body: "Contact page-এ exact URL, প্রশ্নবিদ্ধ statement বা media, কেন সেটি ভুল হতে পারে এবং সম্ভব হলে নির্ভরযোগ্য supporting source দিন।" },
      { title: "আমরা যেভাবে যাচাই করি", body: "রিপোর্টটি primary বা authoritative evidence-এর সঙ্গে মিলিয়ে দেখা হয়, publication history review করা হয় এবং প্রয়োজন হলে সংশ্লিষ্ট পক্ষের কাছে clarification চাওয়া হয়।" },
      { title: "সংশোধন যেভাবে দেখানো হয়", body: "ছোট spelling বা formatting পরিবর্তন আলাদা note ছাড়াই হতে পারে। গুরুত্বপূর্ণ factual correction-এ updated date এবং কী পরিবর্তন হয়েছে তা জানানো editor's note থাকা উচিত।" },
      { title: "অধিকার ও অপসারণ", body: "Copyright ও ownership report আলাদা DMCA process অনুসরণ করে। বিশ্বাসযোগ্য claim তদন্তের সময় content সাময়িকভাবে সীমিত করা হতে পারে।" },
    ],
  },
};

export default async function CorrectionsPolicyPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return <PublicInfoPage eyebrow="WEBTVBD" title={copy.title} intro={copy.intro} actions={[{ href: "/contact", label: locale === "bn" ? "ভুল জানান" : "Report an error" }]} sections={copy.sections} />;
}
