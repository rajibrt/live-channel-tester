import Image from "next/image";
import Link from "next/link";
import styles from "../login/page.module.css";
import { getCurrentClient } from "../../lib/clientAuth";
import { redirect } from "next/navigation";
import { getDictionaryForRequest } from "../../lib/i18n/server";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../../lib/siteSeoSettings";
import ClientAuthTabs from "./ClientAuthTabs";

export async function generateMetadata() {
  try {
    const settings = await loadSiteSeoSettingsCached();
    const metadata = buildHomePageMetadata(settings);
    return {
      ...metadata,
      title: "Client Login | WEBTVBD",
      robots: {
        index: false,
        follow: true,
      },
    };
  } catch {
    const metadata = buildHomePageMetadata({});
    return {
      ...metadata,
      title: "Client Login | WEBTVBD",
      robots: {
        index: false,
        follow: true,
      },
    };
  }
}

export default async function ClientLoginPage({ searchParams }) {
  const { t } = await getDictionaryForRequest();
  const current = await getCurrentClient();
  if (current) redirect("/");

  const params = await searchParams;
  const requestedTab = String(params?.tab || "").trim().toLowerCase();
  const errorCode = String(params?.error || "").trim().toLowerCase();
  const registerErrorCode = String(params?.register_error || "").trim().toLowerCase();
  const resetState = String(params?.reset || "").trim().toLowerCase();
  const registered = String(params?.registered || "").trim() === "1";
  const hasError = Boolean(errorCode);
  const hasRegisterError = Boolean(registerErrorCode);
  const hasResetInfo = resetState === "sent" || resetState === "updated" || resetState === "invalid";
  const pending = String(params?.pending || "").trim() === "1";
  const initialTab = hasRegisterError || requestedTab === "signup" ? "signup" : "login";
  const errorMessage =
    errorCode === "inactive"
      ? t("auth.clientInactive")
      : errorCode === "facebook_start"
        ? t("auth.facebookStartFailed")
        : errorCode === "facebook_callback"
          ? t("auth.facebookCallbackFailed")
          : errorCode === "facebook_profile"
          ? t("auth.facebookProfileFailed")
            : t("auth.loginFailed");
  const resetMessage =
    resetState === "sent"
      ? t("auth.ifEmailExistsResetSent")
      : resetState === "updated"
        ? t("auth.resetClientPasswordUpdated")
        : resetState === "invalid"
          ? t("auth.resetClientInvalid")
          : "";
  const registerErrorMessage =
    registerErrorCode === "mobile_exists"
      ? t("auth.registerMobileExists")
      : registerErrorCode === "email_exists"
        ? t("auth.registerEmailExists")
      : registerErrorCode === "password_mismatch"
        ? t("settings.passwordMismatch")
      : registerErrorCode === "create_failed"
        ? t("auth.registerCreateFailed")
      : registerErrorCode === "rate_limited"
        ? t("auth.registerRateLimited")
      : registerErrorCode === "pending_limit"
        ? t("auth.registerPendingLimit")
      : registerErrorCode === "robot_check"
        ? t("auth.registerRobotCheckFailed")
      : registerErrorCode === "blocked"
        ? t("auth.registerBlocked")
        : registerErrorCode === "profile_failed"
          ? t("auth.registerProfileFailed")
          : t("auth.registerInvalid");

  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <Link href="/" className={styles.visualBrand} aria-label={t("publicSite.navHome")}>
          <Image
            src="/logo.png"
            alt={t("auth.webtvLogoAlt")}
            width={416}
            height={130}
            className={styles.visualBrandLogoFull}
            priority
          />
          <p className={styles.visualBrandSlogan}>{t("auth.tvBeyondBorders")}</p>
        </Link>
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>{t("auth.clientAccess")}</p>
          <h1 className={styles.visualTitle}>{t("auth.viewerPortal")}</h1>
          <p className={styles.visualText}>
            {t("auth.clientPortalDesc")}
          </p>
          <div className={styles.visualPublicLinks}>
            <p className={styles.publicLinksLabel}>Public pages</p>
            <nav className={styles.publicLinksNav} aria-label="Public information pages">
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/privacy-policy">Privacy Policy</Link>
              <Link href="/cookie-policy">Cookie Policy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/dmca">DMCA</Link>
            </nav>
          </div>
        </div>
      </section>

      <section className={styles.formPane}>
        <ClientAuthTabs
          initialTab={initialTab}
          hasLoginError={hasError}
          loginErrorMessage={errorMessage}
          pending={pending}
          registered={registered}
          hasResetInfo={hasResetInfo}
          resetMessage={resetMessage}
          resetInvalid={resetState === "invalid"}
          hasRegisterError={hasRegisterError}
          registerErrorCode={registerErrorCode}
          registerErrorMessage={registerErrorMessage}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
        />
      </section>
    </main>
  );
}
