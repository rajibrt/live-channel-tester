import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Terms of Use | WEBTVBD",
  description: "Review the public terms that govern access to WEBTVBD and use of its live streaming and movie browsing features.",
};

const COPY = {
  en: {
    eyebrow: "Terms",
    title: "Terms of use for WEBTVBD",
    intro: "By accessing or using WEBTVBD, you agree to use the service lawfully and in a way that does not interfere with the platform, its users, or its rights and review obligations.",
    noticeTitle: "Content responsibility notice",
    noticeBody: "WEBTVBD provides the browsing interface, user access controls, and platform management for the channel and movie listings shown on the site. Specific streams, assets, or availability may change when provider status, technical issues, moderation, or rights review requires an update.",
    service: "Service scope",
    serviceBody: "WEBTVBD provides access, organization, and browsing interfaces for live channel and movie-related content. Features, availability, and access controls may change without notice.",
    use: "Acceptable use",
    useItems: [
      "Do not attempt to disrupt playback, authentication, routing, or other core service functions.",
      "Do not misuse automated tools, scraping, or abuse patterns that harm availability or performance.",
      "Do not impersonate other users, submit false ownership notices, or attempt unauthorized account access.",
      "Do not use the service in violation of applicable law or third-party rights.",
    ],
    accounts: "Accounts and access",
    accountsBody: "Some parts of WEBTVBD require sign-in, approval, or access controls. You are responsible for keeping your credentials secure and for activity occurring through your account.",
    content: "Content and availability",
    contentBody: "Playback quality, catalog coverage, and content availability can change due to upstream sources, rights issues, technical constraints, moderation, or operational decisions. Because WEBTVBD does not control those upstream sources, uninterrupted availability cannot be guaranteed.",
    enforcement: "Enforcement",
    enforcementBody: "WEBTVBD may limit access, suspend accounts, remove items, or update policies when needed for security, compliance, platform review, or operational integrity.",
  },
  bn: {
    eyebrow: "শর্তাবলী",
    title: "WEBTVBD ব্যবহারের শর্তাবলী",
    intro: "WEBTVBD ব্যবহার বা অ্যাক্সেস করার মাধ্যমে আপনি সম্মত হচ্ছেন যে সেবাটি বৈধভাবে এবং এমনভাবে ব্যবহার করবেন যাতে প্ল্যাটফর্ম, এর ব্যবহারকারী বা এর অধিকার ও review obligation-এ ব্যাঘাত না ঘটে।",
    noticeTitle: "কনটেন্ট দায়বদ্ধতা নোটিশ",
    noticeBody: "WEBTVBD সাইটে দেখানো channel ও movie listing-এর browsing interface, user access control এবং platform management পরিচালনা করে। Provider status, technical issue, moderation বা rights review-এর কারণে নির্দিষ্ট stream, asset বা availability আপডেট হতে পারে।",
    service: "সেবার পরিধি",
    serviceBody: "WEBTVBD লাইভ চ্যানেল ও মুভি-সম্পর্কিত কনটেন্টের জন্য access, organization এবং browsing interface দেয়। feature, availability এবং access control পূর্ব নোটিশ ছাড়াই পরিবর্তিত হতে পারে।",
    use: "গ্রহণযোগ্য ব্যবহার",
    useItems: [
      "Playback, authentication, routing বা অন্য core service function ব্যাহত করার চেষ্টা করবেন না।",
      "Availability বা performance ক্ষতিগ্রস্ত হয় এমন automated tool, scraping বা abuse pattern ব্যবহার করবেন না।",
      "অন্য user সেজে থাকা, false ownership notice পাঠানো বা unauthorized account access-এর চেষ্টা করবেন না।",
      "Applicable law বা third-party rights লঙ্ঘন করে service ব্যবহার করবেন না।",
    ],
    accounts: "অ্যাকাউন্ট ও অ্যাক্সেস",
    accountsBody: "WEBTVBD-র কিছু অংশে sign-in, approval বা access control প্রয়োজন। আপনার credential নিরাপদে রাখা এবং আপনার account-এর মাধ্যমে হওয়া activity-এর দায়িত্ব আপনার।",
    content: "কনটেন্ট ও availability",
    contentBody: "Playback quality, catalog coverage এবং content availability upstream source, rights issue, technical constraint, moderation বা operational decision-এর কারণে পরিবর্তিত হতে পারে। WEBTVBD ওই upstream source নিয়ন্ত্রণ না করায় uninterrupted availability নিশ্চিত করা যায় না।",
    enforcement: "প্রয়োগ ও ব্যবস্থা",
    enforcementBody: "Security, compliance, platform review বা operational integrity-এর প্রয়োজনে WEBTVBD access সীমিত করতে, account suspend করতে, item remove করতে বা policy update করতে পারে।",
  },
};

export default async function TermsPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return (
    <PublicInfoPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      notice={{
        title: copy.noticeTitle,
        body: copy.noticeBody,
      }}
      sections={[
        {
          title: copy.service,
          body: copy.serviceBody,
        },
        {
          title: copy.use,
          type: "list",
          items: copy.useItems,
        },
        {
          title: copy.accounts,
          body: copy.accountsBody,
        },
        {
          title: copy.content,
          body: copy.contentBody,
        },
        {
          title: copy.enforcement,
          body: copy.enforcementBody,
        },
      ]}
    />
  );
}
