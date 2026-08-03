import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "DMCA and Rights Notices | WEBTVBD",
  description: "Instructions for copyright owners and authorized representatives to send content removal or rights-related notices to WEBTVBD.",
  alternates: { canonical: "/dmca" },
};

const COPY = {
  en: {
    eyebrow: "DMCA",
    title: "Copyright and rights notice guidance",
    intro: "If you are a copyright owner or an authorized representative, include enough detail for the reported material to be identified and reviewed.",
    noticeTitle: "Review notice",
    noticeBody: "WEBTVBD reviews reported listings and related platform references when valid rights concerns are submitted. Reported items can be checked, restricted, or removed as needed after review.",
    include: "What to include",
    includeItems: [
      "The exact URL or URLs where the material appears.",
      "The title, channel name, or identifying label of the reported material.",
      "A description of the copyrighted work you believe is affected.",
      "Your name and relationship to the rights holder.",
      "A contact method that allows follow-up communication.",
      "A statement that the information in the notice is accurate and submitted in good faith.",
    ],
    incomplete: "Incomplete notices",
    incompleteBody: "Requests that do not include enough information to identify the material may not be processed until clarifying details are provided.",
    route: "Submission route",
    routeBody: "Use the public contact page to send rights-related notices and clearly label the message as a copyright or DMCA-related request.",
    openContact: "Open Contact Page",
  },
  bn: {
    eyebrow: "DMCA",
    title: "কপিরাইট ও অধিকার সংক্রান্ত নির্দেশনা",
    intro: "আপনি যদি copyright owner বা authorized representative হন, তাহলে reported material সনাক্ত ও review করার জন্য পর্যাপ্ত detail দিন।",
    noticeTitle: "রিভিউ নোটিশ",
    noticeBody: "Valid rights concern জমা পড়লে WEBTVBD reported listing এবং সম্পর্কিত platform reference review করে। Review শেষে প্রয়োজন হলে reported item check, restrict বা remove করা যেতে পারে।",
    include: "কী কী তথ্য দেবেন",
    includeItems: [
      "যেখানে material দেখা যাচ্ছে সেই exact URL বা URLগুলো।",
      "Reported material-এর title, channel name বা identifying label।",
      "আপনি যে copyrighted work affected হয়েছে বলে মনে করছেন তার বর্ণনা।",
      "আপনার নাম এবং rights holder-এর সাথে সম্পর্ক।",
      "Follow-up communication-এর জন্য একটি contact method।",
      "Notice-এর তথ্য সঠিক এবং good faith-এ জমা দেওয়া হয়েছে এমন একটি statement।",
    ],
    incomplete: "অসম্পূর্ণ notice",
    incompleteBody: "Material সনাক্ত করার মতো পর্যাপ্ত তথ্য না থাকলে clarifying detail না পাওয়া পর্যন্ত request process নাও করা হতে পারে।",
    route: "জমা দেওয়ার পথ",
    routeBody: "Rights-related notice পাঠাতে public contact page ব্যবহার করুন এবং message-এ স্পষ্টভাবে copyright বা DMCA-related request উল্লেখ করুন।",
    openContact: "Contact Page খুলুন",
  },
};

export default async function DmcaPage() {
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
          title: copy.include,
          type: "list",
          items: copy.includeItems,
        },
        {
          title: copy.incomplete,
          body: copy.incompleteBody,
        },
        {
          title: copy.route,
          body: copy.routeBody,
        },
      ]}
      actions={[
        { href: "/contact", label: copy.openContact },
      ]}
    />
  );
}
