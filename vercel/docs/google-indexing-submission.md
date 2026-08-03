# Google Indexing and AdSense Resubmission Handoff

Use this checklist after the public editorial release is live. The code-side checks can be repeated from `vercel/` with:

```bash
npm run audit:public
```

The audit must finish with `Failures: 0` before requesting review.

## 1. Search Console property

- Open the canonical `https://webtvbd.com/` property. A Domain property is preferable when DNS ownership is available because it covers protocol and subdomain variants.
- Confirm that no manual action or security issue is reported.
- In **Sitemaps**, submit `https://webtvbd.com/sitemap.xml` again and confirm that Google can fetch it.
- Do not submit legacy article URLs. They permanently redirect to the rewritten canonical pages and should disappear after recrawling.

## 2. URL Inspection priority

Run **Test live URL** and then **Request indexing** for these URLs in this order:

1. `https://webtvbd.com/`
2. `https://webtvbd.com/articles`
3. `https://webtvbd.com/articles/স্মুথ-ভিডিও-স্ট্রিমিংয়ের-জন্য-wi-fi-ও-ইন্টারনেট-ঠিক-করার-গাইড-a17c9401`
4. `https://webtvbd.com/articles/ফোন-বা-ল্যাপটপ-থেকে-tv-তে-ভিডিও-দেখবেন-যেভাবে-b28d0512`
5. `https://webtvbd.com/articles/smart-tv-ও-home-network-নিরাপদ-রাখার-ব্যবহারিক-checklist-c39e1623`
6. `https://webtvbd.com/articles/পরিবারের-জন্য-নিরাপদ-screen-time-ও-video-viewing-পরিকল্পনা-d4af2734`
7. `https://webtvbd.com/articles/ব্রেকিং-নিউজের-ভিডিও-ও-ছবি-শেয়ার-করার-আগে-যাচাই-করুন-e5b03845`

For each inspected URL, confirm:

- Page fetch: successful
- Indexing allowed: yes
- User-declared canonical: the inspected URL
- No unexpected Google-selected canonical after Google recrawls it
- Article structured data is detected on article pages

Google does not guarantee immediate indexing. Allow at least a week after sitemap submission or an indexing request before treating a missing page as a technical failure.

## 3. AdSense readiness

- In AdSense **Sites**, confirm that `webtvbd.com` ownership remains verified.
- Wait until the **ads.txt** status recognizes the authorized publisher record from `https://webtvbd.com/ads.txt`.
- Review **Policy center** for account-level or site-level issues beyond low-value content.
- Configure the required Google-certified consent-management message in **Privacy & messaging** for regions where Google requires it. The site's local preference banner is not a substitute for an AdSense-certified CMP.
- Request an AdSense site review only after Google has recrawled the homepage, article hub, and a useful sample of the rewritten/new articles.

## 4. Evidence to retain

- Screenshot of the successful sitemap status and discovery count.
- URL Inspection result for the homepage, article hub, and at least two new articles.
- Screenshot of the AdSense ads.txt status.
- Date the AdSense review was requested and the exact response email.

Official references:

- [Google Search Console URL Inspection](https://support.google.com/webmasters/answer/12482179?hl=en)
- [Google Page indexing report](https://support.google.com/webmasters/answer/7440203?hl=en)
- [Google guidance for pages missing from Search](https://support.google.com/webmasters/answer/7474347?hl=en)
