import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Editorial Policy | WEBTVBD",
  description: "How WEBTVBD selects, researches, reviews, updates, and labels its editorial content.",
  alternates: { canonical: "/editorial-policy" },
};

const COPY = {
  en: {
    eyebrow: "Editorial standards",
    title: "How WEBTVBD publishes useful and accountable content",
    intro: "Our editorial pages are intended to help readers understand television, streaming technology, media, and viewing choices in Bangladesh. Publication is not automatic: drafts should be checked for accuracy, usefulness, originality, and rights concerns.",
    sections: [
      { title: "Research and sourcing", body: "Writers should prefer primary documents, official broadcaster information, direct testing, and clearly identified reputable sources. Claims that may change are dated and checked again before publication." },
      { title: "Original value", body: "Every article should add reporting, tested steps, context, comparison, screenshots, data, or analysis that a reader cannot get from a copied summary. Translation or automated drafting alone is not treated as original reporting." },
      { title: "Human review", body: "Tools may assist research or drafting, but an editor is responsible for checking facts, removing unsupported claims, improving clarity, and confirming that the final article serves readers rather than search engines." },
      { title: "Independence and labeling", body: "Advertising does not determine editorial conclusions. Sponsorships, affiliate relationships, press materials, or other material interests must be disclosed where they apply." },
      { title: "Updates and corrections", body: "Material changes should carry an updated date. Readers can report an error through the contact page; confirmed errors are corrected transparently under our corrections policy." },
    ],
  },
  bn: {
    eyebrow: "সম্পাদনা নীতিমালা",
    title: "WEBTVBD যেভাবে দায়িত্বশীল ও ব্যবহারযোগ্য কনটেন্ট প্রকাশ করে",
    intro: "আমাদের সম্পাদকীয় পেজ বাংলাদেশের টেলিভিশন, স্ট্রিমিং প্রযুক্তি, মিডিয়া ও দেখার পছন্দ সম্পর্কে পাঠককে বাস্তব সহায়তা দেওয়ার জন্য। কোনো draft স্বয়ংক্রিয়ভাবে প্রকাশযোগ্য নয়—নির্ভুলতা, মৌলিকতা, ব্যবহারযোগ্যতা ও অধিকারসংক্রান্ত ঝুঁকি যাচাই করা হয়।",
    sections: [
      { title: "গবেষণা ও সূত্র", body: "লেখায় primary document, broadcaster-এর official তথ্য, নিজস্ব testing এবং পরিচয় স্পষ্ট এমন নির্ভরযোগ্য সূত্রকে অগ্রাধিকার দেওয়া হয়। পরিবর্তনশীল তথ্য প্রকাশের আগে তারিখসহ আবার যাচাই করা হয়।" },
      { title: "নিজস্ব মূল্য সংযোজন", body: "প্রতিটি লেখায় reporting, tested step, context, comparison, screenshot, data বা analysis থাকতে হবে। কপি করা summary, translation বা automated draft-কে একা original reporting ধরা হয় না।" },
      { title: "মানবসম্পাদনা", body: "গবেষণা বা draft তৈরিতে tool সহায়তা করতে পারে, তবে fact-check, unsupported claim বাদ দেওয়া এবং পাঠকের উপকার নিশ্চিত করার দায় একজন editor-এর।" },
      { title: "স্বাধীনতা ও disclosure", body: "বিজ্ঞাপন editorial সিদ্ধান্ত নিয়ন্ত্রণ করে না। Sponsorship, affiliate সম্পর্ক, press material বা অন্য material interest থাকলে তা স্পষ্টভাবে জানানো হয়।" },
      { title: "আপডেট ও সংশোধন", body: "গুরুত্বপূর্ণ পরিবর্তনে updated date দেওয়া হয়। পাঠক Contact page দিয়ে ভুল জানাতে পারেন; নিশ্চিত ভুল Corrections Policy অনুযায়ী স্বচ্ছভাবে সংশোধন করা হয়।" },
    ],
  },
};

export default async function EditorialPolicyPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return <PublicInfoPage eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} sections={copy.sections} />;
}
