/* ================================================================
   MAAZ ZINDANI — WebGL layers (raw WebGL 1.0, no dependencies)
   hero: particle dust · xp: wireframe depth planes + converge bursts
   dive: scatter bursts · forge: velocity line-field
   certs: dot-grid waves · finale: ripple synced to the crane rise
   Every layer shares the Lenis scroll-velocity uniform.
   ================================================================ */

(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger) return;

  /* ---------------- shared state ---------------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, cx: -1, cy: -1 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * -2 + 1;
    mouse.cx = e.clientX;
    mouse.cy = e.clientY;
  });

  let vel = 0;       // smoothed |scroll velocity| — published by main.js
  let velPhase = 0;  // accumulated drift phase (no jumps when velocity changes)

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  function makeProgram(gl, vsrc, fsrc) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    return prog;
  }

  function glFor(id, dprCap, opts) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const gl = canvas.getContext('webgl', Object.assign({ alpha: true, antialias: false, depth: false }, opts));
    if (!gl) { canvas.remove(); return null; }
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    return { canvas, gl, fit };
  }

  const POINT_FRAG = `
    precision mediump float;
    varying float vA;
    void main() {
      float m = 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5));
      gl_FragColor = vec4(0.063, 0.725, 0.506, m * vA);
    }
  `;

  /* ---------------- hero particle dust ---------------- */
  function initParticles() {
    const c = glFor('hero-particles', 2);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeProgram(gl, `
      attribute vec4 aP; // x, y, depth, seed
      uniform float uT;
      uniform float uPhase;
      uniform vec2 uMouse;
      uniform float uDpr;
      varying float vA;
      void main() {
        float d = aP.z;
        float s = aP.w;
        float y = fract(aP.y + uT * (0.008 + 0.02 * d) + uPhase * (0.4 + 0.6 * d));
        float x = fract(aP.x + sin(uT * (0.15 + s) + s * 6.2831) * 0.012 * d);
        vec2 pos = vec2(x, y) + uMouse * (0.012 + 0.03 * d);
        gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = (1.5 + d * 4.0) * uDpr;
        float tw = 0.5 + 0.5 * sin(uT * (0.6 + s * 1.7) + s * 40.0);
        vA = (0.3 + 0.7 * tw) * (0.25 + 0.75 * d) * 0.85;
      }
    `, POINT_FRAG);
    if (!prog) { canvas.remove(); return null; }

    const N = 240;
    const data = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      data[i * 4] = Math.random();
      data[i * 4 + 1] = Math.random();
      data[i * 4 + 2] = 0.15 + Math.random() * 0.85;
      data[i * 4 + 3] = Math.random();
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const locP = gl.getAttribLocation(prog, 'aP');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uPhase = gl.getUniformLocation(prog, 'uPhase');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uDpr = gl.getUniformLocation(prog, 'uDpr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    return {
      resize: fit,
      render(t) {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locP);
        gl.vertexAttribPointer(locP, 4, gl.FLOAT, false, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uT, t);
        gl.uniform1f(uPhase, velPhase);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.uniform1f(uDpr, Math.min(window.devicePixelRatio || 1, 2));
        gl.drawArrays(gl.POINTS, 0, N);
      },
    };
  }

  /* ---------------- burst layer (converge / scatter) ---------------- */
  function makeBurstProgram(gl) {
    return makeProgram(gl, `
      attribute vec4 aR; // angle01, radius01, seed, size01
      uniform vec2 uPos;    // burst point in uv
      uniform float uBT;    // burst progress 0..1
      uniform float uMode;  // 0 converge, 1 scatter
      uniform float uAspect;
      uniform float uDpr;
      varying float vA;
      void main() {
        float ang = aR.x * 6.28318;
        vec2 dir = vec2(cos(ang) / uAspect, sin(ang));
        float rad = mix(0.22, 0.85, aR.y);
        float tIn = 1.0 - pow(1.0 - uBT, 3.0);       // ease-out for converge
        float tOut = pow(uBT, 0.65);                  // fast launch for scatter
        vec2 from = uPos + dir * rad;
        vec2 to = uPos + dir * 0.015;
        vec2 p = (uMode < 0.5) ? mix(from, to, tIn) : mix(uPos, uPos + dir * (rad * 1.6), tOut);
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = (1.0 + aR.w * 3.4) * uDpr;
        float bell = sin(3.14159 * min(uBT, 1.0));
        vA = bell * (0.25 + 0.75 * aR.z);
      }
    `, POINT_FRAG);
  }

  function initBurstLayer(canvasId, mode) {
    const c = glFor(canvasId, 1.75);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeBurstProgram(gl);
    if (!prog) { canvas.remove(); return null; }

    const N = 200;
    const data = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      data[i * 4] = Math.random();
      data[i * 4 + 1] = Math.random();
      data[i * 4 + 2] = Math.random();
      data[i * 4 + 3] = Math.random();
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const locR = gl.getAttribLocation(prog, 'aR');
    const uPos = gl.getUniformLocation(prog, 'uPos');
    const uBT = gl.getUniformLocation(prog, 'uBT');
    const uMode = gl.getUniformLocation(prog, 'uMode');
    const uAspect = gl.getUniformLocation(prog, 'uAspect');
    const uDpr = gl.getUniformLocation(prog, 'uDpr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    const state = { t: 2, x: 0.5, y: 0.5 };
    return {
      resize: fit,
      burst(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        state.x = clientX === undefined || !r.width ? 0.5 : (clientX - r.left) / r.width;
        state.y = clientY === undefined || !r.height ? 0.5 : 1 - (clientY - r.top) / r.height;
        state.t = 0;
      },
      step(dt) { if (state.t < 1.2) state.t += dt * 0.75; },
      render() {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locR);
        gl.vertexAttribPointer(locR, 4, gl.FLOAT, false, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (state.t >= 1) return;
        gl.uniform2f(uPos, state.x, state.y);
        gl.uniform1f(uBT, state.t);
        gl.uniform1f(uMode, mode);
        gl.uniform1f(uAspect, canvas.width / Math.max(canvas.height, 1));
        gl.uniform1f(uDpr, Math.min(window.devicePixelRatio || 1, 1.75));
        gl.drawArrays(gl.POINTS, 0, N);
      },
    };
  }

  /* ---------------- xp: wireframe depth planes + bursts ---------------- */
  function initXPLayer() {
    const c = glFor('xp-gl', 1.75);
    if (!c) return null;
    const { gl, canvas, fit } = c;

    const planeProg = makeProgram(gl, `
      attribute vec2 aLocal;   // unit-plane line vertex
      attribute vec4 aInfo;    // cx, cy, scale, depth
      attribute float aSeed;
      uniform float uT;
      uniform float uProg;     // xp scrub progress
      uniform float uAspect;
      varying float vA;
      void main() {
        float depth = aInfo.w;
        vec2 pos;
        pos.x = aInfo.x + aLocal.x * aInfo.z / uAspect - (uProg - 0.5) * 1.7 * depth;
        pos.y = aInfo.y + aLocal.y * aInfo.z + sin(uT * 0.25 + aSeed * 6.2831) * 0.012 * depth;
        gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
        vA = 0.05 + depth * 0.13;
      }
    `, `
      precision mediump float;
      varying float vA;
      void main() { gl_FragColor = vec4(0.063, 0.725, 0.506, vA); }
    `);
    const burstProg = makeBurstProgram(gl);
    if (!planeProg || !burstProg) { canvas.remove(); return null; }

    // 12 floating plane outlines — 4 edges each, phone-ish aspect
    const PLANES = 12;
    const local = [];
    const rect = [[-0.5, -0.9], [0.5, -0.9], [0.5, 0.9], [-0.5, 0.9]];
    for (let e = 0; e < 4; e++) { local.push(rect[e], rect[(e + 1) % 4]); }
    const pl = [];
    for (let i = 0; i < PLANES; i++) {
      const cx = Math.random() * 2.2 - 0.6;
      const cy = 0.18 + Math.random() * 0.64;
      const sc = 0.08 + Math.random() * 0.16;
      const dp = 0.25 + Math.random() * 0.75;
      const sd = Math.random();
      for (let v = 0; v < 8; v++) {
        pl.push(local[v][0], local[v][1], cx, cy, sc, dp, sd);
      }
    }
    const planeData = new Float32Array(pl);
    const planeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, planeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, planeData, gl.STATIC_DRAW);
    const STRIDE = 7 * 4;
    const pLocal = gl.getAttribLocation(planeProg, 'aLocal');
    const pInfo = gl.getAttribLocation(planeProg, 'aInfo');
    const pSeed = gl.getAttribLocation(planeProg, 'aSeed');
    const pT = gl.getUniformLocation(planeProg, 'uT');
    const pProg = gl.getUniformLocation(planeProg, 'uProg');
    const pAspect = gl.getUniformLocation(planeProg, 'uAspect');

    // burst buffer
    const BN = 200;
    const bData = new Float32Array(BN * 4);
    for (let i = 0; i < BN * 4; i++) bData[i] = Math.random();
    const bBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bBuf);
    gl.bufferData(gl.ARRAY_BUFFER, bData, gl.STATIC_DRAW);
    const bR = gl.getAttribLocation(burstProg, 'aR');
    const bPos = gl.getUniformLocation(burstProg, 'uPos');
    const bBT = gl.getUniformLocation(burstProg, 'uBT');
    const bMode = gl.getUniformLocation(burstProg, 'uMode');
    const bAspect = gl.getUniformLocation(burstProg, 'uAspect');
    const bDpr = gl.getUniformLocation(burstProg, 'uDpr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    const burst = { t: 2, x: 0.5, y: 0.5 };
    return {
      resize: fit,
      burst(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        burst.x = r.width ? (clientX - r.left) / r.width : 0.5;
        burst.y = r.height ? 1 - (clientY - r.top) / r.height : 0.5;
        burst.t = 0;
      },
      step(dt) { if (burst.t < 1.2) burst.t += dt * 0.75; },
      render(t) {
        fit();
        gl.clear(gl.COLOR_BUFFER_BIT);
        const aspect = canvas.width / Math.max(canvas.height, 1);
        // depth planes
        gl.useProgram(planeProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, planeBuf);
        gl.enableVertexAttribArray(pLocal);
        gl.vertexAttribPointer(pLocal, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(pInfo);
        gl.vertexAttribPointer(pInfo, 4, gl.FLOAT, false, STRIDE, 2 * 4);
        gl.enableVertexAttribArray(pSeed);
        gl.vertexAttribPointer(pSeed, 1, gl.FLOAT, false, STRIDE, 6 * 4);
        gl.uniform1f(pT, t);
        gl.uniform1f(pProg, window.__xpProg || 0);
        gl.uniform1f(pAspect, aspect);
        gl.drawArrays(gl.LINES, 0, PLANES * 8);
        // converge burst
        if (burst.t < 1) {
          gl.useProgram(burstProg);
          gl.bindBuffer(gl.ARRAY_BUFFER, bBuf);
          gl.enableVertexAttribArray(bR);
          gl.vertexAttribPointer(bR, 4, gl.FLOAT, false, 0, 0);
          gl.uniform2f(bPos, burst.x, burst.y);
          gl.uniform1f(bBT, burst.t);
          gl.uniform1f(bMode, 0);
          gl.uniform1f(bAspect, aspect);
          gl.uniform1f(bDpr, Math.min(window.devicePixelRatio || 1, 1.75));
          gl.drawArrays(gl.POINTS, 0, BN);
        }
      },
    };
  }

  /* ---------------- forge: velocity-reactive line field ---------------- */
  function initLineField() {
    const c = glFor('forge-gl', 1.25);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeProgram(gl, `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `, `
      precision mediump float;
      uniform vec2 uR;
      uniform float uT;
      uniform float uVel;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      void main() {
        vec2 uv = gl_FragCoord.xy / uR;
        float id = floor(uv.y * 44.0);
        float rnd = hash(vec2(id, 7.0));
        float v = min(uVel, 60.0);
        float speed = mix(0.02, 0.14, rnd) * (1.0 + v * 0.05);
        float x = fract(uv.x * mix(0.7, 1.9, rnd) - uT * speed - rnd * 7.0);
        float len = mix(0.1, 0.32, rnd) * (1.0 + v * 0.025); // dashes stretch with velocity
        float dash = smoothstep(len, 0.0, x) * step(x, len);
        float band = smoothstep(0.5, 0.0, abs(fract(uv.y * 44.0) - 0.5) / 0.07);
        float a = dash * band * (0.05 + 0.09 * rnd) * (1.0 + v * 0.01);
        gl_FragColor = vec4(0.063, 0.725, 0.506, a);
      }
    `);
    if (!prog) { canvas.remove(); return null; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const locPos = gl.getAttribLocation(prog, 'aPos');
    const uR = gl.getUniformLocation(prog, 'uR');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uVel = gl.getUniformLocation(prog, 'uVel');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    return {
      resize: fit,
      render(t) {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uR, canvas.width, canvas.height);
        gl.uniform1f(uT, t);
        gl.uniform1f(uVel, vel);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  /* ---------------- certs: dot-grid wave field ---------------- */
  function initDotGrid() {
    const c = glFor('certs-gl', 1.5);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeProgram(gl, `
      attribute vec2 aUV;
      uniform float uT;
      uniform vec2 uMouse;
      uniform float uVel;
      uniform float uDpr;
      uniform vec2 uR;
      varying float vA;
      void main() {
        vec2 uv = aUV;
        float aspect = uR.x / max(uR.y, 1.0);
        float w = sin(uv.x * 9.0 + uT * 0.6) * cos(uv.y * 7.0 - uT * 0.45);
        w += 0.5 * sin(uv.x * 21.0 - uT * 0.9) * sin(uv.y * 17.0 + uT * 0.7);
        vec2 d = (uv - uMouse) * vec2(aspect, 1.0);
        float dist = length(d);
        float ripple = exp(-dist * 5.0) * sin(dist * 36.0 - uT * 5.0);
        float z = w * 0.5 + ripple * (0.7 + min(uVel, 60.0) * 0.012);
        vec2 pos = uv * 2.0 - 1.0;
        pos.y += z * 0.018;
        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = (0.8 + (z * 0.5 + 0.5) * 2.4) * uDpr;
        vA = 0.05 + 0.32 * (z * 0.5 + 0.5);
      }
    `, POINT_FRAG);
    if (!prog) { canvas.remove(); return null; }

    const COLS = 96, ROWS = 54;
    const grid = new Float32Array(COLS * ROWS * 2);
    let k = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let cc = 0; cc < COLS; cc++) {
        grid[k++] = cc / (COLS - 1);
        grid[k++] = r / (ROWS - 1);
      }
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    const locUV = gl.getAttribLocation(prog, 'aUV');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uVel = gl.getUniformLocation(prog, 'uVel');
    const uDpr = gl.getUniformLocation(prog, 'uDpr');
    const uR = gl.getUniformLocation(prog, 'uR');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    return {
      resize: fit,
      render(t) {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locUV);
        gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 0, 0);
        const rect = canvas.getBoundingClientRect();
        const mu = rect.width ? (mouse.cx - rect.left) / rect.width : -1;
        const mv = rect.height ? 1 - (mouse.cy - rect.top) / rect.height : -1;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uT, t);
        gl.uniform2f(uMouse, mu, mv);
        gl.uniform1f(uVel, vel);
        gl.uniform1f(uDpr, Math.min(window.devicePixelRatio || 1, 1.5));
        gl.uniform2f(uR, canvas.width, canvas.height);
        gl.drawArrays(gl.POINTS, 0, COLS * ROWS);
      },
    };
  }

  /* ---------------- finale: ripple synced to the crane rise ---------------- */
  function initRipple() {
    const c = glFor('finale-gl', 1.25);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeProgram(gl, `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `, `
      precision mediump float;
      uniform vec2 uR;
      uniform float uT;
      uniform float uProgress; // finale scrub 0..1
      uniform float uVel;
      void main() {
        vec2 uv = gl_FragCoord.xy / uR;
        float aspect = uR.x / uR.y;
        vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.04);
        float r = length(p);
        float prog = clamp(uProgress, 0.0, 1.0);
        float wave = sin(r * 26.0 - prog * 24.0 - uT * 1.1);
        float rings = smoothstep(0.25, 1.0, wave) * exp(-r * 2.4) * prog;
        float glow = exp(-r * 3.0) * 0.45 * prog;
        float a = (rings * 0.4 + glow) * (1.0 + min(uVel, 60.0) * 0.006);
        gl_FragColor = vec4(0.063, 0.725, 0.506, a);
      }
    `);
    if (!prog) { canvas.remove(); return null; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const locPos = gl.getAttribLocation(prog, 'aPos');
    const uR = gl.getUniformLocation(prog, 'uR');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uProgress = gl.getUniformLocation(prog, 'uProgress');
    const uVel = gl.getUniformLocation(prog, 'uVel');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    const finale = canvas.closest('.finale');
    if (finale) finale.classList.add('has-gl');

    return {
      resize: fit,
      render(t) {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uR, canvas.width, canvas.height);
        gl.uniform1f(uT, t);
        gl.uniform1f(uProgress, window.__finaleProg || 0);
        gl.uniform1f(uVel, vel);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  /* ---------------- contact: attractor particle field ---------------- */
  function initContactField() {
    const c = glFor('contact-gl', 1.75);
    if (!c) return null;
    const { gl, canvas, fit } = c;
    const prog = makeProgram(gl, `
      attribute vec4 aHome;  // home x, home y, depth, seed
      attribute vec2 aChaos; // scattered start position
      uniform float uT;
      uniform float uForm;    // 0 chaos → 1 formed cluster
      uniform float uBurst;   // success burst 0..1..0
      uniform vec2 uMouse;    // canvas uv
      uniform float uAttract; // 1 desktop, 0 touch
      uniform float uVel;
      uniform float uAspect;
      uniform float uDpr;
      varying float vA;
      void main() {
        float d = aHome.z;
        float s = aHome.w;
        // formed home with a slow orbital swirl
        vec2 swirl = vec2(
          sin(uT * (0.2 + s * 0.3) + s * 6.2831),
          cos(uT * (0.16 + s * 0.24) + s * 12.566)
        ) * (0.012 + 0.02 * d);
        vec2 home = aHome.xy + swirl;
        vec2 p = mix(aChaos, home, uForm);
        // cursor attraction (desktop only)
        vec2 md = uMouse - p;
        float mdist = length(md * vec2(uAspect, 1.0));
        p += md * exp(-mdist * 3.5) * 0.22 * uAttract * uForm;
        // scroll velocity drift
        p.y += min(uVel, 60.0) * 0.0012 * d;
        // success burst pushes outward from center then settles back
        vec2 fromC = p - vec2(0.72, 0.5);
        p += normalize(fromC + 0.0001) * uBurst * (0.25 + 0.5 * s);
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = (1.0 + d * 3.2) * uDpr;
        float tw = 0.5 + 0.5 * sin(uT * (0.5 + s * 2.0) + s * 40.0);
        vA = (0.2 + 0.8 * tw) * (0.2 + 0.8 * d) * (0.35 + 0.65 * uForm);
      }
    `, POINT_FRAG);
    if (!prog) { canvas.remove(); return null; }

    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const N = mobile ? 800 : 2000;
    const home = new Float32Array(N * 4);
    const chaos = new Float32Array(N * 2);
    // loose sphere-ish cluster on the right side (behind the form)
    const CX = mobile ? 0.5 : 0.72;
    for (let i = 0; i < N; i++) {
      const a = i * 2.39996; // golden angle spiral
      const r = 0.30 * Math.sqrt((i + 0.5) / N);
      const wob = 1 + (Math.random() - 0.5) * 0.35;
      home[i * 4] = CX + Math.cos(a) * r * wob * 0.62;
      home[i * 4 + 1] = 0.5 + Math.sin(a) * r * wob;
      home[i * 4 + 2] = 0.15 + Math.random() * 0.85;
      home[i * 4 + 3] = Math.random();
      chaos[i * 2] = Math.random();
      chaos[i * 2 + 1] = Math.random();
    }
    const homeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, homeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, home, gl.STATIC_DRAW);
    const chaosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, chaosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, chaos, gl.STATIC_DRAW);

    const locHome = gl.getAttribLocation(prog, 'aHome');
    const locChaos = gl.getAttribLocation(prog, 'aChaos');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uForm = gl.getUniformLocation(prog, 'uForm');
    const uBurst = gl.getUniformLocation(prog, 'uBurst');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uAttract = gl.getUniformLocation(prog, 'uAttract');
    const uVelU = gl.getUniformLocation(prog, 'uVel');
    const uAspect = gl.getUniformLocation(prog, 'uAspect');
    const uDpr = gl.getUniformLocation(prog, 'uDpr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    const state = { form: 0, burst: 0, burstT: 2 };
    window.__contactFX = {
      setForm(v) { state.form = v; },
      burst() { state.burstT = 0; },
    };

    return {
      resize: fit,
      step(dt) {
        if (state.burstT < 2) {
          state.burstT += dt * 0.9;
          // rise fast, decay slow — sin envelope over first ~1.1s
          state.burst = Math.max(0, Math.sin(Math.min(state.burstT, 1.1) * Math.PI / 1.1)) * 0.9;
        } else state.burst = 0;
      },
      render(t) {
        fit();
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, homeBuf);
        gl.enableVertexAttribArray(locHome);
        gl.vertexAttribPointer(locHome, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, chaosBuf);
        gl.enableVertexAttribArray(locChaos);
        gl.vertexAttribPointer(locChaos, 2, gl.FLOAT, false, 0, 0);
        const rect = canvas.getBoundingClientRect();
        const mu = rect.width ? (mouse.cx - rect.left) / rect.width : -1;
        const mv = rect.height ? 1 - (mouse.cy - rect.top) / rect.height : -1;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uT, t);
        gl.uniform1f(uForm, state.form);
        gl.uniform1f(uBurst, state.burst);
        gl.uniform2f(uMouse, mu, mv);
        gl.uniform1f(uAttract, mobile ? 0 : 1);
        gl.uniform1f(uVelU, vel);
        gl.uniform1f(uAspect, canvas.width / Math.max(canvas.height, 1));
        gl.uniform1f(uDpr, Math.min(window.devicePixelRatio || 1, 1.75));
        gl.drawArrays(gl.POINTS, 0, N);
      },
    };
  }

  /* ---------------- boot + visibility gating ---------------- */
  const effects = [];
  const add = (fx, trigger) => { if (fx) effects.push({ fx, trigger }); return fx; };

  add(initParticles(), '#hero');
  const xpFx = add(initXPLayer(), '#xp');
  const diveFx = add(initBurstLayer('dive-gl', 1), '#dive');
  add(initLineField(), '#forge');
  add(initDotGrid(), '#certs');
  add(initRipple(), '#finale');
  add(initContactField(), '#contact');
  if (!effects.length) return;

  // bursts callable from main.js scroll triggers
  window.__fx = {
    xpBurst(cx, cy) { if (xpFx) xpFx.burst(cx, cy); },
    diveBurst() { if (diveFx) diveFx.burst(); },
  };

  effects.forEach(({ fx, trigger }) => {
    fx.active = false;
    ScrollTrigger.create({
      trigger,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { fx.active = self.isActive; },
    });
  });

  let lastT = 0;
  gsap.ticker.add((time) => {
    const dt = Math.min(time - lastT, 0.1);
    lastT = time;
    vel += ((window.__scrollVel || 0) - vel) * 0.08;
    velPhase += vel * dt * 0.0004;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    effects.forEach(({ fx }) => {
      if (fx.step) fx.step(dt);
      if (fx.active) fx.render(time);
    });
  });

  window.addEventListener('resize', () => effects.forEach(({ fx }) => fx.resize()));
})();
