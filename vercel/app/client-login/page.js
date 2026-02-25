import Image from "next/image";
import styles from "../login/page.module.css";
import { getCurrentClient } from "../../lib/clientAuth";
import { redirect } from "next/navigation";
import PasswordField from "../../components/auth/PasswordField";

export default async function ClientLoginPage({ searchParams }) {
  const current = await getCurrentClient();
  if (current) redirect("/");

  const params = await searchParams;
  const hasError = Boolean(params?.error);

  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <div className={styles.visualBrand}>
          <Image
            src="/logo.png"
            alt="WEBTV BD logo"
            width={416}
            height={130}
            className={styles.visualBrandLogoFull}
            priority
          />
          <p className={styles.visualBrandSlogan}>TV Beyond Borders</p>
        </div>
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>Client Access</p>
          <h1 className={styles.visualTitle}>StreamTV Viewer Portal</h1>
          <p className={styles.visualText}>
            Login is required to view channels. Your favorites, recent history, and viewing activity are synced securely.
          </p>
        </div>
      </section>

      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <p className={styles.formTag}>Sign In</p>
          <h2 className={styles.formTitle}>Client Login</h2>
          <p className={styles.formText}>Use email or registered mobile last 11 digits with password.</p>

          {hasError ? (
            <p className={`${styles.note} ${styles.errorNote}`} role="alert">
              Login failed. Please check your credentials and try again.
            </p>
          ) : null}

          <form method="post" action="/api/client/auth/login" className={styles.form}>
            <label className={styles.field}>
              <span>Email or Mobile (last 11 digits)</span>
              <input
                name="identifier"
                type="text"
                required
                placeholder="client@example.com or 01XXXXXXXXX"
                autoComplete="username"
              />
            </label>

            <PasswordField styles={styles} />

            <button type="submit" className={styles.submit}>Sign In</button>
          </form>
        </div>
      </section>
    </main>
  );
}
