import styles from "../page.module.css";
import AdminHeader from "../AdminHeader";
import LocalAgentPanel from "../LocalAgentPanel";

export default function LocalCheckPage() {
  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />
      <section className={styles.shell}>
        <AdminHeader
          title="Local Check"
          subtitle="Run local IP/ISP stream checks with realtime counters and preview."
        />

        <section className={styles.card}>
          <h2>Local IP / ISP Stream Check</h2>
          <p className={styles.hint}>
            Use your local agent IP to test stream availability from your own network route.
          </p>
          <LocalAgentPanel defaultAgentBaseUrl={process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:8787"} />
        </section>
      </section>
    </main>
  );
}
