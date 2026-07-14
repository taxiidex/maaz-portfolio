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
const CSS_V = 'v=2';
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
    <a class="nav-brand" href="/">MZ<span>&copy;</span></a>
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
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
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

  const body = `${crumbHtml(crumbs).replace('class="crumbs"', 'class="crumbs wrap"')}
    <section class="page-hero"><div class="wrap">
      <p class="eyebrow">Free tool</p>
      <h1>App Cost Calculator</h1>
      <p class="page-lead">Answer five quick questions and get an instant, indicative estimate for your mobile app &mdash; then send me the scope for a precise quote.</p>
    </div></section>
    <section class="content"><div class="wrap">
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
        <p class="cr-label">Indicative estimate</p>
        <p class="cr-range" id="cr-range">&mdash;</p>
        <p class="cr-time" id="cr-time"></p>
        <p class="cr-note">A rough, indicative range only &mdash; your exact quote comes after a short discovery call.</p>
        <div class="btn-row">
          <a class="btn" id="cr-email" href="#">Email me this scope &#8599;</a>
          <a class="btn ghost" href="/#contact">Book a discovery call</a>
        </div>
      </aside>
      </div>
    </div></section>
    ${ctaBlock('Prefer to just talk it through?', 'Tell me about your app &mdash; discovery call within 48 hours.')}`;

  const extraHead = `<style>
    .calc-layout { display:grid; grid-template-columns:1fr; gap:24px; align-items:start; }
    @media(min-width:900px){ .calc-layout{ grid-template-columns:minmax(0,1fr) 340px; } }
    .calc { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; }
    .calc-group { border:1px solid var(--cream-faint); padding:18px 20px; }
    .calc-group legend { font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--emerald); padding:0 8px; }
    .opt { display:flex; align-items:center; gap:10px; padding:8px 0; cursor:pointer; font-size:15px; color:var(--cream); }
    .opt input { accent-color:var(--emerald); width:17px; height:17px; }
    .calc-result { border:1px solid var(--emerald-dim); background:rgba(10,16,13,.6); padding:clamp(24px,3vw,32px); }
    @media(min-width:900px){ .calc-result{ position:sticky; top:96px; } }
    .cr-label { font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:var(--cream-dim); }
    .cr-range { font-family:var(--display); font-size:clamp(40px,7vw,72px); line-height:1; color:var(--cream); margin-top:6px; }
    .cr-range span { color:var(--emerald); }
    .cr-time { font-size:15px; color:var(--emerald); margin-top:6px; letter-spacing:.04em; }
    .cr-note { font-size:13px; color:var(--cream-dim); margin-top:14px; max-width:460px; }
  </style>`;

  const bodyEnd = `<script>
  (function(){
    var base={simple:6000,marketplace:18000,social:22000,fintech:30000};
    var plat={both:1.0,ios:0.85,android:0.85};
    var feat={auth:1500,payments:3000,realtime:4000,maps:2000,admin:4000,push:800,ai:5000,integrations:2500};
    var des={custom:1.0,template:0.9,premium:1.25};
    var back={baas:0,custom:5000,scale:12000};
    var form=document.getElementById('calc');
    var rangeEl=document.getElementById('cr-range');
    var timeEl=document.getElementById('cr-time');
    var emailEl=document.getElementById('cr-email');
    function val(n){var el=form.querySelector('input[name="'+n+'"]:checked');return el?el.value:null;}
    function feats(){return Array.prototype.map.call(form.querySelectorAll('input[name="feature"]:checked'),function(e){return e.value;});}
    function round500(x){return Math.round(x/500)*500;}
    function fmt(n){return '$'+n.toLocaleString('en-US');}
    function compute(){
      var t=val('apptype'), p=val('platform'), d=val('design'), b=val('backend'), fs=feats();
      var sum=fs.reduce(function(a,k){return a+(feat[k]||0);},0);
      var total=(base[t]*plat[p]+sum+back[b])*des[d];
      var low=round500(total*0.8), high=round500(total*1.2);
      var weeks=Math.max(4,Math.min(40,Math.round(total/1300)));
      rangeEl.innerHTML='<span>'+fmt(low)+'</span> – <span>'+fmt(high)+'</span>';
      timeEl.textContent='Estimated timeline: ~'+weeks+' weeks';
      var lines=['App estimate request','','Platforms: '+t,'App type: '+t,'Features: '+(fs.join(', ')||'none selected'),'Design: '+d,'Backend: '+b,'','Indicative estimate: '+fmt(low)+' - '+fmt(high),'Estimated timeline: ~'+weeks+' weeks','','My project:'];
      emailEl.href='mailto:${SITE.email}?subject='+encodeURIComponent('App estimate — '+t+' ('+fmt(low)+'-'+fmt(high)+')')+'&body='+encodeURIComponent(lines.join('\\n'));
    }
    form.addEventListener('change',compute); compute();
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
