import Link from "next/link";
import styles from "./public-pages.module.css";

export default function PublicInfoPage({
  eyebrow = "WEBTVBD",
  title,
  intro,
  sections = [],
  actions = [],
  notice = null,
}) {
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {intro ? <p className={styles.intro}>{intro}</p> : null}
          {actions.length ? (
            <div className={styles.actions}>
              {actions.map((action) => {
                const className = action.variant === "secondary" ? styles.secondaryLink : styles.primaryLink;
                return (
                  <Link key={`${action.href}-${action.label}`} href={action.href} className={className}>
                    {action.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </header>
        <div className={styles.body}>
          {notice ? (
            <section className={styles.noticeBox}>
              {notice.title ? <p className={styles.noticeTitle}>{notice.title}</p> : null}
              <p className={styles.noticeText}>{notice.body}</p>
            </section>
          ) : null}
          {sections.map((section) => {
            if (section.type === "grid") {
              return (
                <section key={section.title} className={styles.section}>
                  <h2>{section.title}</h2>
                  <div className={styles.grid}>
                    {(section.items || []).map((item) => (
                      <article key={item.title} className={styles.infoCard}>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.type === "list") {
              return (
                <section key={section.title} className={styles.section}>
                  <h2>{section.title}</h2>
                  <ul>
                    {(section.items || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              );
            }

            return (
              <section key={section.title} className={styles.section}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            );
          })}
        </div>
      </article>
    </main>
  );
}
