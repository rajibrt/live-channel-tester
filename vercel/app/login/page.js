import Image from "next/image";
import styles from "./page.module.css";
import PasswordField from "../../components/auth/PasswordField";
import { getDictionaryForRequest } from "../../lib/i18n/server";

export default async function LoginPage({ searchParams }) {
  const { t } = await getDictionaryForRequest();
  const params = await searchParams;
  const hasError = Boolean(params?.error);
  const resetState = String(params?.reset || "").trim().toLowerCase();
  const hasResetInfo = resetState === "sent" || resetState === "updated" || resetState === "invalid";
  const resetMessage =
    resetState === "sent"
      ? t("auth.ifEmailExistsResetSent")
      : resetState === "updated"
        ? t("auth.passwordUpdated")
        : resetState === "invalid"
          ? t("auth.resetInvalid")
          : "";

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
          <p className={styles.visualTag}>{t("auth.welcomeBack")}</p>
          <h1 className={styles.visualTitle}>{t("auth.adminConsoleTitle")}</h1>
          <p className={styles.visualText}>
            {t("auth.adminConsoleDesc")}
          </p>
        </div>
      </section>

      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <p className={styles.formTag}>{t("auth.signIn")}</p>
          <h2 className={styles.formTitle}>{t("auth.accessDashboard")}</h2>
          <p className={styles.formText}>{t("auth.useAdminCredentials")}</p>

          {hasError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              {t("auth.loginFailed")}
            </p>
          ) : null}
          {hasResetInfo ? (
            <p className={`${styles.note} ${resetState === "invalid" ? styles.errorNote : styles.successNote}`} role="status">
              {resetMessage}
            </p>
          ) : null}

          <form method="post" action="/api/auth/login" className={styles.form}>
            <label className={styles.field}>
              <span>{t("auth.emailAddress")}</span>
              <input name="email" type="email" required placeholder={t("auth.emailPlaceholder")} />
            </label>

            <PasswordField
              styles={styles}
              label={t("settings.password")}
              placeholder={t("auth.passwordPlaceholder")}
              showLabel={t("settings.showPassword")}
              hideLabel={t("settings.hidePassword")}
            />

            <div className={styles.row}>
              <label className={styles.checkbox}>
                <input type="checkbox" name="remember" />
                <span>{t("auth.rememberMe")}</span>
              </label>
              <a href="#forgot-password-modal" className={styles.link}>{t("auth.forgotPassword")}</a>
            </div>

            <button type="submit" className={styles.submit}>{t("auth.signIn")}</button>
          </form>

        </div>
      </section>
      <div id="forgot-password-modal" className={styles.modalWrap} aria-hidden="true">
        <a href="#" className={styles.modalBackdrop} aria-label={t("common.close")} />
        <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
          <div className={styles.modalHeader}>
            <h3 id="forgot-password-title" className={styles.modalTitle}>{t("auth.forgotPassword")}</h3>
            <a href="#" className={styles.modalClose} aria-label={t("common.close")}>×</a>
          </div>
          <form method="post" action="/api/auth/forgot-password" className={styles.resetForm}>
            <label className={styles.field}>
              <span>{t("auth.resetAdminPassword")}</span>
              <input name="email" type="email" required placeholder={t("auth.emailPlaceholder")} />
            </label>
            <button type="submit" className={styles.resetBtn}>{t("auth.sendResetLink")}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
