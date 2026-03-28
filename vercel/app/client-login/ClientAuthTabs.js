"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PasswordField from "../../components/auth/PasswordField";
import PublicLocaleToggle from "../../components/site/PublicLocaleToggle";
import { useI18n } from "../../components/i18n/LanguageProvider";
import styles from "../login/page.module.css";
import FacebookHashHandler from "./FacebookHashHandler";

export default function ClientAuthTabs({
  initialTab = "login",
  hasLoginError = false,
  loginErrorMessage = "",
  pending = false,
  registered = false,
  hasResetInfo = false,
  resetMessage = "",
  resetInvalid = false,
  hasRegisterError = false,
  registerErrorMessage = "",
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState(initialTab === "signup" ? "signup" : "login");

  useEffect(() => {
    setTab(initialTab === "signup" ? "signup" : "login");
  }, [initialTab]);

  return (
    <div className={styles.formShell}>
      <FacebookHashHandler />
      <div className={styles.formHeaderRow}>
        <PublicLocaleToggle className={styles.localeToggleBtn} />
      </div>
      <div className={styles.authModeSwitch} role="tablist" aria-label="Client authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          className={`${styles.authModeLink} ${tab === "login" ? styles.authModeLinkActive : ""}`}
          onClick={() => setTab("login")}
        >
          {t("auth.signIn")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          className={`${styles.authModeLink} ${tab === "signup" ? styles.authModeLinkActive : ""}`}
          onClick={() => setTab("signup")}
        >
          {t("auth.createAccount")}
        </button>
      </div>

      <div className={styles.authPanels}>
        <section
          role="tabpanel"
          hidden={tab !== "login"}
          className={`${styles.authTabPanel} ${tab === "login" ? styles.authTabPanelActive : ""}`}
        >
          <p className={styles.formTag}>{t("auth.signIn")}</p>
          <h2 className={styles.formTitle}>{t("auth.clientLogin")}</h2>
          <p className={styles.formText}>{t("auth.clientLoginDesc")}</p>

          {hasLoginError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              {loginErrorMessage}
            </p>
          ) : null}
          {pending ? (
            <p className={styles.note} role="status">
              {t("auth.profilePendingApproval")}
            </p>
          ) : null}
          {registered ? (
            <p className={styles.successNote} role="status">
              {t("auth.registerSuccess")}
            </p>
          ) : null}
          {hasResetInfo ? (
            <p className={`${styles.note} ${resetInvalid ? styles.errorNote : styles.successNote}`} role="status">
              {resetMessage}
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

            <button type="submit" className={styles.submit}>
              {t("auth.signIn")}
            </button>
          </form>

          <div className={styles.row}>
            <span />
            <a href="#client-forgot-password-modal" className={styles.link}>{t("auth.forgotPassword")}</a>
          </div>

          <p className={styles.divider}>{t("auth.orContinueWithLower")}</p>
          <a href="/api/client/auth/facebook/start" className={`${styles.socialBtn} ${styles.facebookBtn}`}>
            <span className={styles.socialIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v3H6v4h3v4h4v-4h3.1l.9-4H13V9c0-.6.4-1 1-1z" />
              </svg>
            </span>
            <span>{t("auth.continueWithFacebook")}</span>
          </a>

          <div className={styles.inlineSwitchNote}>
            <span>{t("auth.noAccountYet")}</span>
            <button type="button" className={styles.inlineSwitchButton} onClick={() => setTab("signup")}>
              {t("auth.createAccount")}
            </button>
          </div>
        </section>

        <section
          role="tabpanel"
          hidden={tab !== "signup"}
          className={`${styles.authTabPanel} ${tab === "signup" ? styles.authTabPanelActive : ""}`}
        >
          <p className={styles.formTag}>{t("auth.createAccount")}</p>
          <h2 className={styles.formTitle}>{t("auth.createClientAccount")}</h2>
          <p className={styles.formText}>{t("auth.createClientAccountDesc")}</p>

          {hasRegisterError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              {registerErrorMessage}
            </p>
          ) : null}

          <form method="post" action="/api/client/auth/register" className={styles.form} autoComplete="off">
            <label className={styles.field}>
              <span>{t("common.fullName")}</span>
              <input
                name="full_name"
                type="text"
                required
                placeholder={t("auth.fullNamePlaceholder")}
                autoComplete="name"
              />
            </label>
            <label className={styles.field}>
              <span>{t("auth.emailAddress")}</span>
              <input
                name="email"
                type="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className={styles.field}>
              <span>{t("auth.mobileNumber")}</span>
              <input
                name="mobile_number"
                type="tel"
                required
                placeholder={t("auth.mobileNumberPlaceholder")}
                autoComplete="tel"
                inputMode="numeric"
              />
            </label>
            <PasswordField
              styles={styles}
              autoComplete="new-password"
              label={t("settings.password")}
              placeholder={t("auth.createPasswordPlaceholder")}
              showLabel={t("settings.showPassword")}
              hideLabel={t("settings.hidePassword")}
            />
            <PasswordField
              styles={styles}
              name="confirm_password"
              autoComplete="new-password"
              label={t("settings.confirmPassword")}
              placeholder={t("settings.repeatPassword")}
              showLabel={t("settings.showPassword")}
              hideLabel={t("settings.hidePassword")}
            />

            <button type="submit" className={styles.submit}>
              {t("auth.createAccount")}
            </button>
          </form>

          <div className={styles.inlineSwitchNote}>
            <span>{t("auth.alreadyHaveAccount")}</span>
            <button type="button" className={styles.inlineSwitchButton} onClick={() => setTab("login")}>
              {t("auth.signIn")}
            </button>
          </div>
        </section>
      </div>

      <div className={styles.publicLinks}>
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

      <div id="client-forgot-password-modal" className={styles.modalWrap} aria-hidden="true">
        <a href="#" className={styles.modalBackdrop} aria-label={t("common.close")} />
        <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="client-forgot-password-title">
          <div className={styles.modalHeader}>
            <h3 id="client-forgot-password-title" className={styles.modalTitle}>{t("auth.forgotPassword")}</h3>
            <a href="#" className={styles.modalClose} aria-label={t("common.close")}>×</a>
          </div>
          <form method="post" action="/api/client/auth/forgot-password" className={styles.resetForm}>
            <label className={styles.field}>
              <span>{t("auth.resetClientPassword")}</span>
              <input name="email" type="email" required placeholder={t("auth.emailPlaceholder")} autoComplete="email" />
            </label>
            <p className={styles.modalText}>{t("auth.resetClientPasswordDesc")}</p>
            <button type="submit" className={styles.resetBtn}>{t("auth.sendResetLink")}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
