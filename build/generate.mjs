/* ================================================================
   MAAZ ZINDANI — static site generator (programmatic SEO)
   Zero dependencies. Reads data/*.json, writes crawlable pages.
   Run: node build/generate.mjs
   ================================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const readOpt = (p, fallback) => existsSync(join(ROOT, p)) ? read(p) : fallback;

const SITE = read('data/site.json');
const PROJECTS = read('data/projects.json');
const SERVICES = read('data/services.json');
const POSTS = readOpt('data/posts.json', []);
const CSS_V = 'v=3';
const TODAY = new Date().toISOString().slice(0, 10);

const bySlug = Object.fromEntries(PROJECTS.map((p) => [p.slug, p]));

/* ---------------- helpers ---------------- */
const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const abs = (path) => SITE.domain + path;
const write = (path, html) => {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
  return path;
};

// EM-emphasis inside body copy: wrap *word* -> <em>word</em> after escaping
const emph = (s = '') => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

function jsonldScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path),
    })),
  };
}
function crumbHtml(items) {
  const lis = items.map((it, i) => i === items.length - 1
    ? `<li>${esc(it.name)}</li>`
    : `<li><a href="${it.path}">${esc(it.name)}</a></li>`).join('');
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${lis}</ol></nav>`;
}

/* ---------------- shared chrome ---------------- */
function nav(current) {
  const links = [
    ['/projects/', 'Projects'],
    ['/services/', 'Services'],
    ['/blog/', 'Blog'],
    ['/app-cost-calculator/', 'App Cost'],
    ['/about/', 'About'],
    ['/#contact', 'Contact'],
  ];
  const items = links.map(([href, label]) => {
    const cur = href === current ? ' aria-current="page"' : '';
    const accent = href === '/app-cost-calculator/' ? ' class="nav-cta"' : '';
    return `<a href="${href}"${cur}${accent}>${label}</a>`;
  }).join('');
  return `<header class="site-nav"><div class="site-nav-inner">
    <a class="nav-brand" href="/" aria-label="Maaz Zindani — home">
      <img src="/assets/logo.svg?v=2" alt="" width="30" height="30" />
      <span>MZ<sup>&copy;</sup></span>
    </a>
    <nav class="nav-links" aria-label="Primary">${items}</nav>
  </div></header>`;
}

function footer() {
  return `<footer class="site-foot"><div class="site-foot-inner">
    <div class="foot-links">
      <a href="/">Home</a>
      <a href="/projects/">Projects</a>
      <a href="/services/">Services</a>
      <a href="/blog/">Blog</a>
      <a href="/app-cost-calculator/">App Cost Calculator</a>
      <a href="/about/">About</a>
      <a href="${SITE.socials.github}" target="_blank" rel="noopener">GitHub &#8599;</a>
      <a href="${SITE.socials.linkedin}" target="_blank" rel="noopener">LinkedIn &#8599;</a>
      <a href="mailto:${SITE.email}">Email &#8599;</a>
    </div>
    <p class="foot-copy">&copy; 2026 ${esc(SITE.name)} &mdash; ${esc(SITE.location)}</p>
  </div></footer>`;
}

function ctaBlock(heading, sub) {
  return `<section class="cta"><div class="wrap">
    <h2>${esc(heading)}</h2>
    <p>${esc(sub)}</p>
    <div class="btn-row">
      <a class="btn" href="/#contact">Start a project</a>
      <a class="btn ghost" href="mailto:${SITE.email}">Email me &#8599;</a>
    </div>
  </div></section>`;
}

function layout({ path, title, description, ogType = 'website', bodyHtml, ld = [], extraHead = '', bodyEnd = '' }) {
  const canonical = abs(path);
  const ldTags = ld.map(jsonldScript).join('\n  ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="author" content="${esc(SITE.name)}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:site_name" content="${esc(SITE.name)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE.ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE.ogImage}" />
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="icon" type="image/svg+xml" href="/assets/logo.svg?v=2" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png?v=2" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png?v=2" />
  <link rel="preload" href="/fonts/anton-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/css/pages.css?${CSS_V}" />
  ${extraHead}
  ${ldTags}
</head>
<body>
  ${nav(path)}
  <main>
${bodyHtml}
  </main>
  ${footer()}
  ${bodyEnd}
</body>
</html>
`;
}

/* ---------------- project link buttons ---------------- */
function projectButtons(p) {
  const l = p.links || {};
  const out = [];
  if (l.appStore) out.push(`<a class="btn" href="${l.appStore}" target="_blank" rel="noopener">App Store &#8599;</a>`);
  if (l.googlePlay) out.push(`<a class="btn" href="${l.googlePlay}" target="_blank" rel="noopener">Google Play &#8599;</a>`);
  if (l.live) out.push(`<a class="btn" href="${l.live}" target="_blank" rel="noopener">Visit live &#8599;</a>`);
  return out.length ? `<div class="btn-row">${out.join('')}</div>` : '';
}

function metricsHtml(metrics) {
  if (!metrics || !metrics.length) return '';
  const items = metrics.map((m) => `<div class="metric">
      <p class="m-value"><span>${esc(m.value)}</span></p>
      <p class="m-label">${esc(m.label)}</p>
    </div>`).join('');
  return `<section class="metrics wrap" aria-label="Key results">${items}</section>`;
}

function relatedCards(slugs, heading) {
  const cards = slugs.map((s) => bySlug[s]).filter(Boolean).map((p) => `<li class="card">
      <span class="c-eyebrow">${esc(p.category)}</span>
      <h3><a href="/projects/${p.slug}/">${esc(p.title)}</a></h3>
      <p>${esc(p.tagline)}</p>
      <span class="c-go">Case study &#8594;</span>
    </li>`).join('');
  if (!cards) return '';
  return `<section class="related"><div class="wrap">
    <div class="section-head"><h2>${esc(heading)}</h2></div>
    <ul class="card-grid">${cards}</ul>
  </div></section>`;
}

/* ---------------- project page ---------------- */
function renderProject(p) {
  const path = `/projects/${p.slug}/`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Projects', path: '/projects/' },
    { name: p.title, path },
  ];
  const pills = [];
  if (p.role) pills.push(`<span class="pill accent">${esc(p.role)}</span>`);
  if (p.badge) pills.push(`<span class="pill">${esc(p.badge)}</span>`);
  pills.push(`<span class="pill">${esc(p.category)}</span>`);

  const sections = (p.sections || []).map((s) =>
    `<section><h2>${esc(s.h2)}</h2><p>${emph(s.body)}</p></section>`).join('\n');
  const tech = `<section><h2>Tech</h2><ul class="tech-tags">${
    p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`;

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">${esc(p.category)}</p>
      <h1>${esc(p.title)}</h1>
      <p class="page-lead">${emph(p.lead)}</p>
      <div class="hero-meta">${pills.join('')}</div>
      ${projectButtons(p)}
    </div></section>
    ${metricsHtml(p.metrics)}
    <section class="content"><div class="wrap">
      ${sections}
      ${tech}
    </div></section>
    ${relatedCards(p.related || [], 'Related work')}
    ${ctaBlock('Building something like ' + p.title + '?', 'Tell me about your product — discovery call within 48 hours.')}`;

  // schema
  const isApp = p.type === 'app';
  const primaryLd = isApp ? {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: p.title,
    description: p.metaDescription,
    operatingSystem: p.operatingSystem || 'iOS, Android',
    applicationCategory: p.applicationCategory || 'MobileApplication',
    url: p.links.appStore || p.links.googlePlay || p.links.live || abs(path),
    author: { '@id': SITE.personId },
    keywords: (p.keywords || []).join(', '),
  } : {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.title,
    description: p.metaDescription,
    url: p.links.live || abs(path),
    author: { '@id': SITE.personId },
    keywords: (p.keywords || []).join(', '),
  };

  return write(`projects/${p.slug}/index.html`, layout({
    path, title: p.metaTitle, description: p.metaDescription, ogType: 'article',
    bodyHtml: body, ld: [primaryLd, breadcrumbLd(crumbs)],
  }));
}

/* ---------------- projects index ---------------- */
function renderProjectsIndex() {
  const path = '/projects/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Projects', path }];
  const cards = PROJECTS.map((p) => `<li class="card">
      <span class="c-eyebrow">${esc(p.category)}</span>
      <h3><a href="/projects/${p.slug}/">${esc(p.title)}</a></h3>
      <p>${esc(p.tagline)}</p>
      <span class="c-go">Case study &#8594;</span>
    </li>`).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">Selected &amp; full work</p>
      <h1>Projects</h1>
      <p class="page-lead">Twenty-one products across logistics, fintech, e-commerce, IoT and enterprise &mdash; shipped to the App Store, Google Play and the web. Each links to a full case study.</p>
    </div></section>
    <section class="content"><div class="wrap">
      <ul class="card-grid">${cards}</ul>
    </div></section>
    ${ctaBlock('Have a project in mind?', 'From MVP to scale, I build mobile apps end to end.')}`;

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'Projects — Maaz Zindani', url: abs(path),
      description: 'Case studies of mobile apps and platforms built by Maaz Zindani.',
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: PROJECTS.map((p, i) => ({
        '@type': 'ListItem', position: i + 1, url: abs(`/projects/${p.slug}/`), name: p.title,
      })),
    },
    breadcrumbLd(crumbs),
  ];
  return write('projects/index.html', layout({
    path, title: 'Projects — App Case Studies | Maaz Zindani',
    description: 'Case studies of 21 mobile apps and platforms built by Maaz Zindani — logistics, fintech, IoT, e-commerce and enterprise, shipped to the App Store and Google Play.',
    bodyHtml: body, ld,
  }));
}

/* ---------------- service page ---------------- */
function renderService(s) {
  const path = `/services/${s.slug}/`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services/' },
    { name: s.title, path },
  ];
  const sections = (s.sections || []).map((sec) =>
    `<section><h2>${esc(sec.h2)}</h2><p>${emph(sec.body)}</p></section>`).join('\n');
  const faqHtml = (s.faq || []).map((f) =>
    `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">Service</p>
      <h1>${esc(s.h1)}</h1>
      <p class="page-lead">${emph(s.intro)}</p>
      <div class="btn-row"><a class="btn" href="/#contact">Get a quote</a></div>
    </div></section>
    <section class="content"><div class="wrap">
      ${sections}
    </div></section>
    <section class="content" style="padding-top:0"><div class="wrap">
      <div class="section-head"><h2>FAQ</h2></div>
      <div class="faq">${faqHtml}</div>
    </div></section>
    ${relatedCards(s.relatedProjects || [], 'Proof of work')}
    ${ctaBlock(s.title + ' &mdash; let&#39;s talk', 'Discovery call within 48 hours; kickoff typically inside two weeks.')}`;

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Service',
      serviceType: s.title, name: s.title, description: s.metaDescription,
      url: abs(path),
      provider: { '@id': SITE.personId },
      areaServed: ['Pakistan', 'Worldwide'],
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: (s.faq || []).map((f) => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    breadcrumbLd(crumbs),
  ];
  return write(`services/${s.slug}/index.html`, layout({
    path, title: s.metaTitle, description: s.metaDescription, ogType: 'website',
    bodyHtml: body, ld,
  }));
}

/* ---------------- services index ---------------- */
function renderServicesIndex() {
  const path = '/services/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Services', path }];
  const cards = SERVICES.map((s) => `<li class="card">
      <span class="c-eyebrow">Service</span>
      <h3><a href="/services/${s.slug}/">${esc(s.title)}</a></h3>
      <p>${esc(s.intro).slice(0, 150)}&hellip;</p>
      <span class="c-go">Learn more &#8594;</span>
    </li>`).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">What I do</p>
      <h1>Services</h1>
      <p class="page-lead">End-to-end mobile product development &mdash; Flutter apps, startup MVPs, backend &amp; DevOps, AI integration and app modernization.</p>
    </div></section>
    <section class="content"><div class="wrap">
      <ul class="card-grid">${cards}</ul>
    </div></section>
    ${ctaBlock('Not sure which you need?', 'Tell me the problem &mdash; I&#39;ll tell you the shortest path to shipping.')}`;

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'Services — Maaz Zindani', url: abs(path),
      description: 'Mobile app development, MVP, backend & DevOps, AI integration and app modernization services.',
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: SERVICES.map((s, i) => ({
        '@type': 'ListItem', position: i + 1, url: abs(`/services/${s.slug}/`), name: s.title,
      })),
    },
    breadcrumbLd(crumbs),
  ];
  return write('services/index.html', layout({
    path, title: 'Services — Flutter, MVP, Backend & AI | Maaz Zindani',
    description: 'Mobile app development services by Maaz Zindani — Flutter apps, 90-day startup MVPs, backend & DevOps, AI integration, and legacy app modernization.',
    bodyHtml: body, ld,
  }));
}

/* ---------------- about ---------------- */
function renderAbout() {
  const path = '/about/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'About', path }];
  const certs = [
    ['Meta', 'Certified Android Developer', ''],
    ['Google', 'AI Essentials', 'https://www.coursera.org/account/accomplishments/certificate/CC8XL15F1B6Z'],
    ['Google Cloud', 'Working with Onscreen Data in a Flutter Application', 'https://coursera.org/share/ce739e065e93cbdb97d1133965efeeae'],
    ['IBM', 'Exploratory Data Analysis for Machine Learning', 'https://www.coursera.org/account/accomplishments/certificate/UNZFRGB12UN4'],
    ['University of Alberta', 'Software Product Management', 'https://www.coursera.org/account/accomplishments/specialization/certificate/UPF6SD6T0THZ'],
    ['AWS', 'AWS Fundamentals', 'https://www.coursera.org/account/accomplishments/specialization/certificate/9XN11A6XFH7L'],
    ['Google', 'Project Management', ''],
    ['JetBrains', 'Programming Fundamentals in Kotlin', ''],
  ];
  const certList = certs.map(([iss, name, url]) => {
    const label = `<strong>${esc(iss)}</strong> &mdash; ${esc(name)}`;
    return url
      ? `<li><a href="${url}" target="_blank" rel="noopener">${label} &nbsp;<em>Verify &#8599;</em></a></li>`
      : `<li>${label}</li>`;
  }).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">About</p>
      <h1>Maaz Zindani</h1>
      <p class="page-lead">Karachi-based <em>Lead Mobile App Developer</em> &mdash; Meta Certified Android Developer and Flutter expert. Six years shipping products people actually use, from radio streams and smart appliances to BNPL fintech and video streaming.</p>
      <div class="hero-meta">
        <span class="pill accent">Meta Certified</span>
        <span class="pill">6+ years</span>
        <span class="pill">15+ apps shipped</span>
        <span class="pill">100k+ users reached</span>
      </div>
    </div></section>
    <section class="content"><div class="wrap">
      <section><h2>What I do</h2><p>I build end to end &mdash; Flutter and native frontends with AWS and DevOps pipelines behind them &mdash; and I lead teams that deliver on a two-week cadence. That means I can take a product from a blank repo to the app store and keep it running at 99.9% uptime, without handing you off between five different contractors.</p></section>
      <section><h2>The road here</h2>
        <p><strong>SZABIST, Karachi</strong> &mdash; BS in Artificial Intelligence. Four years deep in Java, Swift and machine-learning fundamentals.</p>
        <p><strong>Freelance &amp; agency work</strong> &mdash; first clients shipped solo, end to end: FM91 Radio, NTimes News, Ohana Africa.</p>
        <p><strong>Flutter Team Lead &rarr; Senior Flutter Developer</strong> &mdash; led teams delivering client apps, built Dawlance smart-appliance apps and Qist Bazaar&#39;s BNPL platform from scratch.</p>
        <p><strong>Lead Mobile App Developer</strong> (now) &mdash; owning mobile end to end: architecture, CI/CD, and releases that reach 100k+ users.</p>
      </section>
      <section><h2>Stack</h2>
        <p><strong>Mobile:</strong> Flutter, Dart, Kotlin, Swift, React Native. <strong>Backend &amp; DevOps:</strong> Laravel, Spring Boot, Node/NestJS, AWS, Firebase, Docker, Kubernetes, CI/CD. <strong>AI:</strong> LLM integration, RAG pipelines, automation.</p>
      </section>
      <section><h2>Certifications</h2>
        <ul class="tech-tags" style="flex-direction:column;gap:10px;align-items:flex-start">${certList}</ul>
      </section>
    </div></section>
    ${relatedCards(['dispatch-pro', 'qist-bazaar', 'nuclear-home-video'], 'Selected work')}
    ${ctaBlock('Let&#39;s build your next app', 'Available for new projects &mdash; discovery call within 48 hours.')}`;

  const person = {
    '@context': 'https://schema.org', '@type': 'Person', '@id': SITE.personId,
    name: SITE.name, jobTitle: 'Lead Mobile App Developer — Meta Certified Android Developer & Flutter Expert',
    url: abs('/'), email: `mailto:${SITE.email}`,
    address: { '@type': 'PostalAddress', addressLocality: SITE.locality, addressCountry: SITE.country },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Shaheed Zulfikar Ali Bhutto Institute of Science and Technology (SZABIST)' },
    knowsAbout: ['Mobile App Development', 'Flutter', 'Dart', 'Kotlin', 'Swift', 'AWS', 'DevOps', 'CI/CD', 'AI Integration'],
    sameAs: SITE.sameAs,
  };
  const ld = [
    { '@context': 'https://schema.org', '@type': 'ProfilePage', url: abs(path), mainEntity: { '@id': SITE.personId } },
    person,
    breadcrumbLd(crumbs),
  ];
  return write('about/index.html', layout({
    path, title: 'About Maaz Zindani — Meta Certified Flutter Lead',
    description: 'Maaz Zindani is a Karachi-based, Meta Certified mobile app developer and Flutter expert with 6+ years shipping 15+ apps to 100k+ users, end to end with AWS and DevOps.',
    ogType: 'profile', bodyHtml: body, ld,
  }));
}

/* ---------------- blog ---------------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${+d} ${MONTHS[+m - 1]} ${y}`;
}

function renderPost(post) {
  const path = `/blog/${post.slug}/`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog/' },
    { name: post.title, path },
  ];
  const faqHtml = (post.faq || []).map((f) =>
    `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const svcLinks = (post.relatedServices || []).map((slug) => {
    const s = SERVICES.find((x) => x.slug === slug);
    return s ? `<a href="/services/${s.slug}/">${esc(s.title)}</a>` : '';
  }).filter(Boolean).join(' · ');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <article>
    <header class="page-hero"><div class="wrap">
      <p class="eyebrow">Article</p>
      <h1>${esc(post.title)}</h1>
      <p class="post-meta">${fmtDate(post.date)} · ${post.readMins} min read${
        post.tags && post.tags.length ? ' · ' + post.tags.map(esc).join(', ') : ''}</p>
      <p class="page-lead">${esc(post.excerpt)}</p>
    </div></header>
    <div class="content"><div class="wrap">
      <div class="post-body">${post.bodyHtml}</div>
      ${svcLinks ? `<p class="post-services"><strong>Related services:</strong> ${svcLinks}</p>` : ''}
    </div></div>
    ${faqHtml ? `<section class="content" style="padding-top:0"><div class="wrap">
      <div class="section-head"><h2>Frequently asked questions</h2></div>
      <div class="faq">${faqHtml}</div>
    </div></section>` : ''}
    </article>
    ${relatedCards(post.relatedProjects || [], 'Proof from my work')}
    ${ctaBlock('Ready to build?', 'Get an instant estimate with the app cost calculator, or book a discovery call.')}`;

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.metaDescription,
      datePublished: post.date, dateModified: post.date,
      author: { '@id': SITE.personId }, publisher: { '@id': SITE.personId },
      image: SITE.ogImage, mainEntityOfPage: abs(path),
      keywords: (post.keywords || []).join(', '),
    },
    breadcrumbLd(crumbs),
  ];
  if (post.faq && post.faq.length) {
    ld.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: post.faq.map((f) => ({
        '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return write(`blog/${post.slug}/index.html`, layout({
    path, title: post.metaTitle, description: post.metaDescription, ogType: 'article',
    bodyHtml: body, ld,
  }));
}

function renderBlogIndex() {
  const path = '/blog/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Blog', path }];
  const cards = POSTS.map((p) => `<li class="card">
      <span class="c-eyebrow">${fmtDate(p.date)} · ${p.readMins} min</span>
      <h3><a href="/blog/${p.slug}/">${esc(p.title)}</a></h3>
      <p>${esc(p.excerpt)}</p>
      <span class="c-go">Read &#8594;</span>
    </li>`).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">Insights</p>
      <h1>Blog</h1>
      <p class="page-lead">Practical guides on mobile app development, costs, MVPs and shipping products that scale &mdash; written from the trenches.</p>
    </div></section>
    <section class="content"><div class="wrap">
      <ul class="card-grid">${cards}</ul>
    </div></section>
    ${ctaBlock('Have a project in mind?', 'Get an instant estimate, or book a discovery call.')}`;

  const ld = [
    { '@context': 'https://schema.org', '@type': 'Blog', name: 'Maaz Zindani — Blog', url: abs(path), description: 'Guides on mobile app development, cost, MVPs and Flutter.' },
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: POSTS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/blog/${p.slug}/`), name: p.title })),
    },
    breadcrumbLd(crumbs),
  ];
  return write('blog/index.html', layout({
    path, title: 'Blog — App Development Guides | Maaz Zindani',
    description: 'Practical guides on mobile app development cost, MVPs, Flutter vs React Native, and shipping apps that scale — by Maaz Zindani.',
    bodyHtml: body, ld,
  }));
}

/* ---------------- app cost calculator ---------------- */
function renderCalculator() {
  const path = '/app-cost-calculator/';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'App Cost Calculator', path }];
  const radio = (name, opts) => opts.map((o, i) =>
    `<label class="opt"><input type="radio" name="${name}" value="${o.v}"${i === 0 ? ' checked' : ''}><span>${esc(o.l)}</span></label>`).join('');
  const check = (opts) => opts.map((o) =>
    `<label class="opt"><input type="checkbox" name="feature" value="${o.v}"><span>${esc(o.l)}</span></label>`).join('');

  const regionPills = [
    ['us', 'North America'], ['weu', 'Western Europe'], ['eeu', 'Eastern Europe'],
    ['me', 'Middle East'], ['in', 'India'], ['pk', 'Pakistan'], ['global', 'Global'],
  ].map(([v, l], i) => `<label class="rpill"><input type="radio" name="region" value="${v}"${v === 'global' ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow" data-an="fade">Free tool</p>
      <h1 data-an="rise">App Cost Calculator</h1>
      <p class="page-lead" data-an="rise">Answer five quick questions and get an instant estimate calibrated to <em>your region&#39;s market</em> &mdash; then send me the scope for a precise quote.</p>
    </div></section>
    <section class="content"><div class="wrap">
      <div class="region-bar" data-an="rise">
        <p class="region-label">Your market: <span id="region-note">auto-detected from your device &mdash; tap to change</span></p>
        <div class="region-pills" id="region-pills">${regionPills}</div>
      </div>
      <div class="calc-layout">
      <form class="calc" id="calc" novalidate>
        <fieldset class="calc-group"><legend>1. Platforms</legend>
          ${radio('platform', [{ v: 'both', l: 'iOS + Android (cross-platform)' }, { v: 'ios', l: 'iOS only' }, { v: 'android', l: 'Android only' }])}
        </fieldset>
        <fieldset class="calc-group"><legend>2. App type</legend>
          ${radio('apptype', [{ v: 'simple', l: 'Simple / content app' }, { v: 'marketplace', l: 'Marketplace / on-demand' }, { v: 'social', l: 'Social / streaming' }, { v: 'fintech', l: 'Fintech / enterprise' }])}
        </fieldset>
        <fieldset class="calc-group"><legend>3. Features</legend>
          ${check([
            { v: 'auth', l: 'Accounts & profiles' }, { v: 'payments', l: 'Payments' },
            { v: 'realtime', l: 'Real-time (chat / tracking)' }, { v: 'maps', l: 'Maps / geolocation' },
            { v: 'admin', l: 'Admin dashboard' }, { v: 'push', l: 'Push notifications' },
            { v: 'ai', l: 'AI features' }, { v: 'integrations', l: 'Third-party integrations' },
          ])}
        </fieldset>
        <fieldset class="calc-group"><legend>4. Design</legend>
          ${radio('design', [{ v: 'custom', l: 'Custom (standard polish)' }, { v: 'template', l: 'Template / minimal' }, { v: 'premium', l: 'Premium (bespoke, animated)' }])}
        </fieldset>
        <fieldset class="calc-group"><legend>5. Backend</legend>
          ${radio('backend', [{ v: 'baas', l: 'Managed / Firebase' }, { v: 'custom', l: 'Custom backend' }, { v: 'scale', l: 'Custom + DevOps at scale' }])}
        </fieldset>
      </form>
      <aside class="calc-result" id="calc-result" aria-live="polite">
        <p class="cr-label">Typical <span id="cr-region">global</span> agency range</p>
        <p class="cr-market" id="cr-market">&mdash;</p>
        <div class="cr-divider"></div>
        <p class="cr-label accent">My estimate &mdash; ~50% below that market</p>
        <p class="cr-range" id="cr-range">&mdash;</p>
        <p class="cr-pkr" id="cr-pkr" hidden></p>
        <p class="cr-time" id="cr-time"></p>
        <p class="cr-note">Indicative only, based on 2026 market benchmarks and an effort model &mdash; your exact quote comes after a short discovery call.</p>
        <div class="btn-row">
          <a class="btn" id="cr-email" href="#">Email me this scope &#8599;</a>
          <a class="btn ghost" href="/#contact">Book a discovery call</a>
        </div>
      </aside>
      </div>
    </div></section>
    <section class="content bench" style="padding-top:0"><div class="wrap">
      <div class="section-head"><h2 data-an="rise">2026 global benchmarks</h2></div>
      <p class="bench-sub" data-an="rise">What app development typically costs across markets &mdash; and why working with me lands well under these numbers.</p>
      <div class="bench-tablewrap" data-an="rise">
        <table class="bench-table">
          <thead><tr><th>Region</th><th>Typical hourly rate</th><th>Basic app</th><th>Complex / enterprise</th></tr></thead>
          <tbody>
            <tr><td>North America</td><td>$100 &ndash; $250</td><td>$40,000+</td><td>$150,000 &ndash; $500,000+</td></tr>
            <tr><td>Western Europe</td><td>$80 &ndash; $180</td><td>$60,000+</td><td>$150,000 &ndash; $350,000+</td></tr>
            <tr><td>Eastern Europe</td><td>$30 &ndash; $90</td><td>$25,000+</td><td>$100,000 &ndash; $250,000+</td></tr>
            <tr><td>Middle East</td><td>$40 &ndash; $70</td><td>$40,000+</td><td>$100,000 &ndash; $300,000+</td></tr>
            <tr><td>India</td><td>$15 &ndash; $50</td><td>$8,000+</td><td>$80,000 &ndash; $150,000+</td></tr>
            <tr><td>Pakistan</td><td>$15 &ndash; $60</td><td>$1,800+</td><td>$18,000 &ndash; $54,000+</td></tr>
          </tbody>
        </table>
      </div>
      <p class="bench-note" data-an="rise">Indicative 2026 market averages. Because I build end to end from Karachi &mdash; senior, Meta-certified engineering without agency overhead &mdash; my estimates typically land around <em>half</em> of your local market&#39;s going rate.</p>
    </div></section>
    ${ctaBlock('Prefer to just talk it through?', 'Tell me about your app &mdash; discovery call within 48 hours.')}`;

  const extraHead = `<style>
    .region-bar { margin-bottom:26px; }
    .region-label { font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--cream-dim); margin-bottom:12px; }
    #region-note { color:var(--emerald); text-transform:none; letter-spacing:.04em; }
    .region-pills { display:flex; flex-wrap:wrap; gap:8px; }
    .rpill input { position:absolute; opacity:0; pointer-events:none; }
    .rpill span {
      display:inline-block; cursor:pointer;
      font-size:12px; letter-spacing:.12em; text-transform:uppercase;
      color:var(--cream-dim); border:1px solid var(--cream-faint); border-radius:999px;
      padding:9px 16px; transition:color .25s,border-color .25s,background .25s,transform .2s;
    }
    .rpill span:hover { border-color:var(--emerald-dim); color:var(--cream); }
    .rpill input:checked + span { background:var(--emerald); border-color:var(--emerald); color:var(--ink); font-weight:600; }
    .rpill input:focus-visible + span { outline:2px solid var(--emerald); outline-offset:3px; }

    .calc-layout { display:grid; grid-template-columns:1fr; gap:24px; align-items:start; }
    @media(min-width:900px){ .calc-layout{ grid-template-columns:minmax(0,1fr) 360px; } }
    .calc { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; }
    .calc-group { border:1px solid var(--cream-faint); padding:18px 20px; }
    .calc-group legend { font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--emerald); padding:0 8px; }
    .opt { display:flex; align-items:center; gap:10px; padding:8px 0; cursor:pointer; font-size:15px; color:var(--cream); }
    .opt input { accent-color:var(--emerald); width:17px; height:17px; }

    .calc-result { border:1px solid var(--emerald-dim); background:rgba(10,16,13,.6); padding:clamp(24px,3vw,32px); }
    @media(min-width:900px){ .calc-result{ position:sticky; top:96px; } }
    .cr-label { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--cream-dim); }
    .cr-label.accent { color:var(--emerald); }
    .cr-market { font-family:var(--display); font-size:clamp(20px,2.4vw,28px); color:var(--cream-dim); margin-top:4px; text-decoration:line-through; text-decoration-color:rgba(245,240,232,.35); text-decoration-thickness:2px; }
    .cr-divider { height:1px; background:var(--cream-faint); margin:16px 0 14px; }
    .cr-range { font-family:var(--display); font-size:clamp(38px,6vw,60px); line-height:1; color:var(--cream); margin-top:6px; }
    .cr-range span { color:var(--emerald); }
    .cr-pkr { font-size:14px; color:var(--cream-dim); margin-top:8px; letter-spacing:.04em; }
    .cr-time { font-size:15px; color:var(--emerald); margin-top:8px; letter-spacing:.04em; }
    .cr-note { font-size:13px; color:var(--cream-dim); margin-top:14px; max-width:460px; }

    .bench-sub { color:var(--cream-dim); max-width:640px; margin:14px 0 24px; }
    .bench-tablewrap { overflow-x:auto; }
    .bench-table { width:100%; border-collapse:collapse; font-size:clamp(13px,1.2vw,16px); }
    .bench-table th, .bench-table td { border:1px solid var(--cream-faint); padding:13px 16px; text-align:left; white-space:nowrap; }
    .bench-table th { color:var(--emerald); letter-spacing:.06em; }
    .bench-table td { color:var(--cream-dim); }
    .bench-table tr.is-you td { color:var(--cream); background:rgba(16,185,129,.07); }
    .bench-note { color:var(--cream-dim); max-width:680px; margin-top:18px; font-size:15px; }
    .bench-note em { color:var(--emerald); font-style:normal; }

    @media (prefers-reduced-motion: reduce) { [data-an]{ opacity:1 !important; transform:none !important; } }
  </style>`;

  const bodyEnd = `<script src="/libs/gsap.min.js"></script>
  <script src="/libs/ScrollTrigger.min.js"></script>
  <script>
  (function(){
    'use strict';
    /* ---- effort model (hours) ---- */
    var baseH={simple:180,marketplace:450,social:550,fintech:750};
    var plat={both:1.0,ios:0.85,android:0.85};
    var featH={auth:40,payments:80,realtime:110,maps:60,admin:110,push:25,ai:130,integrations:70};
    var des={custom:1.0,template:0.9,premium:1.25};
    var backH={baas:0,custom:130,scale:320};

    /* ---- 2026 regional benchmarks (USD/hr) ---- */
    var REGIONS={
      us:{name:'North America',lo:100,hi:250},
      weu:{name:'Western Europe',lo:80,hi:180},
      eeu:{name:'Eastern Europe',lo:30,hi:90},
      me:{name:'Middle East',lo:40,hi:70},
      'in':{name:'India',lo:15,hi:50},
      pk:{name:'Pakistan',lo:15,hi:60,pkr:true},
      global:{name:'global',lo:40,hi:120}
    };
    var PKR_RATE=278; // implied by 2026 benchmark data

    /* ---- region auto-detect from timezone ---- */
    function detectRegion(){
      var tz='';
      try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
      if(tz==='Asia/Karachi') return 'pk';
      if(tz==='Asia/Kolkata'||tz==='Asia/Calcutta'||tz==='Asia/Colombo'||tz==='Asia/Dhaka') return 'in';
      if(/^Asia\\/(Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat|Baghdad|Amman|Beirut)/.test(tz)||tz==='Africa/Cairo') return 'me';
      if(/^Europe\\/(London|Dublin|Paris|Berlin|Madrid|Rome|Amsterdam|Brussels|Zurich|Vienna|Stockholm|Oslo|Copenhagen|Lisbon|Helsinki|Luxembourg|Monaco)/.test(tz)) return 'weu';
      if(/^Europe\\//.test(tz)) return 'eeu';
      if(/^(America|US|Canada)\\//.test(tz)) return 'us';
      if(/^(Australia|Pacific)\\//.test(tz)) return 'weu';
      return 'global';
    }

    var form=document.getElementById('calc');
    var pills=document.getElementById('region-pills');
    var marketEl=document.getElementById('cr-market');
    var regionEl=document.getElementById('cr-region');
    var rangeEl=document.getElementById('cr-range');
    var pkrEl=document.getElementById('cr-pkr');
    var timeEl=document.getElementById('cr-time');
    var emailEl=document.getElementById('cr-email');
    var noteEl=document.getElementById('region-note');

    function val(n){
      var el=pills.querySelector('input[name="'+n+'"]:checked')||form.querySelector('input[name="'+n+'"]:checked');
      return el?el.value:null;
    }
    function feats(){return Array.prototype.map.call(form.querySelectorAll('input[name="feature"]:checked'),function(e){return e.value;});}
    function r(x){return x<10000?Math.round(x/100)*100:Math.round(x/500)*500;}
    function fmt(n){return '$'+n.toLocaleString('en-US');}
    function fmtPKR(n){return 'PKR '+(Math.round(n/10000)*10000).toLocaleString('en-US');}

    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGsap=typeof gsap!=='undefined'&&!reduced;

    /* tweened display values */
    var disp={mLo:0,mHi:0,lo:0,hi:0};
    function paint(){
      marketEl.textContent=fmt(r(disp.mLo))+' – '+fmt(r(disp.mHi));
      rangeEl.innerHTML='<span>'+fmt(r(disp.lo))+'</span> – <span>'+fmt(r(disp.hi))+'</span>';
    }

    function compute(){
      var t=val('apptype'),p=val('platform'),d=val('design'),b=val('backend'),reg=REGIONS[val('region')]||REGIONS.global,fs=feats();
      var sumF=fs.reduce(function(a,k){return a+(featH[k]||0);},0);
      var hours=Math.round((baseH[t]*plat[p]+sumF+backH[b])*des[d]);
      var mLo=hours*reg.lo, mHi=hours*reg.hi;                 // typical market
      var mid=hours*((reg.lo+reg.hi)/2)*0.5;                   // ~50% below market mid
      var lo=mid*0.85, hi=mid*1.15;
      var weeks=Math.max(4,Math.min(44,Math.round(hours/35)));

      regionEl.textContent=reg.name;
      // paint final values immediately (never depend on the tween — hidden
      // tabs pause the ticker), then animate from the previous values
      var from={mLo:disp.mLo,mHi:disp.mHi,lo:disp.lo,hi:disp.hi};
      disp.mLo=mLo; disp.mHi=mHi; disp.lo=lo; disp.hi=hi;
      paint();
      if(hasGsap&&!document.hidden&&from.lo>0){
        gsap.killTweensOf(disp);
        gsap.fromTo(disp,from,{mLo:mLo,mHi:mHi,lo:lo,hi:hi,duration:.7,ease:'power2.out',onUpdate:paint,onComplete:paint});
        gsap.fromTo('#calc-result',{boxShadow:'0 0 0 rgba(16,185,129,0)'},
          {boxShadow:'0 0 34px rgba(16,185,129,.22)',duration:.35,yoyo:true,repeat:1,ease:'power1.inOut'});
        gsap.fromTo(rangeEl,{scale:.97},{scale:1,duration:.4,ease:'back.out(2)'});
      }

      if(reg.pkr){ pkrEl.hidden=false; pkrEl.textContent='\\u2248 '+fmtPKR(lo*PKR_RATE)+' – '+fmtPKR(hi*PKR_RATE); }
      else pkrEl.hidden=true;
      timeEl.textContent='~'+hours+' hours \\u00b7 ~'+weeks+' weeks';

      var lines=['App estimate request','','Region market: '+reg.name,'Platforms: '+p,'App type: '+t,
        'Features: '+(fs.join(', ')||'none selected'),'Design: '+d,'Backend: '+b,'',
        'Typical '+reg.name+' market: '+fmt(r(mLo))+' - '+fmt(r(mHi)),
        'Estimate (~50% below market): '+fmt(r(lo))+' - '+fmt(r(hi)),
        'Effort: ~'+hours+' hours (~'+weeks+' weeks)','','My project:'];
      emailEl.href='mailto:${SITE.email}?subject='+encodeURIComponent('App estimate \\u2014 '+t+' ('+fmt(r(lo))+'-'+fmt(r(hi))+')')+'&body='+encodeURIComponent(lines.join('\\n'));
    }

    /* auto-select detected region */
    var det=detectRegion();
    var detInput=pills.querySelector('input[value="'+det+'"]');
    if(detInput){ detInput.checked=true; }
    if(noteEl&&det!=='global') noteEl.textContent='detected: '+REGIONS[det].name+' \\u2014 tap to change';

    form.addEventListener('change',compute);
    pills.addEventListener('change',function(e){
      compute();
      if(hasGsap&&e.target&&e.target.nextElementSibling){
        gsap.fromTo(e.target.nextElementSibling,{scale:.9},{scale:1,duration:.35,ease:'back.out(3)'});
      }
    });
    compute();

    /* ---- page choreography ---- */
    if(hasGsap&&!document.hidden){
      gsap.registerPlugin(ScrollTrigger);
      gsap.set('[data-an]',{opacity:0});
      gsap.fromTo('[data-an="fade"]',{opacity:0},{opacity:1,duration:.8,ease:'power2.out'});
      gsap.fromTo('.page-hero [data-an="rise"], .region-bar[data-an="rise"]',
        {opacity:0,y:36},{opacity:1,y:0,duration:.9,stagger:.12,ease:'power3.out',delay:.1});
      gsap.fromTo('.rpill',{opacity:0,y:14},{opacity:1,y:0,duration:.5,stagger:.05,ease:'power2.out',delay:.45});
      gsap.fromTo('.calc-group',{opacity:0,y:34},
        {opacity:1,y:0,duration:.7,stagger:.09,ease:'power3.out',
         scrollTrigger:{trigger:'#calc',start:'top 85%',once:true}});
      gsap.fromTo('#calc-result',{opacity:0,x:36},
        {opacity:1,x:0,duration:.8,ease:'power3.out',
         scrollTrigger:{trigger:'#calc-result',start:'top 88%',once:true}});
      gsap.utils.toArray('.bench [data-an="rise"]').forEach(function(el){
        gsap.fromTo(el,{opacity:0,y:30},{opacity:1,y:0,duration:.8,ease:'power3.out',
          scrollTrigger:{trigger:el,start:'top 88%',once:true}});
      });
      gsap.fromTo('.bench-table tbody tr',{opacity:0,x:-18},
        {opacity:1,x:0,duration:.5,stagger:.07,ease:'power2.out',
         scrollTrigger:{trigger:'.bench-table',start:'top 85%',once:true}});
      gsap.fromTo('.cta h2, .cta p, .cta .btn-row',{opacity:0,y:26},
        {opacity:1,y:0,duration:.7,stagger:.1,ease:'power3.out',
         scrollTrigger:{trigger:'.cta',start:'top 85%',once:true}});
    } else {
      document.querySelectorAll('[data-an]').forEach(function(el){el.style.opacity=1;});
    }
  })();
  </script>`;

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: 'App Cost Calculator', url: abs(path),
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: 'Free interactive tool to estimate the cost of building a mobile app.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': SITE.personId },
    },
    breadcrumbLd(crumbs),
  ];
  return write('app-cost-calculator/index.html', layout({
    path, title: 'App Cost Calculator — Estimate Your App | Maaz Zindani',
    description: 'Free app cost calculator — get an instant, indicative estimate for building your iOS and Android app in 2026, then send the scope for a precise quote.',
    bodyHtml: body, ld, extraHead, bodyEnd,
  }));
}

/* ---------------- sitemap + llms ---------------- */
function renderSitemap(paths) {
  const urls = paths.map((p) => {
    const priority = p === '/' ? '1.0' : p.split('/').filter(Boolean).length <= 1 ? '0.8' : '0.7';
    return `  <url>\n    <loc>${abs(p)}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return write('sitemap.xml', xml);
}

function updateLlms() {
  let txt = readFileSync(join(ROOT, 'llms.txt'), 'utf8');
  const marker = '## Pages';
  const idx = txt.indexOf(marker);
  if (idx !== -1) txt = txt.slice(0, idx).trimEnd() + '\n\n';
  let block = `## Pages\n\n- Home: ${abs('/')}\n- Projects: ${abs('/projects/')}\n- Services: ${abs('/services/')}\n- Blog: ${abs('/blog/')}\n- App Cost Calculator: ${abs('/app-cost-calculator/')}\n- About: ${abs('/about/')}\n\n### Project case studies\n\n`;
  block += PROJECTS.map((p) => `- ${p.title} (${p.category}): ${abs(`/projects/${p.slug}/`)}`).join('\n') + '\n\n';
  block += `### Services\n\n` + SERVICES.map((s) => `- ${s.title}: ${abs(`/services/${s.slug}/`)}`).join('\n') + '\n';
  if (POSTS.length) block += `\n### Articles\n\n` + POSTS.map((p) => `- ${p.title}: ${abs(`/blog/${p.slug}/`)}`).join('\n') + '\n';
  writeFileSync(join(ROOT, 'llms.txt'), txt.trimEnd() + '\n\n' + block);
}

/* ---------------- run ---------------- */
const written = [];
written.push(renderProjectsIndex());
PROJECTS.forEach((p) => written.push(renderProject(p)));
written.push(renderServicesIndex());
SERVICES.forEach((s) => written.push(renderService(s)));
written.push(renderAbout());
written.push(renderCalculator());
if (POSTS.length) {
  written.push(renderBlogIndex());
  POSTS.forEach((p) => written.push(renderPost(p)));
}

const sitemapPaths = [
  '/', '/projects/', '/services/', '/blog/', '/about/', '/app-cost-calculator/',
  ...PROJECTS.map((p) => `/projects/${p.slug}/`),
  ...SERVICES.map((s) => `/services/${s.slug}/`),
  ...POSTS.map((p) => `/blog/${p.slug}/`),
].filter((p, i, a) => (POSTS.length || p !== '/blog/') && a.indexOf(p) === i);
written.push(renderSitemap(sitemapPaths));
updateLlms();

console.log(`✓ Generated ${written.length} files:`);
written.forEach((p) => console.log('  ' + p));
console.log(`✓ sitemap: ${sitemapPaths.length} URLs`);
