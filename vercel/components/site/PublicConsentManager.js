"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import PublicAdSenseScript from "../ads/PublicAdSenseScript";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

const CONSENT_KEY = "iptv:v1:cookie-consent";

export default function PublicConsentManager({ enableAds = false }) {
  const { t } = useI18n();
  const [consent, setConsent] = useState("loading");

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    setConsent(stored === "accepted" || stored === "declined" ? stored : "unknown");
  }, []);

  function saveConsent(nextConsent) {
    window.localStorage.setItem(CONSENT_KEY, nextConsent);
    setConsent(nextConsent);
  }

  return (
    <>
      {consent === "accepted" ? (
        <>
          {enableAds ? <PublicAdSenseScript /> : null}
          <Script id="statcounter-config" strategy="afterInteractive">
            {`window.sc_project=12383019;window.sc_invisible=1;window.sc_security="596c1a94";`}
          </Script>
          <Script id="statcounter-loader" src="https://www.statcounter.com/counter/counter.js" strategy="lazyOnload" />
        </>
      ) : null}
      {consent === "unknown" ? (
        <section className={styles.publicConsent} role="dialog" aria-live="polite" aria-label={t("publicSite.consentTitle")}>
          <div>
            <strong>{t("publicSite.consentTitle")}</strong>
            <p>{t("publicSite.consentBody")} <Link href="/cookie-policy">{t("publicSite.cookiePolicy")}</Link></p>
          </div>
          <div className={styles.publicConsentActions}>
            <button type="button" className={styles.secondaryLink} onClick={() => saveConsent("declined")}>
              {t("publicSite.consentDecline")}
            </button>
            <button type="button" className={styles.primaryLink} onClick={() => saveConsent("accepted")}>
              {t("publicSite.consentAccept")}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
