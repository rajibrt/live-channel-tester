import styles from "./page.module.css";

export default function LoginPage() {
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

          <form method="post" action="/api/auth/login" className={styles.form}>
            <label className={styles.field}>
              <span>Email Address</span>
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>

            <label className={styles.field}>
              <span>Password</span>
              <input name="password" type="password" required placeholder="Enter your password" />
            </label>

            <div className={styles.row}>
              <label className={styles.checkbox}>
                <input type="checkbox" name="remember" />
                <span>Remember me</span>
              </label>
              <a href="#" className={styles.link}>Forgot password?</a>
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
        </div>
      </section>
    </main>
  );
}
