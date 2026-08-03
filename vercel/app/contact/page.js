import PublicInfoPage from "../../components/site/PublicInfoPage";
import { getLocaleFromRequest } from "../../lib/i18n/server";

const messengerUrl = String(
  process.env.NEXT_PUBLIC_FACEBOOK_INBOX_URL || "https://www.facebook.com/messages/t/WEBTVBD"
).trim();
const supportEmail = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "admin@webtvbd.com").trim();

export const metadata = {
  title: "Contact WEBTVBD",
  description: "Public contact information and support routes for WEBTVBD visitors, rights holders, and business inquiries.",
  alternates: { canonical: "/contact" },
};

const COPY = {
  en: {
    eyebrow: "Contact",
    title: "Reach the WEBTVBD team",
    intro: "Use the official support routes below for general help, policy requests, rights-related questions, and business communication.",
    messenger: "Open Messenger",
    emailSupport: "Email Support",
    supportChannels: "Support channels",
    messengerSupport: "Messenger support",
    email: "Email",
    rightsCompliance: "Rights and compliance",
    rightsComplianceBody: "For DMCA or ownership-related notices, use the DMCA page and provide complete identifying details for the reported content.",
    business: "Business inquiries",
    businessBody: "Advertising, partnership, and policy questions should include your website or company name and a clear description of the request.",
    response: "Response expectations",
    responseBody: "Support timing can vary depending on the request type. Requests missing URLs, channel names, screenshots, or ownership information may take longer to process.",
    supportEmailMissing: "Set NEXT_PUBLIC_SUPPORT_EMAIL to publish a dedicated support email address here.",
  },
  bn: {
    eyebrow: "যোগাযোগ",
    title: "WEBTVBD টিমের সাথে যোগাযোগ করুন",
    intro: "সাধারণ সহায়তা, policy request, rights-related প্রশ্ন এবং business communication-এর জন্য নিচের official support route ব্যবহার করুন।",
    messenger: "Messenger খুলুন",
    emailSupport: "ইমেইল সাপোর্ট",
    supportChannels: "সাপোর্ট চ্যানেল",
    messengerSupport: "Messenger সাপোর্ট",
    email: "ইমেইল",
    rightsCompliance: "অধিকার ও compliance",
    rightsComplianceBody: "DMCA বা ownership-related notice-এর জন্য DMCA page ব্যবহার করুন এবং reported content-এর সম্পূর্ণ identifying detail দিন।",
    business: "ব্যবসায়িক যোগাযোগ",
    businessBody: "Advertising, partnership এবং policy-related প্রশ্নে আপনার website বা company name এবং request-এর পরিষ্কার description দিন।",
    response: "রেসপন্স সম্পর্কে ধারণা",
    responseBody: "Request-এর ধরন অনুযায়ী response timing ভিন্ন হতে পারে। URL, channel name, screenshot বা ownership information না থাকলে processing আরও সময় নিতে পারে।",
    supportEmailMissing: "এখানে dedicated support email address দেখাতে NEXT_PUBLIC_SUPPORT_EMAIL সেট করুন।",
  },
};

export default async function ContactPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  return (
    <PublicInfoPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      intro={copy.intro}
      actions={[
        { href: messengerUrl, label: copy.messenger, variant: "secondary" },
        ...(supportEmail ? [{ href: `mailto:${supportEmail}`, label: copy.emailSupport }] : []),
      ]}
      sections={[
        {
          title: copy.supportChannels,
          type: "grid",
          items: [
            {
              title: copy.messengerSupport,
              body: `Official inbox: ${messengerUrl}`,
            },
            {
              title: copy.email,
              body: supportEmail || copy.supportEmailMissing,
            },
            {
              title: copy.rightsCompliance,
              body: copy.rightsComplianceBody,
            },
            {
              title: copy.business,
              body: copy.businessBody,
            },
          ],
        },
        {
          title: copy.response,
          body: copy.responseBody,
        },
      ]}
    />
  );
}
