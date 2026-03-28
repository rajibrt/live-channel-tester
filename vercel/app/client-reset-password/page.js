import styles from "../login/page.module.css";
import { getDictionaryForRequest } from "../../lib/i18n/server";
import ClientResetPasswordForm from "./ClientResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ClientResetPasswordPage() {
  const { t } = await getDictionaryForRequest();
  const copy = {
    tag: t("auth.forgotPassword"),
    title: t("auth.resetClientPassword"),
    intro: t("auth.resetClientPasswordDesc"),
    validating: "Validating reset link...",
    invalid: t("auth.resetClientInvalid"),
    passwordMin: "Password must be at least 8 characters.",
    passwordMismatch: "Passwords do not match.",
    updateFailed: "Could not update password. Try requesting a fresh reset link.",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    submit: "Update Password",
    updating: "Updating...",
    back: t("auth.clientLogin"),
  };

  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>{t("auth.forgotPassword")}</p>
          <h1 className={styles.visualTitle}>{t("auth.resetClientPassword")}</h1>
          <p className={styles.visualText}>{t("auth.resetClientPasswordDesc")}</p>
        </div>
      </section>
      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <p className={styles.formTag}>{copy.tag}</p>
          <h2 className={styles.formTitle}>{copy.title}</h2>
          <p className={styles.formText}>{copy.intro}</p>
          <ClientResetPasswordForm copy={copy} />
        </div>
      </section>
    </main>
  );
}
