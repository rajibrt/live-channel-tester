import { toAbsoluteUrl } from "./siteUrl";

function buildGuide({
  slug,
  title,
  description,
  publishedAt,
  updatedAt,
  readingMinutes,
  html,
  featuredImageUrl = "",
}) {
  return {
    id: `guide-${slug}`,
    source: "builtin",
    slug,
    title,
    description,
    excerpt: description,
    publishedAt,
    updatedAt,
    readingMinutes,
    html,
    featuredImageUrl,
    path: `/articles/${slug}`,
    canonicalUrl: toAbsoluteUrl(`/articles/${slug}`),
  };
}

export const EDITORIAL_GUIDES = [
  buildGuide({
    slug: "how-webtvbd-organizes-live-tv-for-faster-discovery",
    title: "How WEBTVBD organizes live TV for faster discovery",
    description:
      "An overview of how WEBTVBD groups channels, reduces clutter, and helps viewers reach relevant live TV destinations faster.",
    publishedAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-28T09:30:00.000Z",
    readingMinutes: 4,
    featuredImageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    html: `
      <p>WEBTVBD is structured around a simple idea: viewers should be able to understand what is available before they commit to opening a stream. Many streaming directories bury useful information behind crowded layouts, repeated thumbnails, or dead-end navigation. WEBTVBD is designed to avoid that pattern.</p>
      <p>On the public side, the site explains what the platform is, how access works, and where visitors can find legal, privacy, and policy information. Inside the signed-in experience, channels are grouped by category so returning viewers can reach the right area quickly instead of scanning a flat list every time they open the platform.</p>
      <h2>Why channel grouping matters</h2>
      <p>Live TV viewers usually arrive with intent. They may already know they want news, sports, movies, regional channels, or general entertainment. A well-organized catalog reduces search friction and helps viewers move from browsing to playback with fewer clicks.</p>
      <ul>
        <li>Clear categories help viewers narrow the catalog faster.</li>
        <li>Favorites and recent history reduce repeat navigation.</li>
        <li>A lightweight layout helps lower-powered devices stay usable.</li>
      </ul>
      <h2>What WEBTVBD tries to avoid</h2>
      <p>The platform is intentionally not built as an infinite wall of noisy widgets. Public information pages, contact paths, and policy pages are kept visible so both visitors and reviewers can understand the purpose of the site. This makes the experience easier to evaluate and easier to trust.</p>
      <p>That editorial clarity is important. A streaming website should not feel like a blank utility shell. It should explain who it serves, how content is organized, and what a viewer can expect before logging in or requesting access.</p>
      <h2>Practical value for viewers</h2>
      <p>When channel organization is done properly, the main value is time saved. Viewers can scan fewer options, return to previously opened channels faster, and avoid repetitive searching across separate parts of the interface. That is the core role WEBTVBD is meant to play.</p>
    `,
  }),
  buildGuide({
    slug: "what-to-check-before-opening-a-live-stream",
    title: "What to check before opening a live stream",
    description:
      "A practical checklist for viewers who want to avoid dead links, poor playback conditions, and misleading streaming pages.",
    publishedAt: "2026-03-21T07:30:00.000Z",
    updatedAt: "2026-03-28T09:00:00.000Z",
    readingMinutes: 5,
    featuredImageUrl: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=1200&q=80",
    html: `
      <p>Opening a live stream is rarely just about pressing play. Viewers usually care about reliability, device compatibility, and whether the page they are visiting looks trustworthy. A small amount of pre-checking can save a lot of frustration, especially on mobile data or lower-end devices.</p>
      <h2>Start with page quality</h2>
      <p>A useful streaming page should have clear navigation, working support links, visible policy pages, and enough context to explain what the site does. If a site only shows a player shell, thin navigation, or aggressive ad placement with no meaningful information, that is usually a bad sign.</p>
      <h2>Check the basics before playback</h2>
      <ol>
        <li>Confirm that the page is not an error state, login trap, or placeholder screen.</li>
        <li>Look for visible contact, privacy, and terms information.</li>
        <li>Make sure the page still works on mobile without layout breakage.</li>
        <li>Review whether the catalog appears organized and actively maintained.</li>
      </ol>
      <h2>Understand the viewing environment</h2>
      <p>Playback quality can change for reasons beyond the viewer interface. Upstream source quality, temporary outages, regional restrictions, bandwidth limits, and codec support all affect the final result. A responsible streaming platform should make that reality clear instead of pretending every stream is always perfect.</p>
      <p>Viewers also benefit from simple continuity tools such as favorites, recent items, and continue-watching markers. Those features do not replace stream quality, but they make recovery easier when a session is interrupted.</p>
      <h2>Why this matters on WEBTVBD</h2>
      <p>WEBTVBD separates public site information from the signed-in viewer portal so the website can explain itself properly before playback starts. That separation helps visitors evaluate the platform, understand the access model, and see the surrounding support and policy information instead of landing on a context-free player screen.</p>
    `,
  }),
  buildGuide({
    slug: "why-trust-pages-matter-on-a-streaming-website",
    title: "Why trust pages matter on a streaming website",
    description:
      "Why public pages like About, Contact, Privacy, Terms, Cookie Policy, and DMCA guidance improve transparency for visitors and reviewers.",
    publishedAt: "2026-03-23T06:45:00.000Z",
    updatedAt: "2026-03-28T08:40:00.000Z",
    readingMinutes: 4,
    featuredImageUrl: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
    html: `
      <p>Trust signals are not decorative extras. On a streaming website, public trust pages help visitors understand who operates the site, how support requests are handled, what happens to account data, and where rights-related concerns can be reported.</p>
      <h2>The minimum public information a serious site should expose</h2>
      <ul>
        <li>An About page that explains the purpose of the platform.</li>
        <li>A Contact page with a real support route.</li>
        <li>A Privacy Policy describing data handling and cookies.</li>
        <li>Terms of Use explaining acceptable use and account responsibilities.</li>
        <li>A DMCA or rights notice path for complaints and removals.</li>
      </ul>
      <p>Without these pages, a site often feels temporary or incomplete. That is bad for users, bad for search quality, and bad for ad-review systems that look for signs of a legitimate publisher presence.</p>
      <h2>Transparency supports long-term usability</h2>
      <p>Public pages also reduce confusion. When a visitor knows how to ask for help, how cookies are used, or where to send a rights notice, the platform feels more predictable. Predictability is one of the strongest forms of trust a website can offer.</p>
      <p>For WEBTVBD, these pages are part of the product itself. They help search engines understand the site, help reviewers evaluate it, and help visitors decide whether they want to move into the signed-in viewer experience.</p>
    `,
  }),
  buildGuide({
    slug: "building-a-better-homepage-for-live-tv-viewers",
    title: "Building a better homepage for live TV viewers",
    description:
      "What a streaming homepage should communicate before asking viewers to sign in or start watching.",
    publishedAt: "2026-03-24T10:15:00.000Z",
    updatedAt: "2026-03-28T10:00:00.000Z",
    readingMinutes: 5,
    featuredImageUrl: "https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=1200&q=80",
    html: `
      <p>A streaming homepage has one job before anything else: explain the value of the site clearly. If the homepage is only a login prompt or a blank shell with navigation chrome, visitors do not learn enough to decide whether the site is useful to them.</p>
      <h2>What a homepage should answer immediately</h2>
      <ol>
        <li>What is this website for?</li>
        <li>Who is it designed to help?</li>
        <li>How is the content organized?</li>
        <li>Where can visitors find trust and policy information?</li>
        <li>What should a new user do next?</li>
      </ol>
      <p>When those answers are visible, the site becomes easier to review and easier to understand. This is especially important for services built around discovery, curation, and repeated use.</p>
      <h2>Editorial content turns a thin landing page into a real website</h2>
      <p>Publisher-style content adds depth. Articles, guides, explainers, and maintenance updates show that the site is active and curated. They also provide more entry points for search and make the site feel less like a single-purpose utility screen.</p>
      <p>That is why WEBTVBD now treats the homepage as a public-facing editorial and trust layer, not just a gate before sign-in. Visitors can read guides, learn about the platform, and reach important support pages before they decide to continue.</p>
    `,
  }),
];
