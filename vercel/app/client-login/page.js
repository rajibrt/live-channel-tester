import Image from "next/image";
import styles from "../login/page.module.css";
import { getCurrentClient } from "../../lib/clientAuth";
import { redirect } from "next/navigation";
import PasswordField from "../../components/auth/PasswordField";
import FacebookHashHandler from "./FacebookHashHandler";
import { getDictionaryForRequest } from "../../lib/i18n/server";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../../lib/siteSeoSettings";

export async function generateMetadata() {
  try {
    const settings = await loadSiteSeoSettingsCached();
    return buildHomePageMetadata(settings);
  } catch {
    return buildHomePageMetadata({});
  }
}

export default async function ClientLoginPage({ searchParams }) {
  const { t } = await getDictionaryForRequest();
  const current = await getCurrentClient();
  if (current) redirect("/");

  const params = await searchParams;
  const errorCode = String(params?.error || "").trim().toLowerCase();
  const hasError = Boolean(errorCode);
  const pending = String(params?.pending || "").trim() === "1";
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

  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <div className={styles.visualBrand}>
          <Image
            src="/logo.png"
            alt={t("auth.webtvLogoAlt")}
            width={416}
            height={130}
            className={styles.visualBrandLogoFull}
            priority
          />
          <p className={styles.visualBrandSlogan}>{t("auth.tvBeyondBorders")}</p>
        </div>
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>{t("auth.clientAccess")}</p>
          <h1 className={styles.visualTitle}>{t("auth.viewerPortal")}</h1>
          <p className={styles.visualText}>
            {t("auth.clientPortalDesc")}
          </p>
        </div>
      </section>

      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <FacebookHashHandler />
          <p className={styles.formTag}>{t("auth.signIn")}</p>
          <h2 className={styles.formTitle}>{t("auth.clientLogin")}</h2>
          <p className={styles.formText}>{t("auth.clientLoginDesc")}</p>

          {hasError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              {errorMessage}
            </p>
          ) : null}
          {pending ? (
            <p className={styles.note} role="status">
              {t("auth.profilePendingApproval")}
            </p>
          ) : null}

          <form method="post" action="/api/client/auth/login" className={styles.form} autoComplete="off">
            <label className={styles.field}>
              <span>{t("auth.emailOrMobile")}</span>
              <input
                name="identifier"
                type="text"
                required
                placeholder={t("auth.clientIdentifierPlaceholder")}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>

            <PasswordField
              styles={styles}
              autoComplete="off"
              label={t("settings.password")}
              placeholder={t("auth.passwordPlaceholder")}
              showLabel={t("settings.showPassword")}
              hideLabel={t("settings.hidePassword")}
            />

            <button type="submit" className={styles.submit}>{t("auth.signIn")}</button>
          </form>

          <p className={styles.divider}>{t("auth.orContinueWithLower")}</p>
          <a href="/api/client/auth/facebook/start" className={`${styles.socialBtn} ${styles.facebookBtn}`}>
            <span className={styles.socialIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v3H6v4h3v4h4v-4h3.1l.9-4H13V9c0-.6.4-1 1-1z" />
              </svg>
            </span>
            <span>{t("auth.continueWithFacebook")}</span>
          </a>
        </div>
      </section>
    </main>
  );
}
