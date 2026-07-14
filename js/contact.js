/* ================================================================
   MAAZ ZINDANI — contact form
   validation · honeypot · POST to SITE_CONFIG.contactEndpoint
   loading / success / error states · particle burst on success
   ================================================================ */

(() => {
  'use strict';

  const form = document.getElementById('contact-form');
  if (!form) return;

  const submitBtn = document.getElementById('form-submit');
  const submitLabel = submitBtn.querySelector('.submit-label');
  const fields = {
    name: document.getElementById('f-name'),
    email: document.getElementById('f-email'),
    type: document.getElementById('f-type'),
    budget: document.getElementById('f-budget'),
    message: document.getElementById('f-message'),
    company: document.getElementById('f-company'), // honeypot
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldWrap(input) { return input.closest('.f-field'); }

  function setError(input, msg) {
    const wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    const err = wrap.querySelector('.f-err');
    if (err) err.textContent = msg;
    if (window.gsap) {
      gsap.fromTo(wrap, { x: 0 }, {
        keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 2 }, { x: 0 }],
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }

  function clearError(input) {
    const wrap = fieldWrap(input);
    if (wrap) wrap.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
  }

  function validate() {
    let ok = true;
    if (!fields.name.value || fields.name.value.trim().length < 2) {
      setError(fields.name, 'Your name, at least 2 characters.');
      ok = false;
    }
    if (!EMAIL_RE.test(fields.email.value.trim())) {
      setError(fields.email, 'A valid email so I can reply.');
      ok = false;
    }
    if (!fields.type.value) {
      setError(fields.type, 'Pick the closest project type.');
      ok = false;
    }
    if (!fields.message.value || fields.message.value.trim().length < 10) {
      setError(fields.message, 'Tell me a little more — 10+ characters.');
      ok = false;
    }
    return ok;
  }

  // clear errors as the user types; keep floating labels honest for selects
  Object.values(fields).forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      clearError(input);
      if (input.tagName === 'SELECT') {
        fieldWrap(input)?.classList.toggle('has-value', !!input.value);
      }
    });
  });

  function succeed() {
    form.classList.remove('is-failed');
    form.classList.add('is-done');
    submitBtn.classList.remove('is-loading');
    submitBtn.classList.add('is-done');
    submitLabel.textContent = 'MESSAGE SENT ✓';
    if (window.__contactFX) window.__contactFX.burst();
  }

  function fail() {
    submitBtn.classList.remove('is-loading');
    form.classList.add('is-failed');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // in-flight / already-sent guard — Enter can re-submit during the fetch
    if (submitBtn.classList.contains('is-loading') || form.classList.contains('is-done')) return;
    form.classList.remove('is-failed');
    if (!validate()) return;

    // honeypot: bots fill it — pretend success, send nothing
    if (fields.company.value) { succeed(); return; }

    submitBtn.classList.add('is-loading');
    const endpoint = (window.SITE_CONFIG && window.SITE_CONFIG.contactEndpoint) || '';
    const payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      type: fields.type.value,
      budget: fields.budget.value || 'Not specified',
      message: fields.message.value.trim(),
      // FormSubmit.co control fields (ignored by other endpoints)
      _subject: `New project inquiry — ${fields.type.value || 'Mobile App'} (${fields.name.value.trim()})`,
      _template: 'table',
      _captcha: 'false',
    };

    // no live endpoint configured → open a prefilled email draft so the
    // lead is never silently dropped
    if (!endpoint || endpoint.includes('YOUR_FORM_ID')) {
      const subject = encodeURIComponent(`Project inquiry — ${payload.type} (${payload.name})`);
      const body = encodeURIComponent(
        `Name: ${payload.name}\nEmail: ${payload.email}\nProject type: ${payload.type}\nBudget: ${payload.budget}\n\n${payload.message}`
      );
      window.location.href = `mailto:maazzindani2003@gmail.com?subject=${subject}&body=${body}`;
      succeed();
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) succeed();
      else fail();
    } catch (err) {
      fail();
    }
  });
})();
