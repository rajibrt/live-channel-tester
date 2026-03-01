import styles from "./page.module.css";
import PasswordField from "../../components/auth/PasswordField";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const hasError = Boolean(params?.error);
  const resetState = String(params?.reset || "").trim().toLowerCase();
  const hasResetInfo = resetState === "sent" || resetState === "updated" || resetState === "invalid";
  const resetMessage =
    resetState === "sent"
      ? "If the email exists, a password reset link has been sent."
      : resetState === "updated"
        ? "Password updated. Please sign in with your new password."
        : resetState === "invalid"
          ? "Reset link is invalid or expired. Request a new one."
          : "";

  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>Welcome Back</p>
          <h1 className={styles.visualTitle}>M3U Admin Console</h1>
          <p className={styles.visualText}>
            Securely manage playlists, channels, and permanent token URLs from one panel.
          </p>
        </div>
      </section>

      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <p className={styles.formTag}>Sign In</p>
          <h2 className={styles.formTitle}>Access Dashboard</h2>
          <p className={styles.formText}>Use your admin credentials to continue.</p>

          {hasError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              Login failed. Please check your credentials and try again.
            </p>
          ) : null}
          {hasResetInfo ? (
            <p className={`${styles.note} ${resetState === "invalid" ? styles.errorNote : styles.successNote}`} role="status">
              {resetMessage}
            </p>
          ) : null}

          <form method="post" action="/api/auth/login" className={styles.form}>
            <label className={styles.field}>
              <span>Email Address</span>
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>

            <PasswordField styles={styles} />

            <div className={styles.row}>
              <label className={styles.checkbox}>
                <input type="checkbox" name="remember" />
                <span>Remember me</span>
              </label>
              <a href="#admin-reset-form" className={styles.link}>Forgot password?</a>
            </div>

            <button type="submit" className={styles.submit}>Sign In</button>
          </form>

          <div className={styles.divider}>Or continue with</div>
          <div className={styles.socials}>
            <button type="button" className={styles.socialBtn}>Google</button>
            <button type="button" className={styles.socialBtn}>Facebook</button>
          </div>

          <p className={styles.note}>
            Access is restricted to users listed in <code>admin_users</code>.
          </p>
          <form id="admin-reset-form" method="post" action="/api/auth/forgot-password" className={styles.resetForm}>
            <label className={styles.field}>
              <span>Reset admin password via email</span>
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            <button type="submit" className={styles.resetBtn}>Send Reset Link</button>
          </form>
        </div>
      </section>
    </main>
  );
}
