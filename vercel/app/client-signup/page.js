import { redirect } from "next/navigation";

export default function ClientSignupRedirectPage() {
  redirect("/client-login?tab=signup");
}
