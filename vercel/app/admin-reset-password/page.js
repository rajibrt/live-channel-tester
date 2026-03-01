import styles from "../login/page.module.css";
import AdminResetPasswordForm from "./AdminResetPasswordForm";

export const dynamic = "force-dynamic";

export default function AdminResetPasswordPage() {
  return (
    <main className={styles.page}>
      <section className={styles.visualPane}>
        <div className={styles.visualGlow} />
        <div className={styles.visualCopy}>
          <p className={styles.visualTag}>Secure Recovery</p>
          <h1 className={styles.visualTitle}>Reset Admin Password</h1>
          <p className={styles.visualText}>
            Enter a new password to complete your admin account recovery and return to dashboard access.
          </p>
        </div>
      </section>
      <section className={styles.formPane}>
        <div className={styles.formShell}>
          <p className={styles.formTag}>Password Reset</p>
          <h2 className={styles.formTitle}>Create New Password</h2>
          <p className={styles.formText}>Use at least 8 characters. Then sign in from the admin login page.</p>
          <AdminResetPasswordForm />
        </div>
      </section>
    </main>
  );
}
