import styles from "../page.module.css";
import LocalAgentPanel from "../LocalAgentPanel";

export default function LocalCheckPage() {
  return (
    <section className={styles.card}>
      <h2>Local IP / ISP Stream Check</h2>
      <p className={styles.hint}>
        Use your local agent IP to test stream availability from your own network route.
      </p>
      <LocalAgentPanel defaultAgentBaseUrl={process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:8787"} />
    </section>
  );
}
