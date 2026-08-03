import { redirect } from "next/navigation";

export const metadata = {
  title: "Create Client Account | WEBTVBD",
  robots: { index: false, follow: false },
};

export default function ClientSignupRedirectPage() {
  redirect("/client-login?tab=signup");
}
