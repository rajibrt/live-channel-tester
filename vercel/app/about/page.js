import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "About WEBTVBD",
  description: "WEBTVBD publishes practical guides about TVs, streaming, radio and home networks for viewers in Bangladesh, and runs a sign-in viewing area for its members.",
  alternates: { canonical: "/about" },
};

const COPY = {
  en: {
    eyebrow: "About WEBTVBD",
    title: "Helping Bangladeshi households get more from TV, streaming and radio",
    intro:
      "WEBTVBD is a small editorial team in Bangladesh. We write practical, plainly worded guides about televisions, streaming devices, home internet and radio, along with stories about the history of broadcasting in the country.",
    noticeTitle: "Rights and responsible viewing",
    noticeBody:
      "WEBTVBD only lists material it is permitted to provide or link to. Listings are reviewed, restricted or removed when permission cannot be confirmed, when a credible rights concern is received, or when technical or safety requirements are not met.",
    home: "Read the latest guides",
    contact: "Contact WEBTVBD",
    whatWeDo: "What we publish",
    whatWeDoBody:
      "Step-by-step help with real problems — buffering, Wi-Fi, soundbars, picture settings, power cuts, data costs — plus explainers on how cable, DTH, IPTV and OTT services differ, how to stay safe from fake apps and scams, and how radio and cinema developed in Bangladesh. Each article lists its sources and the date it was last reviewed.",
    whoFor: "Who we write for",
    viewers: "Families",
    viewersBody: "Households that want to set up and use their TV, internet and devices without technical jargon.",
    mobileFirst: "Mobile viewers",
    mobileFirstBody: "People who watch and listen mostly on phones and want to save data and battery.",
    returning: "Older viewers and carers",
    returningBody: "Parents, grandparents and the people who help them, with guides written for clarity and accessibility.",
    searchTraffic: "Members",
    searchTrafficBody: "Registered members can also sign in to the WEBTVBD viewing area, which includes a TV guide-style channel directory and an FM radio player.",
    editorial: "How we work",
    editorialBody:
      "Articles are written and checked by the WEBTVBD Editorial Desk against official documentation and published sources. We update guides when products or services change and correct mistakes openly — see our editorial and corrections policies.",
    rights: "Rights and removals",
    rightsBody:
      "If you are a copyright owner, publisher or authorised representative and need any material reviewed or removed, use the contact or DMCA page and we will check and act on it promptly.",
  },
  bn: {
    eyebrow: "WEBTVBD সম্পর্কে",
    title: "টিভি, স্ট্রিমিং আর রেডিও থেকে আরও ভালো অভিজ্ঞতা পেতে বাংলাদেশি পরিবারের পাশে",
    intro:
      "WEBTVBD বাংলাদেশের একটি ছোট সম্পাদকীয় দল। আমরা টেলিভিশন, স্ট্রিমিং ডিভাইস, বাসার ইন্টারনেট আর রেডিও নিয়ে সহজ ভাষায় ব্যবহারিক গাইড লিখি, সঙ্গে দেশের সম্প্রচারের ইতিহাসের গল্প।",
    noticeTitle: "অধিকার ও দায়িত্বশীল দেখা",
    noticeBody:
      "WEBTVBD শুধু সেই কনটেন্টই তালিকাভুক্ত করে যা দেখানো বা লিংক করার অনুমতি আছে। অনুমতি নিশ্চিত না হলে, বিশ্বাসযোগ্য অধিকার-সংক্রান্ত অভিযোগ এলে কিংবা কারিগরি বা নিরাপত্তার শর্ত পূরণ না হলে তালিকা পর্যালোচনা, সীমিত বা সরিয়ে ফেলা হয়।",
    home: "সাম্প্রতিক গাইড পড়ুন",
    contact: "WEBTVBD-র সঙ্গে যোগাযোগ",
    whatWeDo: "আমরা কী প্রকাশ করি",
    whatWeDoBody:
      "বাস্তব সমস্যার ধাপে ধাপে সমাধান—বাফারিং, Wi-Fi, সাউন্ডবার, ছবির সেটিং, লোডশেডিং, ডেটা খরচ—সঙ্গে কেবল, DTH, IPTV আর OTT-র পার্থক্য, ভুয়া অ্যাপ ও প্রতারণা থেকে বাঁচার উপায়, এবং বাংলাদেশে রেডিও ও চলচ্চিত্রের পথচলা। প্রতিটি লেখায় সূত্র আর সর্বশেষ পর্যালোচনার তারিখ থাকে।",
    whoFor: "আমরা কাদের জন্য লিখি",
    viewers: "পরিবার",
    viewersBody: "যারা কারিগরি জটিলতা ছাড়া টিভি, ইন্টারনেট আর ডিভাইস সেট আপ ও ব্যবহার করতে চান।",
    mobileFirst: "মোবাইল দর্শক",
    mobileFirstBody: "যারা বেশিরভাগ সময় ফোনে দেখেন ও শোনেন, আর ডেটা ও ব্যাটারি বাঁচাতে চান।",
    returning: "বয়স্ক দর্শক ও তাঁদের সহায়তাকারী",
    returningBody: "বাবা-মা, দাদা-দাদি আর যাঁরা তাঁদের সাহায্য করেন—সহজবোধ্য ও অ্যাক্সেসযোগ্য গাইড।",
    searchTraffic: "সদস্য",
    searchTrafficBody: "নিবন্ধিত সদস্যরা WEBTVBD-এর ভিউয়িং অংশে সাইন ইন করতে পারেন, যেখানে টিভি গাইডের মতো চ্যানেল তালিকা আর একটি এফএম রেডিও প্লেয়ার আছে।",
    editorial: "আমরা যেভাবে কাজ করি",
    editorialBody:
      "প্রতিটি লেখা WEBTVBD সম্পাদকীয় ডেস্ক অফিসিয়াল ডকুমেন্টেশন ও প্রকাশিত সূত্রের সঙ্গে মিলিয়ে লেখে ও যাচাই করে। পণ্য বা সেবা বদলালে গাইড হালনাগাদ করা হয় এবং ভুল প্রকাশ্যে সংশোধন করা হয়—আমাদের সম্পাদনা ও সংশোধন নীতিমালা দেখুন।",
    rights: "অধিকার ও অপসারণ",
    rightsBody:
      "আপনি কপিরাইট মালিক, প্রকাশক বা অনুমোদিত প্রতিনিধি হলে এবং কোনো কনটেন্ট পর্যালোচনা বা অপসারণ প্রয়োজন হলে Contact বা DMCA পাতা ব্যবহার করুন; আমরা দ্রুত যাচাই করে ব্যবস্থা নেব।",
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
        { href: "/articles", label: copy.home },
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
