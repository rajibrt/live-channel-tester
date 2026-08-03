import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

export const metadata = {
  title: "Privacy Policy | WEBTVBD",
  description: "Read how WEBTVBD handles account data, cookies, viewing activity, and service analytics.",
  alternates: { canonical: "/privacy-policy" },
};

const COPY = {
  en: {
    eyebrow: "Privacy Policy",
    title: "How WEBTVBD handles visitor and account data",
    intro: "This page explains what information may be processed when you use WEBTVBD, why it is used, and where cookies or similar technologies may be involved.",
    infoTitle: "Information we may process",
    infoItems: [
      "Account details such as email address, display name, mobile number, and profile image when you sign in.",
      "Playback-related activity such as selected channels, recent viewing, favorites, continue-watching, and watch history.",
      "Technical information such as device type, browser, IP-derived location signals, timezone, language, and interaction events needed for security and service quality.",
      "Cookie and local storage preferences used to remember language, consent choices, theme, and selected content state.",
    ],
    whyTitle: "Why this data is used",
    whyBody: "WEBTVBD uses this information to authenticate users, improve playback reliability, remember preferences across sessions, measure product usage, secure accounts, and support features such as favorites, recent items, notifications, and consent management.",
    adsTitle: "Advertising and measurement",
    adsBody: "Advertising services, analytics services, and consent tools may use cookies or similar technologies on supported public pages. Depending on your region and consent choices, these technologies may be used for ad delivery, frequency control, fraud prevention, and performance measurement.",
    choicesTitle: "Your choices",
    choicesBody: "You can manage cookie or consent preferences where applicable, sign out of your account, and avoid using optional features that rely on personalization. Some service functionality may depend on essential storage or security-related processing.",
    thirdPartyTitle: "Third-party services",
    thirdPartyBody: "WEBTVBD may rely on infrastructure and service providers for hosting, authentication, analytics, embedded playback support, and advertising. Those providers may process limited technical information as required to operate the service.",
    contactTitle: "Contact for privacy matters",
    contactBody: "If you need to ask about privacy or data handling, use the public contact page and include enough detail for the request to be reviewed.",
  },
  bn: {
    eyebrow: "প্রাইভেসি পলিসি",
    title: "WEBTVBD কীভাবে visitor ও account data পরিচালনা করে",
    intro: "WEBTVBD ব্যবহার করার সময় কী ধরনের তথ্য প্রক্রিয়াকৃত হতে পারে, কেন ব্যবহার করা হয় এবং কোথায় cookies বা similar technology জড়িত থাকতে পারে তা এই page-এ ব্যাখ্যা করা হয়েছে।",
    infoTitle: "যে তথ্য আমরা প্রক্রিয়া করতে পারি",
    infoItems: [
      "সাইন-ইন করার সময় email address, display name, mobile number এবং profile image-এর মতো account detail।",
      "Selected channel, recent viewing, favorites, continue-watching এবং watch history-এর মতো playback-related activity।",
      "Security ও service quality-এর জন্য device type, browser, IP-derived location signal, timezone, language এবং interaction event-এর মতো technical information।",
      "Language, consent choice, theme এবং selected content state মনে রাখতে cookie ও local storage preference।",
    ],
    whyTitle: "এই ডেটা কেন ব্যবহার করা হয়",
    whyBody: "WEBTVBD এই তথ্য ব্যবহার করে user authenticate করতে, playback reliability উন্নত করতে, preference মনে রাখতে, product usage measure করতে, account secure রাখতে এবং favorites, recent items, notifications ও consent management-এর মতো feature support করতে।",
    adsTitle: "বিজ্ঞাপন ও measurement",
    adsBody: "Supported public page-এ advertising service, analytics service এবং consent tool cookie বা similar technology ব্যবহার করতে পারে। আপনার region ও consent choice অনুযায়ী ad delivery, frequency control, fraud prevention এবং performance measurement-এর জন্য এসব ব্যবহার হতে পারে।",
    choicesTitle: "আপনার পছন্দ",
    choicesBody: "যেখানে প্রযোজ্য সেখানে cookie বা consent preference manage করতে পারেন, account থেকে sign out করতে পারেন এবং personalization-নির্ভর optional feature এড়িয়ে চলতে পারেন। কিছু service functionality essential storage বা security-related processing-এর ওপর নির্ভর করতে পারে।",
    thirdPartyTitle: "থার্ড-পার্টি সার্ভিস",
    thirdPartyBody: "WEBTVBD hosting, authentication, analytics, embedded playback support এবং advertising-এর জন্য third-party provider ব্যবহার করতে পারে। service পরিচালনার জন্য এসব provider সীমিত technical information process করতে পারে।",
    contactTitle: "প্রাইভেসি সংক্রান্ত যোগাযোগ",
    contactBody: "Privacy বা data handling সম্পর্কে জানতে চাইলে public contact page ব্যবহার করুন এবং review করার মতো পর্যাপ্ত detail দিন।",
  },
};

export default async function PrivacyPolicyPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return (
    <PublicInfoPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      sections={[
        {
          title: copy.infoTitle,
          type: "list",
          items: copy.infoItems,
        },
        {
          title: copy.whyTitle,
          body: copy.whyBody,
        },
        {
          title: copy.adsTitle,
          body: copy.adsBody,
        },
        {
          title: copy.choicesTitle,
          body: copy.choicesBody,
        },
        {
          title: copy.thirdPartyTitle,
          body: copy.thirdPartyBody,
        },
        {
          title: copy.contactTitle,
          body: copy.contactBody,
        },
      ]}
    />
  );
}
