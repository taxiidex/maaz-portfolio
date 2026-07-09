/* ================================================================
   MAAZ ZINDANI — cinematic scroll engine
   Lenis smooth scroll · GSAP ScrollTrigger · canvas frame scrub
   ================================================================ */

(() => {
  'use strict';

  /* ---------------- site config (swap these freely) ---------------- */
  const SITE = window.SITE_CONFIG = {
    // Formspree-style endpoint or your Laravel `POST /api/contact`
    contactEndpoint: 'https://formspree.io/f/YOUR_FORM_ID',
    availability: 'AVAILABLE FOR NEW PROJECTS',
  };

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FRAME_COUNT = 180;
  const frameSrc = (i) => `assets/frames/orbit_${String(i).padStart(3, '0')}.webp?v=2`;

  // mobile swaps the orbit frame scrub for the portrait hero video —
  // phones skip the 180-frame download entirely
  const mobileHero = window.matchMedia('(max-width: 767px)').matches;
  const heroVideo = document.getElementById('hero-video');
  let heroVideoArmed = false;
  function armHeroVideo() {
    if (heroVideoArmed || !heroVideo) return;
    heroVideoArmed = true;
    heroVideo.preload = 'auto';
    heroVideo.load();
    if (prefersReduced) return; // stay on the poster / first frame
    heroVideo.play().catch(() => {});
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        if (self.isActive) heroVideo.play().catch(() => {});
        else heroVideo.pause();
      },
      // browsers may suspend muted background video; nudge it while active
      onUpdate: (self) => {
        if (self.isActive && heroVideo.paused) heroVideo.play().catch(() => {});
      },
    });
  }

  // if the viewport crosses into the mobile branch after boot, arm lazily —
  // registered outside any gsap.matchMedia context so the ScrollTrigger
  // above survives matchMedia revert/re-run cycles
  const mobileHeroMQ = window.matchMedia('(max-width: 767px)');
  if (mobileHeroMQ.addEventListener) {
    mobileHeroMQ.addEventListener('change', (e) => { if (e.matches) armHeroVideo(); });
  }

  document.body.classList.add('is-loading');

  /* ---------------- Lenis smooth scroll ---------------- */
  let lenis = null;
  if (!prefersReduced) {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------------- canvas ---------------- */
  const canvas = document.getElementById('orbit-canvas');
  const ctx = canvas.getContext('2d');
  const frames = [];
  const playhead = { frame: 0 };   // displayed (lerped) frame
  const playTarget = { frame: 0 }; // scrub writes here; ticker eases toward it
  let lastDrawn = -1;

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    lastDrawn = -1;
    render(true);
  }

  function drawCoverTo(c2, cnv, img) {
    const cw = cnv.width;
    const ch = cnv.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    c2.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function drawCover(img) { drawCoverTo(ctx, canvas, img); }

  function render(force) {
    const idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(playhead.frame)));
    if (!force && idx === lastDrawn) return;
    const img = frames[idx];
    if (img && img.complete && img.naturalWidth > 0) {
      lastDrawn = idx;
      drawCover(img);
    }
  }

  window.addEventListener('resize', sizeCanvas);

  // debug hook for perf verification
  window.__orbit = { frames, playhead, render, frameCount: FRAME_COUNT };

  /* ---------------- extra frame sequences (lazy loaded after boot) ---------------- */
  function makeSeq(canvasId, dir, prefix, count) {
    const cnv = document.getElementById(canvasId);
    if (!cnv) return null;
    const c2 = cnv.getContext('2d');
    const imgs = [];
    const ph = { frame: 0 };
    let last = -1;
    let step = 1; // mobile loads a sparser sequence; snap to loaded frames

    function rend(force) {
      let idx = Math.max(0, Math.min(count - 1, Math.round(ph.frame)));
      if (step > 1) idx = Math.floor(idx / step) * step;
      if (force !== true && idx === last) return;
      const img = imgs[idx];
      if (img && img.complete && img.naturalWidth > 0) {
        last = idx;
        drawCoverTo(c2, cnv, img);
      }
    }

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cnv.width = Math.round(cnv.clientWidth * dpr);
      cnv.height = Math.round(cnv.clientHeight * dpr);
      last = -1;
      rend(true);
    }

    let loading = false;
    function load(frameStep) {
      if (loading) return Promise.resolve();
      loading = true;
      step = frameStep > 1 ? frameStep : 1;
      const idxs = [];
      for (let i = 0; i < count; i += step) idxs.push(i);
      return new Promise((res) => {
        let done = 0;
        idxs.forEach((i) => {
          const img = new Image();
          img.onload = img.onerror = () => {
            if (i === 0) rend(true);
            if (img.decode) img.decode().catch(() => {});
            done += 1;
            if (done === idxs.length) res();
          };
          img.src = `assets/${dir}/${prefix}_${String(i).padStart(3, '0')}.webp`;
          imgs[i] = img;
        });
      });
    }

    window.addEventListener('resize', size);
    return { cnv, ph, tgt: { frame: 0 }, rend, size, load, count };
  }

  const archSeq = makeSeq('arch-canvas', 'frames2', 'arch', 160);
  const diveSeq = makeSeq('dive-canvas', 'frames_dive', 'dive', 160);
  const forgeSeq = makeSeq('forge-canvas', 'frames_forge', 'forge', 160);
  const ascSeq = makeSeq('asc-canvas', 'frames_asc', 'asc', 160);
  const extraSeqs = [archSeq, diveSeq, forgeSeq, ascSeq].filter(Boolean);

  // one shared tick eases every displayed frame toward its scrub target,
  // so sequences glide between frames instead of snapping
  const FRAME_LERP = 0.34;
  gsap.ticker.add(() => {
    playhead.frame += (playTarget.frame - playhead.frame) * FRAME_LERP;
    render();
    extraSeqs.forEach((s) => {
      s.ph.frame += (s.tgt.frame - s.ph.frame) * FRAME_LERP;
      s.rend();
    });
  });

  // frames + videos load only when their section approaches (~1.5 viewports out)
  function initLazyMedia() {
    const seqMap = [[archSeq, '#xp'], [diveSeq, '#dive'], [forgeSeq, '#forge'], [ascSeq, '#finale']];
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          // phones scrub every 4th frame — ~75% less to download
          if (en.target.__seq) en.target.__seq.load(mobileHero ? 4 : 1);
          if (en.target.__vid) {
            const v = en.target.__vid;
            // don't reset a video that's already playing
            if (v.paused) { v.preload = 'auto'; v.load(); }
          }
          io.unobserve(en.target);
        });
      }, { rootMargin: '150% 0px' });
      seqMap.forEach(([s, sel]) => {
        const el = document.querySelector(sel);
        if (s && el) { el.__seq = s; io.observe(el); }
      });
      document.querySelectorAll('video[preload="metadata"]').forEach((v) => {
        const host = v.closest('section, footer') || v;
        host.__vid = v;
        io.observe(host);
      });
    } else {
      seqMap.forEach(([s]) => s && s.load(mobileHero ? 4 : 1));
    }
  }

  /* ---------------- preload frames ---------------- */
  const pctEl = document.getElementById('load-pct');
  const barEl = document.getElementById('load-bar');

  // load an inclusive range of hero frames; the preloader only gates on the
  // first HERO_GATE frames so the page is interactive fast — the rest streams
  const HERO_GATE = 24;
  function preloadFrames(from, to, onProgress) {
    let loaded = 0;
    const total = to - from;
    const jobs = [];
    for (let i = from; i < to; i++) {
      jobs.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loaded += 1;
          if (onProgress) onProgress(loaded / total);
          // warm the decode cache but never block on it — hidden tabs
          // defer decode() indefinitely, which would hang the preloader
          if (img.decode) img.decode().catch(() => {});
          resolve();
        };
        img.src = frameSrc(i);
        frames[i] = img;
      }));
    }
    return Promise.all(jobs);
  }

  // desktop fallback if the viewport crosses out of the mobile-hero branch
  // after boot (rotation, window resize) — frames were never requested there
  let framesRequested = false;
  function ensureFrames() {
    if (framesRequested) return;
    framesRequested = true;
    preloadFrames(0, FRAME_COUNT).then(() => render(true));
  }

  // mobile boot gates the preloader on the portrait hero video instead of
  // the orbit frames; never hold the page hostage on a slow connection
  function preloadHeroMedia(onProgress) {
    if (!(mobileHero && heroVideo)) {
      // cap the gate so one stalled frame request can't lock the page
      const cap = new Promise((res) => setTimeout(res, 8000));
      return Promise.race([preloadFrames(0, HERO_GATE, onProgress), cap]).then(() => {
        framesRequested = true;
        render(true); // paint frame 0
        preloadFrames(HERO_GATE, FRAME_COUNT); // stream the rest of the orbit
        onProgress(1);
      });
    }
    const note = document.querySelector('.preloader-note');
    if (note) note.textContent = 'LOADING THE REEL';
    return new Promise((res) => {
      let done = false;
      const fake = { v: 0 };
      const tween = gsap.to(fake, {
        v: 0.92, duration: 1.8, ease: 'power1.out',
        onUpdate: () => onProgress(fake.v),
      });
      const finish = () => {
        if (done) return;
        done = true;
        tween.kill();
        onProgress(1);
        res();
      };
      heroVideo.addEventListener('canplay', finish, { once: true });
      heroVideo.addEventListener('error', finish, { once: true });
      setTimeout(finish, 3500);
      armHeroVideo();
    });
  }

  /* ---------------- text splitting ---------------- */
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    const chars = [];
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      chars.push(span);
    }
    if (el.hasAttribute('data-accent-last')) {
      chars[chars.length - 1].classList.add('accent');
    }
    return chars;
  }

  function wrapLines(heading) {
    heading.querySelectorAll(':scope > span').forEach((line) => {
      const inner = document.createElement('span');
      inner.innerHTML = line.innerHTML;
      line.innerHTML = '';
      line.appendChild(inner);
    });
  }

  const heroLines = gsap.utils.toArray('.hero-line');
  const lineChars = heroLines.map((line) => splitChars(line));
  const allChars = lineChars.flat();
  document.querySelectorAll('[data-split-lines]').forEach(wrapLines);

  // char-split headings lose their accessible name; restore it up front
  document.querySelectorAll('.pillar-title, .skill-title').forEach((h) => {
    const label = Array.from(h.querySelectorAll('.pt-line'), (l) => l.textContent.trim()).join(' ');
    h.setAttribute('aria-label', label);
  });

  const pillarParts = gsap.utils.toArray('.pillar').map((p) => ({
    el: p,
    chars: gsap.utils.toArray(p.querySelectorAll('.pt-line')).flatMap((l) => splitChars(l)),
    blocks: [p.querySelector('.pillar-num'), p.querySelector('.pillar-body')],
  }));

  const skillParts = gsap.utils.toArray('.skill').map((s) => ({
    el: s,
    chars: gsap.utils.toArray(s.querySelectorAll('.pt-line')).flatMap((l) => splitChars(l)),
    chips: gsap.utils.toArray(s.querySelectorAll('.skill-chips li')),
  }));

  const contactChars = gsap.utils.toArray('.contact-line').flatMap((l) => splitChars(l));

  const aboutText = document.getElementById('about-text');
  let aboutWords = [];
  if (aboutText) {
    const words = aboutText.textContent.trim().split(/\s+/);
    aboutText.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = w;
      aboutText.appendChild(span);
      if (i < words.length - 1) aboutText.appendChild(document.createTextNode(' '));
    });
    aboutWords = gsap.utils.toArray(aboutText.children);
  }

  document.querySelectorAll('.roll-link').forEach((el) => {
    const text = el.textContent.trim();
    el.textContent = '';
    const inner = document.createElement('span');
    inner.className = 'roll-inner';
    const a = document.createElement('span');
    a.textContent = text;
    const b = document.createElement('span');
    b.textContent = text;
    b.setAttribute('aria-hidden', 'true');
    inner.append(a, b);
    el.appendChild(inner);
  });

  /* ---------------- scroll-driven choreography ---------------- */
  function buildScrollScenes() {
    // — hero master timeline (10 units, scrubbed across 450vh)
    const heroTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.35,
        invalidateOnRefresh: true,
      },
    });

    gsap.set('#hero-sub', { y: 36 });

    // hero background scrub — orbit frames on desktop, portrait video on mobile
    const heroScrub = () => ({
      trigger: '#hero', start: 'top top', end: 'bottom bottom',
      scrub: 0.35, invalidateOnRefresh: true,
    });
    const mmHero = gsap.matchMedia();
    mmHero.add('(min-width: 768px)', () => {
      ensureFrames();
      gsap.to(playTarget, { frame: FRAME_COUNT - 1, ease: 'none', scrollTrigger: heroScrub() });
      gsap.fromTo('#orbit-canvas', { scale: 1.06 }, { scale: 1.15, ease: 'none', scrollTrigger: heroScrub() });
    });
    mmHero.add('(max-width: 767px)', () => {
      gsap.fromTo('#hero-video', { scale: 1.06 }, { scale: 1.15, ease: 'none', scrollTrigger: heroScrub() });
    });

    heroTl
      .to('#hud-scroll', { autoAlpha: 0, duration: 0.5 }, 0.15)
      .to(heroLines[0], { yPercent: -32, duration: 3.6 }, 0.5)
      .to(heroLines[1], { yPercent: 32, duration: 3.6 }, 0.5)
      .to(lineChars[0], {
        x: (i) => (i - (lineChars[0].length - 1) / 2) * (window.innerWidth * 0.055),
        duration: 3.6,
      }, 0.5)
      .to(lineChars[1], {
        x: (i) => (i - (lineChars[1].length - 1) / 2) * (window.innerWidth * 0.04),
        duration: 3.6,
      }, 0.5)
      .to('.hero-title', { autoAlpha: 0, duration: 1.6 }, 2.9)
      .to('#hero-sub', { autoAlpha: 1, y: 0, duration: 0.9 }, 1.1)
      .to('#hero-sub', { autoAlpha: 0, y: -30, duration: 0.8 }, 4.2)
      .fromTo('#hero-mid',
        { autoAlpha: 0, letterSpacing: '0.5em' },
        { autoAlpha: 1, letterSpacing: '0.12em', duration: 1.1 }, 5.6)
      .to('#hero-mid', { autoAlpha: 0, letterSpacing: '0.02em', duration: 0.9 }, 8.1)
      .to('#hero-exit-fade', { opacity: 1, duration: 1.2 }, 8.8);

    // — scroll progress bar
    gsap.to('#scroll-progress', {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });

    // — stats count-up
    document.querySelectorAll('.stat-num').forEach((el) => {
      const target = parseFloat(el.dataset.target);
      const decimals = parseInt(el.dataset.decimals, 10);
      const counter = { v: 0 };
      gsap.to(counter, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
        onUpdate: () => { el.textContent = counter.v.toFixed(decimals); },
      });
    });

    gsap.from('.stat', {
      y: 44,
      autoAlpha: 0,
      stagger: 0.09,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: '#stats', start: 'top 78%', once: true },
    });

    gsap.from('.stat-rule', {
      scaleX: 0,
      stagger: 0.09,
      duration: 1.1,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: '#stats', start: 'top 78%', once: true },
    });

    // — section eyebrows: tracking contracts as they appear
    gsap.utils.toArray('.section-eyebrow').forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0,
        letterSpacing: '0.85em',
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // — pillars: one at a time over 340vh
    const pillars = pillarParts;
    const counterEl = document.getElementById('pillar-index');
    const pillarsTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#pillars',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.4,
        onUpdate: (self) => {
          const idx = self.progress < 0.36 ? '01' : self.progress < 0.68 ? '02' : '03';
          if (counterEl.textContent !== idx) counterEl.textContent = idx;
        },
      },
    });

    const pillarIn = (p, at) => {
      pillarsTl.fromTo(p.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at);
      pillarsTl.fromTo(p.chars,
        { yPercent: 115 },
        { yPercent: 0, duration: 0.9, stagger: 0.02, ease: 'power3.out' }, at);
      pillarsTl.fromTo(p.blocks,
        { y: 60, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.18, ease: 'power2.out' }, at + 0.2);
    };
    const pillarOut = (p, at) => {
      pillarsTl.to(p.chars, { yPercent: -115, duration: 0.7, stagger: 0.012, ease: 'power2.in' }, at);
      pillarsTl.to(p.blocks, { y: -50, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, at);
      pillarsTl.to(p.el, { autoAlpha: 0, duration: 0.45 }, at + 0.35);
    };

    pillarIn(pillars[0], 0.3);
    pillarOut(pillars[0], 2.7);
    pillarIn(pillars[1], 3.4);
    pillarOut(pillars[1], 5.8);
    pillarIn(pillars[2], 6.5);
    pillarsTl.to({}, { duration: 1 }, 9); // hold pillar 3 to the end

    gsap.from('.pillars-head', {
      autoAlpha: 0,
      y: 24,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: '#pillars', start: 'top 60%', once: true },
    });

    // — about: words brighten one by one as you scroll
    if (aboutWords.length) {
      gsap.to(aboutWords, {
        opacity: 1,
        ease: 'none',
        stagger: 0.35,
        scrollTrigger: {
          trigger: '#about-text',
          start: 'top 80%',
          end: 'bottom 55%',
          scrub: true,
        },
      });
    }

    // — experience: horizontal pin over THE ARCHITECT (desktop), stacked flow (mobile)
    const mmXP = gsap.matchMedia();
    mmXP.add('(min-width: 768px) and (min-height: 501px)', () => {
      const rail = document.getElementById('xp-rail');
      if (!rail) return;
      const xTween = gsap.to(rail, {
        x: () => -Math.max(0, rail.scrollWidth - window.innerWidth + 40),
        ease: 'none',
        scrollTrigger: {
          trigger: '#xp',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: (self) => { window.__xpProg = self.progress; },
        },
      });
      if (archSeq) {
        gsap.to(archSeq.tgt, {
          frame: archSeq.count - 1,
          ease: 'none',
          scrollTrigger: { trigger: '#xp', start: 'top top', end: 'bottom bottom', scrub: 0.35 },
        });
      }
      gsap.utils.toArray('.xp-card').forEach((card) => {
        ScrollTrigger.create({
          trigger: card,
          containerAnimation: xTween,
          start: 'left 78%',
          once: true,
          onEnter: () => {
            card.classList.add('is-active');
            if (window.__fx) {
              const r = card.getBoundingClientRect();
              window.__fx.xpBurst(r.left + r.width / 2, r.top + r.height * 0.35);
            }
          },
        });
      });
      gsap.fromTo('#xp-line-fill', { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: '#xp', start: 'top top', end: 'bottom bottom', scrub: 0.3 },
      });
    });
    mmXP.add('(max-width: 767px), (max-height: 500px)', () => {
      if (archSeq) {
        gsap.to(archSeq.tgt, {
          frame: archSeq.count - 1,
          ease: 'none',
          scrollTrigger: { trigger: '#xp', start: 'top bottom', end: 'bottom top', scrub: 0.35 },
        });
      }
      gsap.utils.toArray('.xp-card').forEach((card) => {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 85%',
          once: true,
          onEnter: () => card.classList.add('is-active'),
        });
      });
    });

    // — skills: THE DIVE descent, one group per depth layer
    if (diveSeq && skillParts.length) {
      let diveZone = -1;
      const diveTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#dive',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.4,
          onUpdate: (self) => {
            const p = self.progress;
            const zone = p < 0.3 ? 0 : p < 0.55 ? 1 : p < 0.8 ? 2 : 3;
            if (zone !== diveZone) {
              diveZone = zone;
              const el = document.getElementById('dive-index');
              if (el) el.textContent = `0${zone + 1}`;
              if (window.__fx) window.__fx.diveBurst();
            }
          },
        },
      });
      diveTl.to(diveSeq.tgt, { frame: diveSeq.count - 1, duration: 10 }, 0);
      const sIn = (s, at) => {
        diveTl.fromTo(s.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at);
        diveTl.fromTo(s.chars, { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.03, ease: 'power3.out' }, at);
        diveTl.fromTo(s.chips, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: 'power2.out' }, at + 0.3);
      };
      const sOut = (s, at) => {
        diveTl.to(s.chars, { yPercent: -115, duration: 0.7, stagger: 0.015, ease: 'power2.in' }, at);
        diveTl.to(s.chips, { y: -30, autoAlpha: 0, duration: 0.5, stagger: 0.03 }, at);
        diveTl.to(s.el, { autoAlpha: 0, duration: 0.4 }, at + 0.4);
      };
      sIn(skillParts[0], 0.3); sOut(skillParts[0], 2.4);
      sIn(skillParts[1], 2.9); sOut(skillParts[1], 4.9);
      sIn(skillParts[2], 5.4); sOut(skillParts[2], 7.4);
      sIn(skillParts[3], 7.9);
      diveTl.to({}, { duration: 0.1 }, 10);

      gsap.from('.dive-head', {
        autoAlpha: 0, y: 24, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '#dive', start: 'top 60%', once: true },
      });
    }

    // — services: THE FORGE, cards self-draw in sync with assembling structures
    const mmForge = gsap.matchMedia();
    mmForge.add('(min-width: 768px) and (min-height: 501px)', () => {
      if (!forgeSeq) return;
      const fgTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '#forge', start: 'top top', end: 'bottom bottom', scrub: 0.4 },
      });
      fgTl.to(forgeSeq.tgt, { frame: forgeSeq.count - 1, duration: 10 }, 0);
      gsap.utils.toArray('.forge-card').forEach((card, i) => {
        const rect = card.querySelector('.forge-border rect');
        const content = card.querySelectorAll('.forge-index, .forge-title, .forge-desc');
        const at = 1.2 + i * 1.9;
        fgTl.fromTo(rect, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, at);
        fgTl.fromTo(content, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1, ease: 'power2.out' }, at + 0.7);
      });
    });
    mmForge.add('(max-width: 767px), (max-height: 500px)', () => {
      if (forgeSeq) {
        gsap.to(forgeSeq.tgt, {
          frame: forgeSeq.count - 1,
          ease: 'none',
          scrollTrigger: { trigger: '#forge', start: 'top bottom', end: 'bottom top', scrub: 0.35 },
        });
      }
      gsap.utils.toArray('.forge-card').forEach((card) => {
        const rect = card.querySelector('.forge-border rect');
        const content = card.querySelectorAll('.forge-index, .forge-title, .forge-desc');
        const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 85%', once: true } });
        tl.fromTo(rect, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' })
          .fromTo(content, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.1, ease: 'power2.out' }, '-=0.4');
      });
    });

    // — finale: THE ASCENSION, CTA rises on the crane with the camera
    if (ascSeq) {
      const fTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#finale',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.4,
          onUpdate: (self) => { window.__finaleProg = self.progress; },
        },
      });
      const finaleLines = document.querySelectorAll('.finale-title > span > span');
      fTl.to(ascSeq.tgt, { frame: ascSeq.count - 1, duration: 10 }, 0)
        .fromTo('.finale-inner', { y: '30vh' }, { y: '0vh', duration: 6, ease: 'power1.out' }, 0.4)
        .fromTo(finaleLines, { yPercent: 115 }, { yPercent: 0, duration: 2.4, stagger: 0.4, ease: 'power3.out' }, 2.2)
        .fromTo('.finale-cta', { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 1.8, ease: 'power2.out' }, 5.6);
    }

    // — big section headings drift against scroll (parallax depth)
    gsap.utils.toArray('.work-heading, .xp-heading, .certs-heading').forEach((h) => {
      gsap.fromTo(h, { y: 60 }, {
        y: -60,
        ease: 'none',
        scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: 0.4 },
      });
    });

    // — ghost name strip drifts sideways behind the timeline
    gsap.fromTo('#xp-ghost', { xPercent: 0 }, {
      xPercent: -22,
      ease: 'none',
      scrollTrigger: {
        trigger: '#xp',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
      },
    });

    // — credentials grid
    gsap.from('.cert-card', {
      y: 50,
      autoAlpha: 0,
      stagger: 0.07,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.certs-grid', start: 'top 82%', once: true },
    });

    // — line-mask reveals (section headings; finale title is scrub-driven)
    gsap.utils.toArray('[data-split-lines]:not(.finale-title)').forEach((heading) => {
      gsap.from(heading.querySelectorAll(':scope > span > span'), {
        yPercent: 110,
        duration: 1.2,
        stagger: 0.12,
        ease: 'power4.out',
        scrollTrigger: { trigger: heading, start: 'top 82%', once: true },
      });
    });

    // — work rows
    gsap.utils.toArray('.work-row').forEach((row) => {
      gsap.from(row, {
        y: 70,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: row, start: 'top 88%', once: true },
      });
    });

    // — footer
    gsap.from('.footer', {
      autoAlpha: 0,
      duration: 1,
      scrollTrigger: { trigger: '.footer', start: 'top 96%', once: true },
    });

    // — contact: converge particles, reveal title/fields once on approach
    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 75%',
      once: true,
      onEnter: () => {
        if (window.__contactFX) {
          const form = { v: 0 };
          gsap.to(form, { v: 1, duration: 1.5, ease: 'power2.inOut', onUpdate: () => window.__contactFX.setForm(form.v) });
        }
        gsap.fromTo(contactChars, { yPercent: 112 }, { yPercent: 0, duration: 1.1, stagger: 0.04, ease: 'expo.out' });
        gsap.fromTo('.contact-form .f-line', { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1, stagger: 0.09, ease: 'power3.inOut' });
        gsap.from('.contact-sub, .avail-badge, .contact-info li, .faq details', {
          y: 26, autoAlpha: 0, duration: 0.8, stagger: 0.06, ease: 'power2.out', delay: 0.25, clearProps: 'all',
        });
      },
    });

    // — testimonials: drift loop, pause on hover, speed follows scroll velocity
    const testiTrack = document.getElementById('testi-track');
    if (testiTrack && lenis) {
      const testiLoop = gsap.to(testiTrack, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
      window.__testiLoop = testiLoop;
      testiTrack.addEventListener('pointerenter', () => gsap.to(testiLoop, { timeScale: 0, duration: 0.4 }));
      testiTrack.addEventListener('pointerleave', () => gsap.to(testiLoop, { timeScale: 1, duration: 0.6 }));
    }

    // — emerald wipe line as each major section hands off
    gsap.utils.toArray('#stats, #about, #xp, #dive, #forge, #certs, #testi, #contact').forEach((sec) => {
      const line = document.createElement('span');
      line.className = 'wipe';
      sec.appendChild(line);
      gsap.to(line, {
        scaleX: 1,
        duration: 1.1,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: sec, start: 'top 85%', once: true },
      });
    });

    // — play videos only while their section is on screen
    [
      ['#pillars', document.getElementById('pillars-video')],
      ['#work', document.getElementById('work-video')],
      ['#contact', document.getElementById('contact-video')],
    ].forEach(([sel, video]) => {
      ScrollTrigger.create({
        trigger: sel,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          if (self.isActive) video.play().catch(() => {});
          else video.pause();
        },
        // browsers may suspend muted background video; nudge it while active
        onUpdate: (self) => {
          if (self.isActive && video.paused) video.play().catch(() => {});
        },
      });
    });
  }

  /* ---------------- pointer-driven layers ---------------- */
  function initCursor() {
    document.documentElement.classList.add('has-cursor');
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    let shown = false;

    window.addEventListener('pointermove', (e) => {
      if (!shown) {
        shown = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
      }
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    });
    document.documentElement.addEventListener('pointerleave', () => {
      shown = false;
      gsap.to([dot, ring], { opacity: 0, duration: 0.3 });
    });

    const HOVERABLE = 'a, button, .work-row-inner';
    document.addEventListener('pointerover', (e) => {
      if (!e.target.closest) return;
      ring.classList.toggle('is-cross', !!e.target.closest('#contact') && !e.target.closest(HOVERABLE));
      if (e.target.closest(HOVERABLE)) {
        const isRow = !!e.target.closest('.work-row-inner');
        ring.classList.add('is-hover');
        ring.classList.toggle('is-view', isRow);
        gsap.to(ring, { scale: isRow ? 2.5 : 1.7, duration: 0.35, ease: 'power3.out' });
        gsap.to(dot, { scale: isRow ? 0 : 0.45, duration: 0.35, ease: 'power3.out' });
      }
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(HOVERABLE) && !e.relatedTarget?.closest(HOVERABLE)) {
        ring.classList.remove('is-hover', 'is-view');
        gsap.to([ring, dot], { scale: 1, duration: 0.35, ease: 'power3.out' });
      }
    });
  }

  function initMagnetic() {
    document.querySelectorAll('.btn').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  function initHeroParallax() {
    const stage = document.querySelector('.hero-sticky');
    gsap.set(canvas, { scale: 1.06, transformOrigin: '50% 50%' });
    const cX = gsap.quickTo(canvas, 'x', { duration: 0.9, ease: 'power3' });
    const cY = gsap.quickTo(canvas, 'y', { duration: 0.9, ease: 'power3' });
    const tX = gsap.quickTo('.hero-title', 'x', { duration: 0.6, ease: 'power3' });
    const tY = gsap.quickTo('.hero-title', 'y', { duration: 0.6, ease: 'power3' });
    stage.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      cX(nx * -20); cY(ny * -14);
      tX(nx * 26); tY(ny * 16);
    });
    stage.addEventListener('pointerleave', () => { cX(0); cY(0); tX(0); tY(0); });
  }

  function initVelocityFX() {
    // marquee speed/direction follows scroll velocity
    const track = document.getElementById('marquee-track');
    track.classList.add('js-drive');
    const loop = gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1 });
    const speedTo = gsap.quickTo(loop, 'timeScale', { duration: 0.35, ease: 'power2' });
    // work rows shear with scroll velocity
    const skewTo = gsap.quickTo('.work-list', 'skewY', { duration: 0.5, ease: 'power3' });
    // big section titles lean subtly with velocity
    const titleSkews = gsap.utils.toArray('.work-heading, .xp-heading, .certs-heading, .forge-heading')
      .map((el) => gsap.quickTo(el, 'skewY', { duration: 0.55, ease: 'power3' }));

    let settleTimer;
    lenis.on('scroll', (e) => {
      const v = e.velocity || 0;
      const dir = v < 0 ? -1 : 1;
      window.__scrollVel = Math.abs(v); // consumed by the WebGL layers
      speedTo(dir * (1 + Math.min(Math.abs(v) / 60, 3)));
      if (window.__testiLoop) window.__testiLoop.timeScale(dir * (1 + Math.min(Math.abs(v) / 90, 2)));
      skewTo(gsap.utils.clamp(-6, 6, v * 0.05));
      const tSkew = gsap.utils.clamp(-2.5, 2.5, v * 0.02);
      titleSkews.forEach((f) => f(tSkew));
      // instant jumps emit a single event; make sure we always settle
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        speedTo(1);
        skewTo(0);
        titleSkews.forEach((f) => f(0));
        if (window.__testiLoop) gsap.to(window.__testiLoop, { timeScale: 1, duration: 0.5 });
        window.__scrollVel = 0;
      }, 140);
    });
  }

  /* ---------------- ambient extras ---------------- */
  function initExtras() {
    // availability badge text from config
    const avail = document.getElementById('availability-text');
    if (avail) avail.textContent = SITE.availability;
    document.querySelectorAll('.avail-copy').forEach((el) => { el.textContent = SITE.availability; });

    // back to top — scrubs the hero orbit in reverse on the way up
    const toTop = document.getElementById('to-top');
    if (toTop) {
      toTop.addEventListener('click', () => {
        if (lenis) lenis.scrollTo(0, { duration: 3, easing: (t) => 1 - Math.pow(1 - t, 3) });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // "dex" easter egg
    let buffer = '';
    const dex = document.getElementById('dex-overlay');
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-3);
      if (buffer === 'dex' && dex && !dex.classList.contains('is-on')) {
        dex.classList.add('is-on');
        setTimeout(() => {
          gsap.to(dex, {
            opacity: 0, duration: 0.6, onComplete: () => {
              dex.classList.remove('is-on');
              gsap.set(dex, { clearProps: 'opacity' });
            },
          });
          if (window.__contactFX) window.__contactFX.burst();
        }, 1600);
      }
    });
  }

  /* ---------------- sound design (off by default) ---------------- */
  function initSound() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    let ac = null;
    let master = null;
    let whoosh = null;
    let on = false;

    function build() {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
      // low ambient hum: two detuned sines
      [52, 52.7].forEach((f) => {
        const o = ac.createOscillator();
        o.frequency.value = f;
        const g = ac.createGain();
        g.gain.value = 0.012;
        o.connect(g).connect(master);
        o.start();
      });
      // filtered noise bed + whoosh gain driven by scroll velocity
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 220;
      whoosh = ac.createGain();
      whoosh.gain.value = 0;
      src.connect(filt).connect(whoosh).connect(master);
      src.start();
      gsap.ticker.add(() => {
        if (!on || !whoosh) return;
        const target = Math.min((window.__scrollVel || 0) / 60, 1) * 0.045;
        whoosh.gain.value += (target - whoosh.gain.value) * 0.08;
      });
      // soft tick on hoverables
      let lastTick = 0;
      document.addEventListener('pointerenter', (e) => {
        if (!on || !e.target.closest || !e.target.closest('a, button, .work-row-inner')) return;
        const now = performance.now();
        if (now - lastTick < 90) return;
        lastTick = now;
        const o = ac.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 1150;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.03, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.07);
        o.connect(g).connect(master);
        o.start();
        o.stop(ac.currentTime + 0.08);
      }, true);
    }

    function setOn(state) {
      on = state;
      btn.setAttribute('aria-pressed', String(state));
      sessionStorage.setItem('mz-sound', state ? '1' : '0');
      if (state && !ac) build();
      if (ac) {
        ac.resume();
        gsap.to(master.gain, { value: state ? 1 : 0, duration: 0.6 });
      }
    }

    btn.addEventListener('click', () => setOn(!on));
    // sound can only start after a user gesture; remember intent for the session
    if (sessionStorage.getItem('mz-sound') === '1') {
      const arm = () => { setOn(true); window.removeEventListener('pointerdown', arm); };
      window.addEventListener('pointerdown', arm, { once: true });
    }
  }

  /* ---------------- intro ---------------- */
  function playIntro() {
    const tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => {
        heroLines.forEach((l) => { l.style.overflow = 'visible'; });
        if (lenis) lenis.start();
        document.body.classList.remove('is-loading');
      },
    });

    tl.to('#preloader', {
      yPercent: -100,
      duration: 0.9,
      ease: 'expo.inOut',
      onComplete: () => document.getElementById('preloader').remove(),
    })
      .from(allChars, { yPercent: 112, duration: 1.1, stagger: 0.045 }, '-=0.35')
      .to('#site-header', { opacity: 1, duration: 0.8 }, '<0.5')
      .from('.hero-hud .hud-item', { autoAlpha: 0, y: 18, stagger: 0.08, duration: 0.7 }, '<0.1');
  }

  function skipIntro() {
    document.getElementById('preloader').remove();
    gsap.set('#site-header', { opacity: 1 });
    heroLines.forEach((l) => { l.style.overflow = 'visible'; });
    document.body.classList.remove('is-loading');
  }

  /* ---------------- boot ---------------- */
  sizeCanvas();
  extraSeqs.forEach((s) => s.size());

  // gate only on the first HERO_GATE frames (or the mobile hero video) + fonts
  const assetsReady = Promise.all([
    preloadHeroMedia((p) => {
      pctEl.textContent = Math.round(p * 100);
      barEl.style.transform = `scaleX(${p})`;
    }),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ]);

  assetsReady.then(() => {
    initLazyMedia(); // section sequences + videos load on approach
    buildScrollScenes();
    ScrollTrigger.refresh();
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!prefersReduced && finePointer) {
      initCursor();
      initMagnetic();
      initHeroParallax();
    }
    if (lenis) initVelocityFX();
    initExtras();
    initSound();
    if (prefersReduced) skipIntro();
    else playIntro();
  });
})();
