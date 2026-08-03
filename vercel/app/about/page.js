import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "About WEBTVBD",
  description: "Learn what WEBTVBD offers, who it serves, and how the platform organizes live TV and movies.",
  alternates: { canonical: "/about" },
};

const COPY = {
  en: {
    eyebrow: "About WEBTVBD",
    title: "Streaming access built for fast channel discovery",
    intro:
      "WEBTVBD organizes live TV channels and on-demand movies into a single browser-based experience designed for quick playback, simple navigation, and multilingual viewers.",
    noticeTitle: "Important service notice",
    noticeBody:
      "WEBTVBD is committed to displaying only material it is authorized to provide or reference. Listings are reviewed, restricted, or removed when authorization cannot be confirmed, a credible rights concern is received, or technical and safety requirements are not met.",
    home: "Open Home",
    contact: "Contact WEBTVBD",
    whatWeDo: "What we do",
    whatWeDoBody:
      "WEBTVBD helps viewers browse live channels by group, switch between TV and movie browsing, and resume content quickly across devices. The platform focuses on practical playback, curation, and lightweight access rather than cluttered portal-style navigation.",
    whoFor: "Who the platform is for",
    viewers: "Viewers",
    viewersBody: "People who want a simple catalog of live channels and movie content without unnecessary steps before playback.",
    mobileFirst: "Mobile-first users",
    mobileFirstBody: "Users on phones and lower-powered devices who need a responsive interface with fast route loading and compact controls.",
    returning: "Returning visitors",
    returningBody: "Signed-in visitors who benefit from favorites, recent items, continue-watching, and category-driven discovery.",
    searchTraffic: "Search traffic",
    searchTrafficBody: "Public watch pages and informational pages help search engines understand the site and route visitors to relevant content.",
    editorial: "Editorial approach",
    editorialBody:
      "Channel groups, movie categories, articles, and public information pages are maintained to make the site easier to understand, easier to review, and more trustworthy for visitors, advertisers, and search engines.",
    rights: "Rights and removals",
    rightsBody:
      "If you are a copyright owner, publisher, or authorized representative and need any material reviewed or removed, use the public contact or DMCA page so the item can be checked and handled quickly.",
  },
  bn: {
    eyebrow: "WEBTVBD সম্পর্কে",
    title: "দ্রুত চ্যানেল খুঁজে পাওয়ার জন্য তৈরি স্ট্রিমিং অ্যাক্সেস",
    intro:
      "WEBTVBD লাইভ টিভি চ্যানেল এবং অন-ডিমান্ড মুভিকে একটি ব্রাউজারভিত্তিক অভিজ্ঞতায় গুছিয়ে আনে, যাতে দ্রুত প্লেব্যাক, সহজ নেভিগেশন এবং বহুভাষী ভিউয়ারদের জন্য ব্যবহার আরামদায়ক হয়।",
    noticeTitle: "গুরুত্বপূর্ণ সার্ভিস নোটিশ",
    noticeBody:
      "WEBTVBD কেবল অনুমোদিতভাবে provide বা reference করা যায় এমন material দেখাতে প্রতিশ্রুতিবদ্ধ। Authorization নিশ্চিত না হলে, বিশ্বাসযোগ্য rights concern এলে অথবা technical ও safety requirement পূরণ না হলে listing review, restrict বা remove করা হয়।",
    home: "হোম খুলুন",
    contact: "WEBTVBD-র সাথে যোগাযোগ",
    whatWeDo: "আমরা কী করি",
    whatWeDoBody:
      "WEBTVBD ভিউয়ারদের গ্রুপ অনুযায়ী লাইভ চ্যানেল ব্রাউজ করতে, টিভি ও মুভির মধ্যে সহজে বদল করতে এবং বিভিন্ন ডিভাইসে দ্রুত কনটেন্টে ফিরতে সাহায্য করে। প্ল্যাটফর্মটি জটিল পোর্টাল-স্টাইল নেভিগেশনের বদলে ব্যবহারিক প্লেব্যাক, কিউরেশন এবং লাইটওয়েট অ্যাক্সেসে গুরুত্ব দেয়।",
    whoFor: "কার জন্য এই প্ল্যাটফর্ম",
    viewers: "ভিউয়ার",
    viewersBody: "যারা অপ্রয়োজনীয় ধাপ ছাড়া লাইভ চ্যানেল ও মুভি কনটেন্টের সহজ ক্যাটালগ চান।",
    mobileFirst: "মোবাইল-ফার্স্ট ব্যবহারকারী",
    mobileFirstBody: "যারা ফোন বা কম শক্তির ডিভাইসে দ্রুত রুট লোডিং ও কমপ্যাক্ট কন্ট্রোলসহ responsive interface চান।",
    returning: "ফিরে আসা ভিজিটর",
    returningBody: "সাইন-ইন করা ভিজিটর যারা favorites, recent items, continue-watching এবং category-based discovery থেকে উপকৃত হন।",
    searchTraffic: "সার্চ ট্রাফিক",
    searchTrafficBody: "পাবলিক watch page এবং informational page সার্চ ইঞ্জিনকে সাইট বুঝতে সাহায্য করে এবং প্রাসঙ্গিক ভিজিটরদের route করে।",
    editorial: "সম্পাদনাগত দৃষ্টিভঙ্গি",
    editorialBody:
      "চ্যানেল গ্রুপ, মুভি ক্যাটাগরি, আর্টিকেল এবং পাবলিক তথ্যভিত্তিক পেজগুলো এমনভাবে রক্ষণাবেক্ষণ করা হয় যাতে সাইটটি review করা সহজ হয়, বুঝতে সহজ হয় এবং visitor, advertiser ও search engine-এর কাছে বেশি বিশ্বাসযোগ্য লাগে।",
    rights: "অধিকার ও অপসারণ",
    rightsBody:
      "আপনি যদি copyright owner, publisher বা authorized representative হন এবং কোনো কনটেন্ট review বা remove করতে চান, তাহলে public contact বা DMCA page ব্যবহার করুন যাতে বিষয়টি দ্রুত যাচাই ও পরিচালনা করা যায়।",
  },
};

export default async function AboutPage() {
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
      actions={[
        { href: "/", label: copy.home },
        { href: "/contact", label: copy.contact, variant: "secondary" },
      ]}
      sections={[
        {
          title: copy.whatWeDo,
          body: copy.whatWeDoBody,
        },
        {
          title: copy.whoFor,
          type: "grid",
          items: [
            {
              title: copy.viewers,
              body: copy.viewersBody,
            },
            {
              title: copy.mobileFirst,
              body: copy.mobileFirstBody,
            },
            {
              title: copy.returning,
              body: copy.returningBody,
            },
            {
              title: copy.searchTraffic,
              body: copy.searchTrafficBody,
            },
          ],
        },
        {
          title: copy.editorial,
          body: copy.editorialBody,
        },
        {
          title: copy.rights,
          body: copy.rightsBody,
        },
      ]}
    />
  );
}
