"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import PasswordField from "../../components/auth/PasswordField";
import PublicLocaleToggle from "../../components/site/PublicLocaleToggle";
import { useI18n } from "../../components/i18n/LanguageProvider";
import styles from "../login/page.module.css";
import FacebookHashHandler from "./FacebookHashHandler";

const SIGNUP_DRAFT_KEY = "webtvbd_client_signup_draft";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobileKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 11 ? digits.slice(-11) : "";
}

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
  registerErrorCode = "",
  registerErrorMessage = "",
  turnstileSiteKey = "",
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState(initialTab === "signup" ? "signup" : "login");
  const [signupValues, setSignupValues] = useState({ full_name: "", email: "", mobile_number: "" });
  const [clientRegisterError, setClientRegisterError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const hasTurnstile = Boolean(String(turnstileSiteKey || "").trim());
  const activeRegisterErrorMessage = clientRegisterError
    ? clientRegisterError === "password_mismatch"
      ? t("settings.passwordMismatch")
      : clientRegisterError === "robot_check"
        ? t("auth.registerRobotCheckFailed")
        : t("auth.registerInvalid")
    : registerErrorMessage;

  useEffect(() => {
    setTab(initialTab === "signup" ? "signup" : "login");
  }, [initialTab]);

  useEffect(() => {
    if (!registered) return;
    try {
      window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    } catch {
      // ignore storage failures
    }
  }, [registered]);

  useEffect(() => {
    if (!hasRegisterError) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(SIGNUP_DRAFT_KEY) || "{}");
      const next = {
        full_name: String(saved.full_name || ""),
        email: String(saved.email || ""),
        mobile_number: String(saved.mobile_number || ""),
      };
      setSignupValues(next);
      setFieldErrors(getServerFieldErrors(registerErrorCode, next));
    } catch {
      setFieldErrors(getServerFieldErrors(registerErrorCode, signupValues));
    }
  }, [hasRegisterError, registerErrorCode]);

  function getServerFieldErrors(code, values) {
    if (code === "email_exists") return { email: t("auth.registerEmailExists") };
    if (code === "mobile_exists") return { mobile_number: t("auth.registerMobileExists") };
    if (code === "password_mismatch") return { password: t("settings.passwordMismatch"), confirm_password: t("settings.passwordMismatch") };
    if (code === "robot_check") return { turnstile: t("auth.registerRobotCheckFailed") };
    if (code !== "invalid") return {};

    const errors = {};
    if (!String(values?.full_name || "").trim()) errors.full_name = t("auth.fullNameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(values?.email))) errors.email = t("auth.emailInvalid");
    if (!normalizeMobileKey(values?.mobile_number)) errors.mobile_number = t("auth.mobileInvalid");
    errors.password = t("auth.passwordTooShort");
    return errors;
  }

  function updateSignupValue(name, value) {
    setSignupValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (clientRegisterError) setClientRegisterError("");
  }

  function persistSignupDraft(values) {
    try {
      window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(values));
    } catch {
      // ignore storage failures
    }
  }

  function handleSignupSubmit(event) {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = {
      full_name: String(formData.get("full_name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      mobile_number: String(formData.get("mobile_number") || "").trim(),
    };
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");
    const turnstileToken = String(formData.get("cf-turnstile-response") || "").trim();
    const nextErrors = {};

    if (!values.full_name) nextErrors.full_name = t("auth.fullNameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(values.email))) nextErrors.email = t("auth.emailInvalid");
    if (!normalizeMobileKey(values.mobile_number)) nextErrors.mobile_number = t("auth.mobileInvalid");
    if (password.length < 8) nextErrors.password = t("auth.passwordTooShort");
    if (password && confirmPassword && password !== confirmPassword) {
      nextErrors.password = t("settings.passwordMismatch");
      nextErrors.confirm_password = t("settings.passwordMismatch");
    }
    if (hasTurnstile && !turnstileToken) nextErrors.turnstile = t("auth.registerRobotCheckFailed");

    persistSignupDraft(values);
    if (!Object.keys(nextErrors).length) return;

    event.preventDefault();
    setSignupValues(values);
    setFieldErrors(nextErrors);
    setClientRegisterError(nextErrors.turnstile ? "robot_check" : nextErrors.confirm_password ? "password_mismatch" : "invalid");
  }

  return (
    <div className={styles.formShellWrap}>
      <div className={styles.formHeaderRow}>
        <PublicLocaleToggle className={styles.localeToggleBtn} />
      </div>
      <div className={styles.formShell}>
        <FacebookHashHandler />
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

            {hasRegisterError || clientRegisterError ? (
              <p className={`${styles.note} ${styles.errorNote}`} role="alert">
                {activeRegisterErrorMessage}
              </p>
            ) : null}

            <form method="post" action="/api/client/auth/register" className={styles.form} autoComplete="off" onSubmit={handleSignupSubmit} noValidate>
              <label className={styles.honeypotField} aria-hidden="true">
                <span>Leave this field empty</span>
                <input
                  name="signup_extra_check"
                  type="text"
                  tabIndex={-1}
                  autoComplete="new-password"
                />
              </label>
              <label className={`${styles.field} ${fieldErrors.full_name ? styles.fieldInvalid : ""}`}>
                <span>{t("common.fullName")}</span>
                <input
                  name="full_name"
                  type="text"
                  required
                  placeholder={t("auth.fullNamePlaceholder")}
                  autoComplete="name"
                  value={signupValues.full_name}
                  onChange={(event) => updateSignupValue("full_name", event.target.value)}
                  aria-invalid={fieldErrors.full_name ? "true" : "false"}
                />
                {fieldErrors.full_name ? <span className={styles.fieldHelp}>{fieldErrors.full_name}</span> : null}
              </label>
              <label className={`${styles.field} ${fieldErrors.email ? styles.fieldInvalid : ""}`}>
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
                  value={signupValues.email}
                  onChange={(event) => updateSignupValue("email", event.target.value)}
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                />
                {fieldErrors.email ? <span className={styles.fieldHelp}>{fieldErrors.email}</span> : null}
              </label>
              <label className={`${styles.field} ${fieldErrors.mobile_number ? styles.fieldInvalid : ""}`}>
                <span>{t("auth.mobileNumber")}</span>
                <input
                  name="mobile_number"
                  type="tel"
                  required
                  placeholder={t("auth.mobileNumberPlaceholder")}
                  autoComplete="tel"
                  inputMode="numeric"
                  value={signupValues.mobile_number}
                  onChange={(event) => updateSignupValue("mobile_number", event.target.value)}
                  aria-invalid={fieldErrors.mobile_number ? "true" : "false"}
                />
                {fieldErrors.mobile_number ? <span className={styles.fieldHelp}>{fieldErrors.mobile_number}</span> : null}
              </label>
              <PasswordField
                styles={styles}
                autoComplete="new-password"
                label={t("settings.password")}
                placeholder={t("auth.createPasswordPlaceholder")}
                showLabel={t("settings.showPassword")}
                hideLabel={t("settings.hidePassword")}
                invalid={Boolean(fieldErrors.password)}
                helpText={fieldErrors.password || ""}
              />
              <PasswordField
                styles={styles}
                name="confirm_password"
                autoComplete="new-password"
                label={t("settings.confirmPassword")}
                placeholder={t("settings.repeatPassword")}
                showLabel={t("settings.showPassword")}
                hideLabel={t("settings.hidePassword")}
                invalid={Boolean(fieldErrors.confirm_password)}
                helpText={fieldErrors.confirm_password || ""}
              />

              {hasTurnstile ? (
                <>
                  <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                    strategy="afterInteractive"
                  />
                  <div className={`${styles.turnstileWrap} ${fieldErrors.turnstile ? styles.turnstileInvalid : ""}`}>
                    <div
                      className="cf-turnstile"
                      data-sitekey={turnstileSiteKey}
                      data-theme="light"
                    />
                  </div>
                  {fieldErrors.turnstile ? <span className={styles.fieldHelp}>{fieldErrors.turnstile}</span> : null}
                </>
              ) : null}

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
