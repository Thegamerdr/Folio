interface Env {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

const PRIMARY_HOST = 'melo-money.com';
const ALIAS_HOSTS = new Set(['www.melo-money.com', 'melomoney.uk', 'www.melomoney.uk']);

const SITE_ORIGIN = `https://${PRIMARY_HOST}`;
const SUPPORT_EMAIL = 'support@melo-money.com';

type PageKey = 'home' | 'open' | 'privacy' | 'support' | 'terms' | 'delete-account' | 'security';

type Page = {
  description: string;
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  content: string;
};

const pages: Record<PageKey, Page> = {
  home: {
    description:
      'A calm forward view of your money, shaped around what you are actually trying to do.',
    eyebrow: 'Melo · UK money companion',
    title: 'Will my money last to',
    accent: 'payday?',
    body: "A calm forward view of your money — shaped around what you're actually trying to do. Not a budget. Not a tracker. You'll still know exactly where every number came from.",
    content: `
      <section class="proof" id="how" aria-labelledby="how-title">
        <p class="section-kicker">How Melo helps</p>
        <h2 id="how-title">A clearer view, without the noise.</h2>
        <div class="proof-grid">
          <article>
            <span aria-hidden="true">01</span>
            <h3>Look ahead.</h3>
            <p>See what today can carry without losing sight of payday, bills, or the things you set aside.</p>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <h3>Check the numbers.</h3>
            <p>Every amount stays visible and traceable. Nothing counts until you confirm it.</p>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <h3>Choose the next move.</h3>
            <p>Melo can suggest a quiet next step. You stay in control, and no move happens silently.</p>
          </article>
        </div>
      </section>
      <section class="closing" aria-labelledby="closing-title">
        <div>
          <p class="section-kicker">Release status</p>
          <h2 id="closing-title">The app is being prepared for release.</h2>
        </div>
        <a class="button button-secondary" href="/support">Contact support</a>
      </section>
    `,
  },
  open: {
    description: 'Open Melo on this device.',
    eyebrow: 'Open Melo',
    title: 'Continue in the',
    accent: 'app.',
    body: 'If Melo is installed on this device, the button below will open it. Public store listings are still being prepared.',
    content: `
      <section class="single-action" aria-label="Open the Melo app">
        <a class="button button-primary" href="melo://">Open Melo</a>
        <p>Nothing happened? Melo may not be installed on this device yet.</p>
      </section>
    `,
  },
  privacy: {
    description: 'How Melo handles local money data, optional connected services and your rights.',
    eyebrow: 'Privacy',
    title: 'Your money stays',
    accent: 'yours.',
    body: 'Melo is local-first. This notice explains what stays on your device, what can leave it when you choose a connected feature, and the controls available to you.',
    content: `
      <section class="legal-note legal-copy" aria-labelledby="privacy-controller">
        <p class="section-kicker">Last updated 19 July 2026</p>
        <h2 id="privacy-controller">Who is responsible</h2>
        <p>Melo is an independently operated UK personal-finance app. Melo is the controller for data processed through its optional online services. Contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> for privacy questions or rights requests.</p>

        <h2>What stays on your device</h2>
        <p>Balances, accounts, transactions, bills, subscriptions, pots, plans, debts, settings, review state, retained statement sources and Melo memory are kept in encrypted local storage. Statement reading and the shipping Melo companion run on the device. Imported rows remain candidates until you confirm them.</p>

        <h2>When data can leave your device</h2>
        <ul>
          <li><strong>Crash diagnostics:</strong> Sentry can receive a scrubbed technical crash event. Melo removes user, request, free-text extra and breadcrumb fields; screenshots, view hierarchy, session replay, performance tracing and default personal-data collection are disabled.</li>
          <li><strong>Optional sign-in and encrypted backup:</strong> the identity provider processes the identifier and session data needed to sign in. Backup content is encrypted on the device before it reaches Melo's Cloudflare service.</li>
          <li><strong>Purchases:</strong> Google Play or Apple processes payment. Melo receives a product identifier and purchase proof needed to verify and restore access, not card details.</li>
          <li><strong>Optional Open Banking:</strong> if activated and you explicitly connect a bank, the regulated provider processes the account information covered by your consent. Provider credentials do not live in the app and imported rows still require review.</li>
        </ul>

        <h2>Purposes and legal bases</h2>
        <p>Connected-service data is used to provide the feature you request, secure and restore access, verify purchases, diagnose faults and meet legal obligations. Depending on the feature, the legal basis is performance of the service you requested, legitimate interests in security and reliability, consent where required, or a legal obligation.</p>

        <h2>Retention and deletion</h2>
        <p>Local data remains until you export, remove or clear it. Crash events follow the configured diagnostic retention period. Optional cloud data remains until you delete the account or backup, subject to short operational backups and legal obligations. Melo does not sell data or use it for advertising or behavioural profiling.</p>

        <h2>Your choices and rights</h2>
        <p>You can use Melo's personal core without an account, export your data, remove retained sources, clear local data, disconnect connected services and request account deletion. UK users can also ask for access, correction, restriction, objection, portability or deletion and may complain to the Information Commissioner's Office.</p>

        <h2>International processing and security</h2>
        <p>Some service providers may process technical or account data outside the UK. Melo requires an appropriate transfer mechanism where applicable. Melo uses encryption in transit and encrypted local or client-encrypted cloud storage, but no system can promise absolute security.</p>

        <h2>Children and changes</h2>
        <p>Melo is intended for people aged 18 and over. This notice will be updated when a material data flow changes; the date above identifies the current version.</p>
      </section>
    `,
  },
  terms: {
    description: 'Terms for using the Melo personal-finance app and connected services.',
    eyebrow: 'Terms',
    title: 'Calm tools, clear',
    accent: 'boundaries.',
    body: 'These terms describe the rules for using Melo. They do not replace professional financial, tax, legal or debt advice.',
    content: `
      <section class="legal-note legal-copy" aria-labelledby="terms-service">
        <p class="section-kicker">Last updated 19 July 2026</p>
        <h2 id="terms-service">The service</h2>
        <p>Melo helps you organise user-provided financial information, look ahead and explore possible changes. It does not hold money, initiate payments, recommend regulated products, file taxes or make decisions for you. Forecasts and tax estimates depend on the information available and may be incomplete or wrong.</p>

        <h2>Your responsibilities</h2>
        <p>You must be at least 18, use Melo lawfully, review imported information before confirming it and check important figures against original records or an appropriately qualified professional. Keep your device, store account, recovery material and sign-in methods secure.</p>

        <h2>Accounts and connected services</h2>
        <p>The personal core can be used without an account. Optional backup, purchase and provider features may require third-party terms. You can stop using a connected feature at any time; disconnecting it does not automatically erase local records you previously confirmed.</p>

        <h2>Purchases</h2>
        <p>Paid products, prices, renewal terms, cancellation and refunds are shown by the relevant app store before purchase. Store rules govern billing and refunds. Restoring a purchase may require the same store account used to buy it.</p>

        <h2>Availability and changes</h2>
        <p>Melo may change, suspend or withdraw features to protect users, comply with law or improve reliability. Reasonable care is taken, but uninterrupted or error-free availability is not guaranteed. Material changes to these terms will be identified by a new effective date.</p>

        <h2>Acceptable use and intellectual property</h2>
        <p>Do not misuse the service, bypass security, interfere with other users or use Melo to break the law. Melo's software, visual identity and original content remain protected by applicable intellectual-property law; your financial records remain yours.</p>

        <h2>Liability</h2>
        <p>Nothing in these terms excludes liability that cannot legally be excluded. To the extent permitted by law, Melo is not responsible for decisions made from unverified data, losses caused by third-party services, or indirect losses that were not reasonably foreseeable. Your statutory consumer rights are unaffected.</p>

        <h2>Ending use and contact</h2>
        <p>You can stop using Melo, clear local data and delete an optional account. Melo may restrict connected-service access for serious misuse or security risk while preserving lawful export and deletion rights where possible. Questions can be sent to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
      </section>
    `,
  },
  support: {
    description: 'Contact Melo support.',
    eyebrow: 'Support',
    title: 'We are here to',
    accent: 'help.',
    body: 'Melo is still in private preparation. If you are testing the app or have a question, email support.',
    content: `
      <section class="single-action" aria-label="Contact Melo support">
        <a class="button button-primary" href="mailto:${SUPPORT_EMAIL}">Email support</a>
        <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      </section>
    `,
  },
  'delete-account': {
    description: 'How to delete a Melo account and associated online data.',
    eyebrow: 'Account deletion',
    title: 'Delete what is',
    accent: 'connected.',
    body: 'Account deletion and clearing local money are separate choices. Melo will not silently erase local records when you delete an online account.',
    content: `
      <section class="legal-note legal-copy" aria-labelledby="delete-in-app">
        <h2 id="delete-in-app">Delete in the app</h2>
        <p>While signed in, open Account and choose <strong>Delete account &amp; cloud data</strong>. Melo first asks its backup and Open Banking services to purge account-scoped data, then asks the identity provider to delete the account. The action fails closed if the remote purge cannot be confirmed.</p>

        <h2>Request deletion on the web</h2>
        <p>Email <a href="mailto:${SUPPORT_EMAIL}?subject=Melo%20account%20deletion%20request">${SUPPORT_EMAIL}</a> from the address used for Melo and use the subject “Melo account deletion request”. Support will verify the request without asking for financial records, bank credentials or a recovery secret.</p>

        <h2>What deletion covers</h2>
        <p>The request covers the Melo identity, client-encrypted cloud-backup generations and Melo-held Open Banking connection identifiers or provider secrets. A bank's separate consent may need to be revoked in that bank's own app or website. Store purchase records remain with the app store under its retention rules.</p>

        <h2>Local data</h2>
        <p>Deleting an online account does not erase the encrypted money history on your phone. To remove that too, use Melo's separate multi-step <strong>Start fresh</strong> control. Export anything you want to keep first.</p>
      </section>
    `,
  },
  security: {
    description: 'Report a security or privacy vulnerability affecting Melo.',
    eyebrow: 'Security',
    title: 'Report something',
    accent: 'safely.',
    body: 'Good-faith security research helps protect Melo users. Please report suspected vulnerabilities without including real financial records.',
    content: `
      <section class="legal-note legal-copy" aria-labelledby="security-report">
        <h2 id="security-report">How to report</h2>
        <p>Email <a href="mailto:security@melo-money.com?subject=Melo%20security%20report">security@melo-money.com</a> with the affected surface, reproduction steps, impact and any non-sensitive proof. Expect acknowledgement within two UK business days.</p>

        <h2>Please do not send</h2>
        <p>Do not include real statements, transaction history, bank credentials, authentication tokens, encryption keys or a Melo recovery secret. Use synthetic data and redact screenshots or logs.</p>

        <h2>Good-faith research</h2>
        <p>Keep testing proportionate, avoid privacy violations or service disruption, do not access another person's data, and give Melo reasonable time to investigate before disclosure. Good-faith work following these boundaries will not be treated as malicious.</p>

        <h2>Useful report types</h2>
        <p>Reports may cover the mobile app, encrypted local storage, Cloudflare services, authentication, billing verification, public website, dependencies or a privacy-boundary failure. General support requests belong at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
      </section>
    `,
  },
};

const styles = `
  :root {
    --paper: #F6F4EE;
    --surface: #FBFAF5;
    --inset: #EFEDE5;
    --ink: #1B1815;
    --muted: #6A655C;
    --hairline: #E6E1D5;
    /* Accent is a surface tint and large display colour only. Never pair it with paper/white text. */
    --accent: #DC5E33;
    --accent-deep: #B84A24;
    --serif: Georgia, "Times New Roman", serif;
    --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  img { display: block; max-width: 100%; }
  a { color: var(--accent-deep); text-underline-offset: 0.2em; }
  a:hover { text-decoration-thickness: 2px; }
  a:focus-visible {
    outline: 3px solid var(--accent-deep);
    outline-offset: 4px;
    border-radius: 3px;
  }
  .skip-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 10;
    min-height: 44px;
    padding: 10px 16px;
    transform: translateY(-140%);
    background: var(--ink);
    color: var(--paper);
  }
  .skip-link:focus { transform: translateY(0); }
  .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 84px;
    border-bottom: 1px solid var(--hairline);
  }
  .brand {
    color: var(--ink);
    font-family: var(--serif);
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    text-decoration: none;
  }
  nav { display: flex; align-items: center; gap: 4px; }
  nav a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 13px;
    color: var(--muted);
    font-size: 0.92rem;
    font-weight: 650;
    text-decoration: none;
  }
  nav a:hover, nav a[aria-current="page"] { color: var(--ink); }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(290px, 0.88fr);
    gap: clamp(36px, 7vw, 96px);
    align-items: center;
    min-height: min(720px, calc(100vh - 84px));
    padding: 72px 0 88px;
  }
  .eyebrow, .section-kicker {
    margin: 0 0 18px;
    color: var(--muted);
    font-size: 0.76rem;
    font-weight: 760;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h1, h2, h3, p { margin-top: 0; }
  h1, h2, h3 {
    font-family: var(--serif);
    line-height: 1.04;
    letter-spacing: -0.045em;
  }
  h1 {
    max-width: 760px;
    margin-bottom: 28px;
    font-size: clamp(3.4rem, 7.5vw, 6.9rem);
    font-weight: 500;
  }
  h1 em {
    color: var(--accent);
    font-style: italic;
    white-space: nowrap;
  }
  .lede {
    max-width: 650px;
    margin-bottom: 34px;
    color: var(--muted);
    font-size: clamp(1.04rem, 2vw, 1.25rem);
  }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 11px 19px;
    border: 1px solid var(--ink);
    border-radius: 999px;
    font-size: 0.94rem;
    font-weight: 740;
    text-decoration: none;
  }
  .button-primary { background: var(--ink); color: var(--paper); }
  .button-primary:hover { background: transparent; color: var(--ink); }
  .button-secondary { background: transparent; color: var(--ink); }
  .button-secondary:hover { background: var(--ink); color: var(--paper); }
  .portrait {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 480px;
    overflow: hidden;
    border: 1px solid var(--hairline);
    border-radius: 48% 48% 24px 24px;
    background: var(--inset);
  }
  .portrait::before {
    position: absolute;
    inset: 11% 12% auto;
    height: 62%;
    border-radius: 50%;
    background: var(--accent);
    content: "";
    opacity: 0.18;
  }
  .portrait img {
    position: relative;
    z-index: 1;
    width: min(82%, 410px);
    height: auto;
  }
  .proof {
    padding: 100px 0;
    border-top: 1px solid var(--hairline);
  }
  .proof > h2, .closing h2 {
    max-width: 720px;
    margin-bottom: 48px;
    font-size: clamp(2.4rem, 5vw, 4.3rem);
    font-weight: 500;
  }
  .proof-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    overflow: hidden;
    border: 1px solid var(--hairline);
    border-radius: 20px;
    background: var(--hairline);
  }
  .proof-grid article {
    min-height: 250px;
    padding: 28px;
    background: var(--surface);
  }
  .proof-grid span {
    display: block;
    margin-bottom: 64px;
    color: var(--accent-deep);
    font-size: 0.78rem;
    font-weight: 760;
  }
  .proof-grid h3 { margin-bottom: 12px; font-size: 1.72rem; font-weight: 600; }
  .proof-grid p { margin-bottom: 0; color: var(--muted); }
  .closing {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 32px;
    padding: 88px 0;
    border-top: 1px solid var(--hairline);
  }
  .closing h2 { margin-bottom: 0; }
  .legal-note, .single-action {
    max-width: 760px;
    margin: 0 0 104px;
    padding: 32px;
    border: 1px solid var(--hairline);
    border-radius: 18px;
    background: var(--surface);
  }
  .legal-note h2 { margin-bottom: 14px; font-size: 1.8rem; font-weight: 600; }
  .legal-note p, .single-action p { margin-bottom: 0; color: var(--muted); }
  .legal-copy h2 { margin-top: 36px; }
  .legal-copy h2:first-of-type { margin-top: 0; }
  .legal-copy p { margin-bottom: 18px; }
  .legal-copy ul { margin: 0 0 18px; padding-left: 22px; color: var(--muted); }
  .legal-copy li + li { margin-top: 10px; }
  .single-action .button { margin-bottom: 20px; }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 104px;
    border-top: 1px solid var(--hairline);
    color: var(--muted);
    font-size: 0.88rem;
  }
  footer p { margin: 0; }
  footer nav a { font-size: 0.86rem; }

  @media (max-width: 780px) {
    .shell { width: min(100% - 28px, 680px); }
    header { min-height: 72px; }
    header nav a:not(:last-child) { display: none; }
    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding: 56px 0 72px;
    }
    h1 { font-size: clamp(3.25rem, 16vw, 5.4rem); }
    .portrait { min-height: 380px; }
    .proof { padding: 72px 0; }
    .proof-grid { grid-template-columns: 1fr; }
    .proof-grid article { min-height: auto; }
    .proof-grid span { margin-bottom: 36px; }
    .closing { align-items: flex-start; flex-direction: column; padding: 72px 0; }
    .legal-note, .single-action { margin-bottom: 72px; }
    footer { align-items: flex-start; flex-direction: column; padding: 28px 0; }
    footer nav { flex-wrap: wrap; margin-left: -13px; }
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #1B1613;
      --surface: #211B17;
      --inset: #2B231E;
      --ink: #F4EDDF;
      --muted: #A69B8A;
      --hairline: #3A302A;
      --accent: #EE754C;
      --accent-deep: #F79A78;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

const footer = `
  <footer class="shell">
    <p>© 2026 Melo</p>
    <nav aria-label="Legal and support">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/support">Support</a>
      <a href="/delete-account">Delete account</a>
      <a href="/security">Security</a>
    </nav>
  </footer>
`;

function activePage(pathname: string): PageKey | undefined {
  if (pathname === '/') return 'home';
  if (pathname === '/open' || pathname === '/open/') return 'open';
  if (pathname === '/privacy' || pathname === '/privacy/') return 'privacy';
  if (pathname === '/support' || pathname === '/support/') return 'support';
  if (pathname === '/terms' || pathname === '/terms/') return 'terms';
  if (pathname === '/delete-account' || pathname === '/delete-account/') return 'delete-account';
  if (pathname === '/security' || pathname === '/security/') return 'security';
  return undefined;
}

function pageHtml(pageKey: PageKey): string {
  const page = pages[pageKey];
  const canonicalPath = pageKey === 'home' ? '' : `/${pageKey}`;
  const title =
    pageKey === 'home' ? 'Melo — Will my money last to payday?' : `${page.eyebrow} — Melo`;
  const navigation = `
    <nav aria-label="Primary">
      <a href="/privacy"${pageKey === 'privacy' ? ' aria-current="page"' : ''}>Privacy</a>
      <a href="/support"${pageKey === 'support' ? ' aria-current="page"' : ''}>Support</a>
    </nav>
  `;
  const homeActions =
    pageKey === 'home'
      ? `
        <div class="actions">
          <a class="button button-primary" href="#how">How Melo works</a>
          <a class="button button-secondary" href="/support">Contact support</a>
        </div>
      `
      : '';

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${page.description}">
    <meta name="theme-color" content="#F6F4EE" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#1B1613" media="(prefers-color-scheme: dark)">
    <link rel="canonical" href="${SITE_ORIGIN}${canonicalPath}">
    <link rel="icon" type="image/png" href="/favicon.png">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Melo">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${page.description}">
    <meta property="og:url" content="${SITE_ORIGIN}${canonicalPath}">
    <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <style>${styles}</style>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="shell">
      <a class="brand" href="/" aria-label="Melo home">melo</a>
      ${navigation}
    </header>
    <main class="shell" id="main">
      <section class="hero">
        <div>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.title} <em>${page.accent}</em></h1>
          <p class="lede">${page.body}</p>
          ${homeActions}
        </div>
        <div class="portrait" aria-label="Melo, the app companion">
          <img src="/melo-hero.png" width="800" height="800" alt="Melo, a warm phoenix companion">
        </div>
      </section>
      ${page.content}
    </main>
    ${footer}
  </body>
</html>`;
}

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': `${contentType}; charset=utf-8`,
    },
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function redirectToPrimary(url: URL): Response {
  const destination = new URL(url.pathname + url.search, SITE_ORIGIN);
  return withSecurityHeaders(Response.redirect(destination.toString(), 308));
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (ALIAS_HOSTS.has(url.hostname.toLowerCase())) {
    return redirectToPrimary(url);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withSecurityHeaders(
      new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' },
      }),
    );
  }

  if (url.pathname === '/robots.txt') {
    return withSecurityHeaders(
      textResponse(`User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, 'text/plain'),
    );
  }

  if (url.pathname === '/sitemap.xml') {
    const entries = ['', '/open', '/privacy', '/support', '/terms', '/delete-account', '/security']
      .map((path) => `<url><loc>${SITE_ORIGIN}${path}</loc></url>`)
      .join('');
    return withSecurityHeaders(
      textResponse(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
        'application/xml',
      ),
    );
  }

  if (url.pathname === '/.well-known/security.txt' || url.pathname === '/security.txt') {
    return withSecurityHeaders(
      textResponse(
        [
          'Contact: mailto:security@melo-money.com',
          'Expires: 2027-07-19T23:59:59Z',
          `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
          `Policy: ${SITE_ORIGIN}/security`,
          'Preferred-Languages: en',
          '',
        ].join('\n'),
        'text/plain',
      ),
    );
  }

  if (url.pathname === '/.well-known/assetlinks.json') {
    return withSecurityHeaders(
      textResponse(
        JSON.stringify([
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: 'com.melomoney.app',
              sha256_cert_fingerprints: [
                '54:73:96:E1:FD:99:68:1C:2A:6D:76:8B:8B:7D:1B:44:84:B5:F4:2A:17:59:7C:AD:6C:49:52:21:26:7A:54:88',
              ],
            },
          },
        ]),
        'application/json',
      ),
    );
  }

  const page = activePage(url.pathname);
  if (page) {
    return withSecurityHeaders(
      new Response(pageHtml(page), {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    );
  }

  if (
    url.pathname === '/favicon.png' ||
    url.pathname === '/melo-hero.png' ||
    url.pathname === '/og-image.png'
  ) {
    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  }

  return withSecurityHeaders(
    new Response('Page not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }),
  );
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
