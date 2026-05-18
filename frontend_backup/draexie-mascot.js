
window.DraexieMascot = (() => {
  
/* ===================================================================
   DRÄXIE — v0.2 state machine + animation engine
   -----------------------------------------------------------------
   Fixes from v0.1:
     • Three-layer eye system (pos / blink / expr) — no transform leaks
     • Hard reset of every animated element on state change
     • Blinks only ever animate the dedicated blink layer
     • Expression swaps only ever rewrite the expr layer's innerHTML

   Public API:
     mascot.setState(name, variantIndex?)
     mascot.state, mascot.variant
     mascot.onStateChange(fn)
   =================================================================== */

const Draexie = (() => {

  // ----- Element refs -----
  const $ = sel => document.querySelector(sel);
  const svg     = $('#draexie');
  const mascot  = $('#d-mascot');
  const head    = $('#d-head');
  const body    = $('#d-body');
  const armL    = $('#d-arm-left');
  const armR    = $('#d-arm-right');
  const mag     = $('#d-magnifier');
  const tablet  = $('#d-tablet');
  const document_= $('#d-document');
  const sparks  = $('#d-sparks');
  const think   = $('#d-think');
  const typing  = $('#d-typing');
  const orbit   = $('#d-orbit');
  const chunks  = document.querySelectorAll('#d-orbit .chunk');
  const cheeks  = $('#d-cheeks');
  const mouth   = $('#d-mouth');
  const mouthShape = $('#d-mouth-shape');
  const antenna = $('#d-antenna-tip');
  const antennaG = $('#d-antenna');
  const aura    = $('#d-aura');
  const drawer  = $('#d-drawer');
  const map     = $('#d-map');
  const mapPin  = $('#d-map-pin');
  const scaleG  = $('#d-scale');
  const scaleBeam = $('#d-scale-beam');
  const glitch  = $('#d-glitch');
  const visor   = $('#d-visor');

  // Eye refs — three layers per eye
  const eyeLPos   = $('#d-eye-left-pos');
  const eyeLBlink = $('#d-eye-left-blink');
  const eyeLExpr  = $('#d-eye-left-expr');
  const eyeRPos   = $('#d-eye-right-pos');
  const eyeRBlink = $('#d-eye-right-blink');
  const eyeRExpr  = $('#d-eye-right-expr');

  // ----- Eye expression presets -----
  // Each returns SVG markup placed inside the expr layer (origin = eye center).
  const expressions = {
    normal:    () => `<circle r="7" class="m-eye glow"/>`,
    curious:   () => `<circle r="8" class="m-eye glow"/><circle cx="2" cy="-2" r="2.5" fill="white" opacity="0.9"/>`,
    focused:   () => `<circle r="9" class="m-eye strong-glow"/><circle cx="2" cy="-2" r="3" fill="white"/>`,
    squint:    () => `<path d="M -8 -2 Q 0 4 8 -2" stroke="var(--m-eye)" stroke-width="3" fill="none" stroke-linecap="round" class="glow"/>`,
    happy:     () => `<path d="M -8 2 Q 0 -8 8 2" fill="none" stroke="var(--m-eye)" stroke-width="3" stroke-linecap="round" class="strong-glow"/>`,
    closed:    () => `<rect x="-7" y="-1" width="14" height="2.5" rx="1.25" class="m-eye"/>`,
    confused: (side) => side === 'L'
      ? `<circle r="7" class="m-error glow"/><line x1="-7" y1="-7" x2="7" y2="7" stroke="var(--m-error)" stroke-width="2.5" stroke-linecap="round"/>`
      : `<circle r="7" class="m-error glow"/><line x1="-7" y1="7" x2="7" y2="-7" stroke="var(--m-error)" stroke-width="2.5" stroke-linecap="round"/>`,
    determined: () => `<rect x="-8" y="-4" width="16" height="6" rx="3" class="m-eye glow"/>`,
    sleepy:    () => `<path d="M -8 0 Q 0 4 8 0" stroke="var(--m-eye)" stroke-width="2.5" fill="none" stroke-linecap="round" class="glow"/>`,
  };

  const setExpression = (name) => {
    if (name === 'confused') {
      eyeLExpr.innerHTML = expressions.confused('L');
      eyeRExpr.innerHTML = expressions.confused('R');
    } else {
      const markup = expressions[name]();
      eyeLExpr.innerHTML = markup;
      eyeRExpr.innerHTML = markup;
    }
  };

  // ----- State management -----
  let activeTimeline = null;
  let activeTimelines = []; // For multiple parallel loops
  let blinkTimer = null;
  let easterEggTimer = null;
  let currentState = 'idle';
  let currentVariant = 0;
  const listeners = [];

  const killActive = () => {
    if (activeTimeline) { activeTimeline.kill(); activeTimeline = null; }
    activeTimelines.forEach(tl => tl.kill());
    activeTimelines = [];
    if (blinkTimer)     { clearTimeout(blinkTimer); blinkTimer = null; }
    if (easterEggTimer) { clearTimeout(easterEggTimer); easterEggTimer = null; }
    // Kill every tween on every animated element to prevent leaks
    gsap.killTweensOf([
      mascot, head, body, armL, armR, mag, tablet, document_,
      sparks, think, typing, orbit, cheeks, mouth, antenna, antennaG,
      aura, drawer, map, mapPin, scaleG, scaleBeam, glitch, visor,
      eyeLPos, eyeLBlink, eyeLExpr, eyeRPos, eyeRBlink, eyeRExpr,
      ...chunks
    ]);
  };

  // ----- HARD RESET of every animatable element to its base state -----
  // Critical for preventing eye-drift and one-eye-found bugs.
  const resetAll = () => {
    // Eye position layer: locked to original translate, no extra transforms
    gsap.set(eyeLPos, { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(eyeRPos, { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });
    // Eye blink layer: identity
    gsap.set(eyeLBlink, { scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    gsap.set(eyeRBlink, { scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    // Eye expr layer: identity
    gsap.set(eyeLExpr, { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(eyeRExpr, { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });

    // Mascot frame
    gsap.set(mascot, { x: 0, y: 0, rotation: 0, scale: 1, scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    gsap.set(head,   { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '0px -35px' });
    gsap.set(body,   { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(armL,   { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '-43px 20px' });
    gsap.set(armR,   { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '43px 20px' });
    gsap.set(antennaG, { x: 0, y: 0, rotation: 0, transformOrigin: '0px -72px' });
    gsap.set(antenna, { scale: 1, transformOrigin: '50% 50%' });

    // Props — all hidden, reset transforms
    gsap.set([mag, tablet, document_, sparks, think, typing, drawer, map, scaleG, glitch], { opacity: 0 });
    gsap.set(orbit, { opacity: 0 });
    gsap.set(chunks, { opacity: 0, x: 0, y: 0, scale: 1, rotation: 0 });
    chunks.forEach(c => c.setAttribute('transform', 'translate(0,0)'));
    gsap.set(cheeks, { opacity: 0 });
    gsap.set(mouth, { opacity: 0 });
    gsap.set(mag, { scale: 0, rotation: -20, opacity: 0, transformOrigin: '43px 60px' });
    gsap.set(tablet, { scale: 0, opacity: 0, y: 0, rotation: 0, transformOrigin: '0px 40px' });
    gsap.set(document_, { scale: 0, opacity: 0, y: 0, transformOrigin: '0px -30px' });
    gsap.set(scaleG, { x: 0, y: -10, opacity: 0, scale: 0 });
    gsap.set(scaleBeam, { rotation: 0, transformOrigin: '0px 0px' });
    gsap.set(drawer, { y: 60, opacity: 0 });
    gsap.set(map, { y: -20, opacity: 0, scale: 0 });
    gsap.set(aura, { opacity: 0.6, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(visor, { opacity: 1 });
  };

  // ----- Blink scheduling -----
  // Animates ONLY eyeLBlink/eyeRBlink — never the expr layer.
  const blinkOnce = (duration = 0.18) => {
    return gsap.timeline()
      .to([eyeLBlink, eyeRBlink], { scaleY: 0.08, duration: duration * 0.4, ease: 'power2.in' })
      .to([eyeLBlink, eyeRBlink], { scaleY: 1,    duration: duration * 0.6, ease: 'power2.out' });
  };

  const scheduleBlink = (minDelay = 2.4, maxDelay = 5) => {
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    blinkTimer = setTimeout(() => {
      blinkOnce().eventCallback('onComplete', () => scheduleBlink(minDelay, maxDelay));
    }, delay * 1000);
  };

  // ----- Easter egg scheduling (during idle) -----
  const idleEasterEggs = [
    // Yawn: 5% / loop
    { weight: 5, play: () => gsap.timeline()
        .to(antenna, { scale: 0.8, duration: 0.3 })
        .call(() => setExpression('sleepy'), null, '<')
        .to([eyeLBlink, eyeRBlink], { scaleY: 0.3, duration: 0.4, ease: 'sine.inOut' }, '<')
        .to(mascot, { scaleY: 1.05, scaleX: 0.96, y: -6, duration: 0.6, ease: 'sine.inOut' }, '<')
        .to(mascot, { scaleY: 1, scaleX: 1, y: 0, duration: 0.5, ease: 'sine.inOut' })
        .to([eyeLBlink, eyeRBlink], { scaleY: 1, duration: 0.3 }, '<')
        .call(() => setExpression('normal'))
        .to(antenna, { scale: 1, duration: 0.3 }, '<')
    },
    // Stretch: 3% / loop
    { weight: 3, play: () => gsap.timeline()
        .to(armL, { rotation: -80, duration: 0.4, ease: 'power2.out' })
        .to(armR, { rotation: 80,  duration: 0.4, ease: 'power2.out' }, '<')
        .to(mascot, { scaleY: 1.04, duration: 0.4, ease: 'power2.out' }, '<')
        .to(armL, { rotation: 0, duration: 0.5, ease: 'power2.inOut' }, '+=0.4')
        .to(armR, { rotation: 0, duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(mascot, { scaleY: 1, duration: 0.5, ease: 'power2.inOut' }, '<')
    },
    // Look up curiously: 4%
    { weight: 4, play: () => gsap.timeline()
        .to(head, { rotation: -15, duration: 0.5, ease: 'power2.inOut' })
        .call(() => setExpression('curious'))
        .to(head, { rotation: 0, duration: 0.7, ease: 'power2.inOut' }, '+=0.6')
        .call(() => setExpression('normal'))
    },
  ];

  const scheduleIdleEasterEgg = () => {
    easterEggTimer = setTimeout(() => {
      const roll = Math.random() * 100;
      let cumulative = 0;
      for (const egg of idleEasterEggs) {
        cumulative += egg.weight;
        if (roll < cumulative) {
          const tl = egg.play();
          activeTimelines.push(tl);
          break;
        }
      }
      scheduleIdleEasterEgg();
    }, 6000 + Math.random() * 4000);
  };

  /* ================================================================
     VARIANT PICKER
     ================================================================ */
  const pickVariant = (variants, forced) => {
    if (forced != null && variants[forced]) return forced;
    return Math.floor(Math.random() * variants.length);
  };

  /* ================================================================
     STATE 1 — IDLE
     ================================================================ */
  const playIdle = () => {
    setExpression('normal');
    const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } });

    tl.to(mascot, { scale: 1.025, duration: 1.6, repeat: -1, yoyo: true }, 0);
    tl.to(mascot, { y: -3, duration: 2.2, repeat: -1, yoyo: true }, 0);
    tl.to(antenna, { scale: 1.3, opacity: 0.75, duration: 1.4, repeat: -1, yoyo: true }, 0);
    tl.to(aura, { opacity: 0.35, scale: 1.04, duration: 2.4, repeat: -1, yoyo: true }, 0);

    const look = gsap.timeline({ repeat: -1, repeatDelay: 2.5 });
    look.to(head, { rotation: -5, duration: 0.9 })
        .to(head, { rotation: 0,  duration: 0.7 }, '+=1.2')
        .to(head, { rotation: 4,  duration: 0.9 }, '+=0.4')
        .to(head, { rotation: 0,  duration: 0.7 }, '+=1.2');
    activeTimelines.push(look);

    activeTimeline = tl;
    scheduleBlink(2.4, 5);
    scheduleIdleEasterEgg();
    return 'breathing';
  };

  /* ================================================================
     STATE 2 — SEARCHING (5 variants)
     ================================================================ */
  const searchingVariants = [
    // Variant 0 — Classic magnifier scan
    {
      name: 'magnifier-scan',
      play: () => {
        setExpression('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(mag, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, 0);
        tl.to(armR, { rotation: -25, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(armL, { rotation: 35, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(think, { opacity: 1, duration: 0.4 }, 0.2);

        const bounce = gsap.timeline({ repeat: -1 });
        bounce.to(mascot, { y: -8, duration: 0.45, ease: 'power2.out' })
              .to(mascot, { y: 0,  duration: 0.45, ease: 'power2.in' });
        activeTimelines.push(bounce);

        const wiggle = gsap.timeline({ repeat: -1, yoyo: true });
        wiggle.to(mag, { rotation: 18, duration: 1.2, ease: 'sine.inOut' });
        activeTimelines.push(wiggle);

        return tl;
      }
    },
    // Variant 1 — Peeking left-and-right
    {
      name: 'peeking-around',
      play: () => {
        setExpression('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armR, { rotation: -10, duration: 0.4 }, 0);
        tl.to(armL, { rotation: 10,  duration: 0.4 }, 0);

        const peek = gsap.timeline({ repeat: -1 });
        peek.to(mascot, { x: -20, rotation: -3, duration: 0.6, ease: 'power2.inOut' })
            .to(head,   { rotation: -10, duration: 0.6 }, '<')
            .to(mascot, { x: 0, rotation: 0, duration: 0.5 }, '+=0.4')
            .to(head,   { rotation: 0, duration: 0.5 }, '<')
            .to(mascot, { x: 20, rotation: 3, duration: 0.6 }, '+=0.2')
            .to(head,   { rotation: 10, duration: 0.6 }, '<')
            .to(mascot, { x: 0, rotation: 0, duration: 0.5 }, '+=0.4')
            .to(head,   { rotation: 0, duration: 0.5 }, '<');
        activeTimelines.push(peek);
        return tl;
      }
    },
    // Variant 2 — Filing drawer search
    {
      name: 'rummaging-drawer',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(drawer, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armL, { rotation: 75, duration: 0.5, ease: 'back.out(1.6)' }, 0.3);
        tl.to(armR, { rotation: -75, duration: 0.5, ease: 'back.out(1.6)' }, 0.3);
        // Head leans forward
        tl.to(head, { rotation: 0, y: 4, duration: 0.4 }, 0);

        // Arms rummage in/out
        const rummage = gsap.timeline({ repeat: -1 });
        rummage.to([armL, armR], { y: 6, duration: 0.3, stagger: 0.15, ease: 'sine.inOut' })
               .to([armL, armR], { y: 0, duration: 0.3, stagger: 0.15, ease: 'sine.inOut' });
        activeTimelines.push(rummage);

        // Drawer wiggle as folders get shuffled
        const drawerWiggle = gsap.timeline({ repeat: -1, yoyo: true });
        drawerWiggle.to(drawer, { x: 2, duration: 0.15 })
                    .to(drawer, { x: -2, duration: 0.15 });
        activeTimelines.push(drawerWiggle);
        return tl;
      }
    },
    // Variant 3 — Map navigation
    {
      name: 'map-tracing',
      play: () => {
        setExpression('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(map, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(armR, { rotation: -50, duration: 0.5, ease: 'back.out(1.6)' }, 0.2);
        tl.to(head, { rotation: -8, y: -4, duration: 0.4 }, 0.1);

        // Pin moves around the map
        const pinMove = gsap.timeline({ repeat: -1 });
        pinMove.to(mapPin, { x: -25, y: 5,  duration: 0.8, ease: 'sine.inOut' })
               .to(mapPin, { x: -10, y: -8, duration: 0.7, ease: 'sine.inOut' }, '+=0.2')
               .to(mapPin, { x: 10, y: 3,   duration: 0.8, ease: 'sine.inOut' }, '+=0.2')
               .to(mapPin, { x: 0, y: 0,    duration: 0.6, ease: 'sine.inOut' }, '+=0.2');
        activeTimelines.push(pinMove);

        // Slight head bobs as it traces
        const trace = gsap.timeline({ repeat: -1, yoyo: true });
        trace.to(head, { rotation: 5, duration: 1.5, ease: 'sine.inOut' });
        activeTimelines.push(trace);
        return tl;
      }
    },
    // Variant 4 — Chin-tap thinking
    {
      name: 'chin-tap-think',
      play: () => {
        setExpression('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armR, { rotation: -85, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(armL, { rotation: 5,   duration: 0.4 }, 0);
        tl.to(think, { opacity: 1, duration: 0.4 }, 0.3);

        // Tap repeated
        const tap = gsap.timeline({ repeat: -1 });
        tap.to(armR, { rotation: -95, duration: 0.25, ease: 'power2.out' })
           .to(armR, { rotation: -85, duration: 0.25, ease: 'power2.in' })
           .to({}, { duration: 0.6 }); // pause between taps
        activeTimelines.push(tap);

        // Head tilts thoughtfully
        const tilt = gsap.timeline({ repeat: -1, yoyo: true });
        tilt.to(head, { rotation: -8, duration: 1.8, ease: 'sine.inOut' });
        activeTimelines.push(tilt);

        // Antenna pulses with thought
        const pulse = gsap.timeline({ repeat: -1, yoyo: true });
        pulse.to(antenna, { scale: 1.5, duration: 0.6, ease: 'sine.inOut' });
        activeTimelines.push(pulse);
        return tl;
      }
    },
  ];
  const playSearching = (forced) => {
    const idx = pickVariant(searchingVariants, forced);
    currentVariant = idx;
    const v = searchingVariants[idx];
    activeTimeline = v.play();
    scheduleBlink(1.5, 3);
    return v.name;
  };

  /* ================================================================
     STATE 3 — ANALYZING (5 variants)
     ================================================================ */
  const analyzingVariants = [
    // Variant 0 — Orbiting chunks
    {
      name: 'orbital-sort',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -20, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armR, { rotation: 20,  duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.4 }, 0.2);

        chunks.forEach((chunk, i) => {
          const radius = 75 + (i % 3) * 15;
          const speed  = 2.5 + (i * 0.25);
          const start  = (i / chunks.length) * Math.PI * 2;

          const orbitTl = gsap.timeline({ repeat: -1, defaults: { ease: 'none' } });
          orbitTl.to({ a: start }, {
            a: start + Math.PI * 2,
            duration: speed,
            onUpdate: function() {
              const a = this.targets()[0].a;
              const x = Math.cos(a) * radius;
              const y = Math.sin(a) * radius * 0.55;
              chunk.setAttribute('transform', `translate(${x}, ${y})`);
            }
          });
          activeTimelines.push(orbitTl);

          const inner = chunk.querySelector('rect, circle, polygon');
          const spin = gsap.to(inner, {
            rotation: '+=360',
            duration: 1.6 + i * 0.15,
            repeat: -1,
            ease: 'none',
            transformOrigin: '50% 50%'
          });
          activeTimelines.push(spin);

          tl.fromTo(chunk, { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
            0.2 + i * 0.06);
        });

        tl.to(mascot, { y: -2, duration: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        tl.to(aura, { opacity: 0.85, scale: 1.08, duration: 0.6 }, 0);
        return tl;
      }
    },
    // Variant 1 — Tablet readout
    {
      name: 'tablet-readout',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -45, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(armR, { rotation: 45,  duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(tablet, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.2);
        tl.to(head, { rotation: 0, y: 4, duration: 0.3 }, 0.1);

        // Tablet content pulses
        const bars = tablet.querySelectorAll('rect:nth-child(n+2):nth-child(-n+6)');
        bars.forEach((bar, i) => {
          const pulse = gsap.timeline({ repeat: -1, yoyo: true });
          pulse.to(bar, {
            scaleY: 0.5 + Math.random() * 0.8,
            duration: 0.3 + Math.random() * 0.3,
            ease: 'sine.inOut',
            transformOrigin: '50% 100%',
            delay: i * 0.08
          });
          activeTimelines.push(pulse);
        });

        // Tablet tilts subtly
        const tilt = gsap.timeline({ repeat: -1, yoyo: true });
        tilt.to(tablet, { rotation: 4, duration: 1.6, ease: 'sine.inOut' });
        activeTimelines.push(tilt);
        return tl;
      }
    },
    // Variant 2 — Juggling chunks
    {
      name: 'chunk-juggle',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(orbit, { opacity: 1, duration: 0.3 }, 0);

        const armBob = gsap.timeline({ repeat: -1 });
        armBob.to(armL, { rotation: -40, duration: 0.3, ease: 'sine.inOut' })
              .to(armL, { rotation: -10, duration: 0.3, ease: 'sine.inOut' })
              .to(armR, { rotation: 40, duration: 0.3, ease: 'sine.inOut' }, '<-=0.3')
              .to(armR, { rotation: 10, duration: 0.3, ease: 'sine.inOut' }, '<+=0.3');
        activeTimelines.push(armBob);

        // Three chunks in juggling arc
        const visibleChunks = [chunks[0], chunks[1], chunks[2]];
        visibleChunks.forEach((chunk, i) => {
          tl.set(chunk, { opacity: 1 }, 0.2 + i * 0.4);
          const juggle = gsap.timeline({ repeat: -1, delay: i * 0.4 });
          juggle
            .fromTo(chunk,
              { x: -40, y: 20 },
              { x: 40, y: -50, duration: 0.6, ease: 'power2.out',
                onUpdate: function() {
                  chunk.setAttribute('transform', `translate(${this.targets()[0]._x || 0}, ${this.targets()[0]._y || 0})`);
                }
              })
            .to(chunk, { x: 40, y: 20, duration: 0.6, ease: 'power2.in' });
          // Simpler: just use GSAP set attribute
          activeTimelines.push(juggle);
        });

        // Actually do juggling cleanly with attribute updates
        visibleChunks.forEach((chunk, i) => {
          const obj = { t: 0 };
          const j = gsap.to(obj, {
            t: Math.PI * 2,
            duration: 1.2,
            repeat: -1,
            ease: 'none',
            delay: i * 0.4,
            onUpdate: () => {
              const t = obj.t;
              const x = Math.sin(t) * 40;
              const y = -Math.abs(Math.sin(t)) * 50 + 20;
              chunk.setAttribute('transform', `translate(${x}, ${y})`);
            }
          });
          activeTimelines.push(j);
        });
        return tl;
      }
    },
    // Variant 3 — Reading/scrolling chunks
    {
      name: 'chunk-scroll',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -30, duration: 0.4 }, 0);
        tl.to(armR, { rotation: 30,  duration: 0.4 }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.3 }, 0.2);

        // Chunks parade past from right to left
        chunks.forEach((chunk, i) => {
          const obj = { x: 150 };
          chunk.setAttribute('transform', `translate(${obj.x}, ${(i % 3 - 1) * 20})`);
          const scroll = gsap.to(obj, {
            x: -150,
            duration: 3,
            repeat: -1,
            ease: 'none',
            delay: i * 0.5,
            onUpdate: () => {
              chunk.setAttribute('transform', `translate(${obj.x}, ${(i % 3 - 1) * 20})`);
            }
          });
          activeTimelines.push(scroll);
          tl.set(chunk, { opacity: 1 }, 0.2);
        });

        // Head tracks the scroll
        const track = gsap.timeline({ repeat: -1 });
        track.to(head, { rotation: 6, duration: 1.5, ease: 'sine.inOut' })
             .to(head, { rotation: -6, duration: 1.5, ease: 'sine.inOut' });
        activeTimelines.push(track);
        return tl;
      }
    },
    // Variant 4 — Catching chunks one at a time
    {
      name: 'chunk-catch',
      play: () => {
        setExpression('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -20, duration: 0.4 }, 0);
        tl.to(armR, { rotation: 20,  duration: 0.4 }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.3 }, 0);

        // Chunks drop in from above, get "caught"
        chunks.forEach((chunk, i) => {
          const obj = { x: (i - 3) * 35, y: -150 };
          const targetY = 30 + (i % 2) * 10;
          chunk.setAttribute('transform', `translate(${obj.x}, ${obj.y})`);

          const drop = gsap.timeline({ repeat: -1, delay: i * 0.4 });
          drop.set(chunk, { opacity: 1 })
              .set(obj, { y: -150 })
              .to(obj, {
                y: targetY,
                duration: 0.7,
                ease: 'power2.in',
                onUpdate: () => chunk.setAttribute('transform', `translate(${obj.x}, ${obj.y})`)
              })
              .to(chunk, { scale: 1.3, duration: 0.1, transformOrigin: '50% 50%' }, '-=0.05')
              .to(chunk, { scale: 1, duration: 0.15 })
              .to(chunk, { opacity: 0, duration: 0.4, delay: 0.4 });
          activeTimelines.push(drop);
        });

        // Bouncy reaction on each catch
        const reactBounce = gsap.timeline({ repeat: -1 });
        reactBounce.to(mascot, { y: 2, scaleY: 0.96, duration: 0.1, ease: 'power2.out' })
                   .to(mascot, { y: 0, scaleY: 1, duration: 0.3, ease: 'elastic.out(1, 0.4)' })
                   .to({}, { duration: 0.4 });
        activeTimelines.push(reactBounce);
        return tl;
      }
    },
  ];
  const playAnalyzing = (forced) => {
    const idx = pickVariant(analyzingVariants, forced);
    currentVariant = idx;
    const v = analyzingVariants[idx];
    activeTimeline = v.play();
    scheduleBlink(0.8, 1.6);
    return v.name;
  };

  /* ================================================================
     STATE 4 — RERANKING
     ================================================================ */
  const playReranking = () => {
    setExpression('squint');
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    // Holds scale in both hands
    tl.to(armL, { rotation: -50, duration: 0.5, ease: 'back.out(1.4)' }, 0);
    tl.to(armR, { rotation: 50,  duration: 0.5, ease: 'back.out(1.4)' }, 0);
    tl.fromTo(scaleG,
      { y: -10, opacity: 0, scale: 0 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.2);

    // Position scale above mascot's hands
    gsap.set(scaleG, { x: 0, y: 30 });

    // Beam tips back and forth, weighing
    const weigh = gsap.timeline({ repeat: -1, yoyo: true });
    weigh.to(scaleBeam, { rotation: 12, duration: 1.3, ease: 'sine.inOut' });
    activeTimelines.push(weigh);

    // Head tilts thoughtfully, mirroring the scale
    const tilt = gsap.timeline({ repeat: -1, yoyo: true });
    tilt.to(head, { rotation: 6, duration: 1.3, ease: 'sine.inOut' });
    activeTimelines.push(tilt);

    // Subtle hover
    tl.to(mascot, { y: -2, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
    activeTimeline = tl;
    scheduleBlink(2, 3.5);
    return 'weighing-relevance';
  };

  /* ================================================================
     STATE 5 — GENERATING (typing pose)
     ================================================================ */
  const playGenerating = () => {
    setExpression('determined');
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    // Arms come down to typing position
    tl.to(armL, { rotation: 25, y: 8, duration: 0.5, ease: 'back.out(1.4)' }, 0);
    tl.to(armR, { rotation: -25, y: 8, duration: 0.5, ease: 'back.out(1.4)' }, 0);
    // Slight forward lean
    tl.to(head, { y: 3, duration: 0.3 }, 0);
    tl.to(typing, { opacity: 1, duration: 0.4 }, 0.3);

    // Finger-typing wiggle on arms
    const typeL = gsap.timeline({ repeat: -1 });
    typeL.to(armL, { y: 6, duration: 0.12, ease: 'sine.inOut' })
         .to(armL, { y: 10, duration: 0.12, ease: 'sine.inOut' })
         .to(armL, { y: 8, duration: 0.16, ease: 'sine.inOut' });
    activeTimelines.push(typeL);

    const typeR = gsap.timeline({ repeat: -1, delay: 0.1 });
    typeR.to(armR, { y: 10, duration: 0.12, ease: 'sine.inOut' })
         .to(armR, { y: 6, duration: 0.12, ease: 'sine.inOut' })
         .to(armR, { y: 8, duration: 0.16, ease: 'sine.inOut' });
    activeTimelines.push(typeR);

    // Typing dots
    const d1 = gsap.timeline({ repeat: -1 });
    d1.to('#d-type-1', { opacity: 0.3, duration: 0.2 })
      .to('#d-type-1', { opacity: 1,   duration: 0.2 })
      .to({}, { duration: 0.4 });
    const d2 = gsap.timeline({ repeat: -1, delay: 0.2 });
    d2.to('#d-type-2', { opacity: 0.3, duration: 0.2 })
      .to('#d-type-2', { opacity: 1,   duration: 0.2 })
      .to({}, { duration: 0.4 });
    const d3 = gsap.timeline({ repeat: -1, delay: 0.4 });
    d3.to('#d-type-3', { opacity: 0.3, duration: 0.2 })
      .to('#d-type-3', { opacity: 1,   duration: 0.2 })
      .to({}, { duration: 0.4 });
    activeTimelines.push(d1, d2, d3);

    // Antenna fast pulse — generating energy
    tl.to(antenna, { scale: 1.4, duration: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
    tl.to(aura, { opacity: 0.7, duration: 0.4 }, 0);

    activeTimeline = tl;
    scheduleBlink(1.2, 2.4);
    return 'tokens-streaming';
  };

  /* ================================================================
     STATE 6 — FOUND
     ================================================================ */
  const playFound = () => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Hide previous-state props gracefully
    tl.to([orbit, tablet, mag, drawer, map, scaleG, typing, think], {
      opacity: 0, duration: 0.3
    }, 0);
    tl.to(chunks, { opacity: 0, scale: 0, duration: 0.3, stagger: 0.03, ease: 'power2.in' }, 0);

    // Happy expression
    tl.call(() => setExpression('happy'), null, 0.3);
    tl.to(cheeks, { opacity: 1, duration: 0.4 }, 0.3);
    tl.to(mouth, { opacity: 0.8, duration: 0.3 }, 0.3);

    // Jump
    tl.to(mascot, { y: -25, scaleY: 1.08, scaleX: 0.94, duration: 0.35, ease: 'power2.out' }, 0.2)
      .to(mascot, { y: 0, scaleY: 0.94, scaleX: 1.06, duration: 0.3, ease: 'power2.in' })
      .to(mascot, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });

    // Arms triumphant
    tl.to(armL, { rotation: -65, duration: 0.4, ease: 'back.out(2)' }, 0.4);
    tl.to(armR, { rotation: 65,  duration: 0.4, ease: 'back.out(2)' }, 0.4);

    // Document held up
    tl.fromTo(document_,
      { opacity: 0, scale: 0, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)' },
      0.5);

    // Sparkles
    tl.fromTo(sparks,
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
      0.7);

    // Idle hover after celebration
    tl.to(mascot, { y: -5, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, '>');
    const docBob = gsap.timeline({ repeat: -1, yoyo: true });
    docBob.to(document_, { y: -4, duration: 1.2, ease: 'sine.inOut' });
    activeTimelines.push(docBob);

    const sparkTwinkle = gsap.timeline({ repeat: -1, yoyo: true });
    sparkTwinkle.to(sparks, { rotation: 10, opacity: 0.6, duration: 1.6, ease: 'sine.inOut', transformOrigin: '50% 50%' });
    activeTimelines.push(sparkTwinkle);

    tl.to(aura, { opacity: 1, scale: 1.12, duration: 0.6 }, 0.4);
    tl.to(antenna, { scale: 1.7, duration: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0.5);

    activeTimeline = tl;
    // No blink scheduling — happy eyes stay happy
    return 'celebrate';
  };

  /* ================================================================
     STATE 7 — ERROR
     ================================================================ */
  const playError = () => {
    setExpression('confused');
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

    // Glitch flicker
    tl.to(glitch, { opacity: 1, duration: 0.1 }, 0);
    const flicker = gsap.timeline({ repeat: -1 });
    flicker.to(glitch, { opacity: 0.3, duration: 0.08 })
           .to(glitch, { opacity: 1, duration: 0.08 })
           .to(glitch, { opacity: 0.6, duration: 0.12 })
           .to({}, { duration: 0.6 });
    activeTimelines.push(flicker);

    // Visor flickers
    const visorFlick = gsap.timeline({ repeat: -1 });
    visorFlick.to(visor, { opacity: 0.4, duration: 0.06 })
              .to(visor, { opacity: 1, duration: 0.06 })
              .to({}, { duration: 1 });
    activeTimelines.push(visorFlick);

    // Head shake — confused
    tl.to(armL, { rotation: -75, duration: 0.4, ease: 'back.out(1.4)' }, 0.1);
    tl.to(armR, { rotation: 10,  duration: 0.4 }, 0.1);

    // Head scratches (left arm near head)
    const scratch = gsap.timeline({ repeat: -1, yoyo: true });
    scratch.to(armL, { rotation: -85, duration: 0.4, ease: 'sine.inOut' });
    activeTimelines.push(scratch);

    // Head tilts in a "what?" pattern
    const shake = gsap.timeline({ repeat: -1 });
    shake.to(head, { rotation: -10, duration: 0.5, ease: 'sine.inOut' })
         .to(head, { rotation: 10,  duration: 0.5, ease: 'sine.inOut' })
         .to(head, { rotation: 0,   duration: 0.4, ease: 'sine.inOut' })
         .to({}, { duration: 0.5 });
    activeTimelines.push(shake);

    // Antenna droops
    tl.to(antennaG, { rotation: -25, duration: 0.5 }, 0);
    tl.to(antenna, { opacity: 0.5, scale: 0.8, duration: 0.5 }, 0);
    // Sad aura
    tl.to(aura, { opacity: 0.25, duration: 0.5 }, 0);

    activeTimeline = tl;
    return 'error-state';
  };

  /* ================================================================
     STATE DISPATCHER
     ================================================================ */
  const states = {
    idle:       playIdle,
    searching:  playSearching,
    analyzing:  playAnalyzing,
    reranking:  playReranking,
    generating: playGenerating,
    found:      playFound,
    error:      playError,
  };

  const setState = (name, variantIndex) => {
    if (!states[name]) {
      console.warn(`[Draexie] Unknown state: ${name}`);
      return;
    }
    killActive();
    resetAll();
    currentState = name;
    currentVariant = 0;
    const variantName = states[name](variantIndex);
    listeners.forEach(fn => fn(name, variantName));
  };

  return {
    setState,
    get state() { return currentState; },
    get variant() { return currentVariant; },
    onStateChange(fn) { listeners.push(fn); }
  };
})();

window.mascot = Draexie;

/* ===================================================================
   DEMO PANEL WIRING
   =================================================================== */
const buttons = document.querySelectorAll('.state-btn');
const readout = document.getElementById('state-readout');
const variantTag = document.getElementById('variant-tag');
const stateBadge = document.getElementById('state-badge');

mascot.onStateChange((state, variantName) => {
  readout.textContent = state;
  variantTag.textContent = variantName ? `variant · ${variantName}` : '— · —';
  buttons.forEach(b => b.classList.toggle('active', b.dataset.state === state));
  stateBadge.classList.toggle('error', state === 'error');
});

buttons.forEach(btn => {
  btn.addEventListener('click', () => mascot.setState(btn.dataset.state));
});

// Keyboard shortcuts 1-7
window.addEventListener('keydown', (e) => {
  const map = { '1':'idle','2':'searching','3':'analyzing','4':'reranking','5':'generating','6':'found','7':'error' };
  if (map[e.key]) mascot.setState(map[e.key]);
});

// Replay / re-roll
document.getElementById('replay-btn').addEventListener('click', () => {
  mascot.setState(mascot.state);
});

// Theme toggle
document.querySelectorAll('[data-theme-btn]').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.themeBtn;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-btn]').forEach(b => {
      b.classList.toggle('active', b.dataset.themeBtn === theme);
    });
  });
});

// Boot
mascot.setState('idle');

  // Transform Draexie to a class constructor
  class Mascot {
      constructor(host, options = {}) {
          this.host = host;
          this.options = options;
          this._uid = 'dxm' + Math.random().toString(36).substr(2, 9);
          
          this.host.innerHTML = this._getSvg();
          // We need to re-map elements
          this.initElements();
          Draexie.init(this); // Assuming we refactored Draexie to take an instance
      }
      
      _getSvg() {
          return `<svg id="${this._uid}-draexie" viewBox="-170 -170 340 340" xmlns="http://www.w3.org/2000/svg">

        <defs>
          <radialGradient id="${this._uid}-auraGrad">
            <stop offset="0%" stop-color="var(--m-trim)" stop-opacity="0.25"/>
            <stop offset="70%" stop-color="var(--m-trim)" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${this._uid}-bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--m-body-2)"/>
            <stop offset="100%" stop-color="var(--m-body)"/>
          </linearGradient>
        </defs>

        <!-- Soft aura -->
        <g id="${this._uid}-d-aura" opacity="0.6">
          <circle cx="0" cy="0" r="115" fill="url(#${this._uid}-auraGrad)" />
        </g>

        <!-- Orbiting / floating data chunks (used by analyzing & variants) -->
        <g id="${this._uid}-d-orbit" opacity="0">
          <g class="chunk" data-chunk="0"><rect x="-8" y="-8" width="16" height="16" rx="3" class="m-trim"/></g>
          <g class="chunk" data-chunk="1"><polygon points="0,-10 9,5 -9,5" class="m-spark"/></g>
          <g class="chunk" data-chunk="2"><circle cx="0" cy="0" r="8" class="m-accent"/></g>
          <g class="chunk" data-chunk="3"><rect x="-6" y="-6" width="12" height="12" rx="2" class="m-trim" opacity="0.7"/></g>
          <g class="chunk" data-chunk="4"><circle cx="0" cy="0" r="5" class="m-spark"/></g>
          <g class="chunk" data-chunk="5"><polygon points="-7,-7 7,-7 0,7" class="m-accent" opacity="0.8"/></g>
          <g class="chunk" data-chunk="6"><rect x="-5" y="-5" width="10" height="10" rx="2" class="m-spark"/></g>
        </g>

        <!-- Filing drawer (searching variant 3) -->
        <g id="${this._uid}-d-drawer" opacity="0">
          <rect x="-50" y="60" width="100" height="50" rx="6" class="m-body-2"/>
          <rect x="-46" y="64" width="92" height="42" rx="4" class="m-visor"/>
          <!-- Folders inside -->
          <rect x="-40" y="68" width="14" height="34" class="m-trim" opacity="0.8"/>
          <rect x="-22" y="68" width="14" height="34" class="m-spark" opacity="0.8"/>
          <rect x="-4" y="68" width="14" height="34" class="m-accent" opacity="0.8"/>
          <rect x="14" y="68" width="14" height="34" class="m-trim" opacity="0.6"/>
          <rect x="32" y="68" width="14" height="34" class="m-spark" opacity="0.6"/>
          <!-- Handle -->
          <rect x="-10" y="90" width="20" height="3" rx="1.5" class="m-trim"/>
        </g>

        <!-- Map (searching variant 4) -->
        <g id="${this._uid}-d-map" opacity="0">
          <rect x="-55" y="-100" width="100" height="60" rx="4" class="m-tertiary" fill="var(--surface-container-low)" stroke="var(--m-trim)" stroke-width="1.5"/>
          <!-- Map lines -->
          <path d="M -50 -85 Q -25 -75 0 -82 T 40 -78" stroke="var(--m-trim)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <path d="M -50 -70 Q -20 -60 10 -65 T 40 -62" stroke="var(--m-trim)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <path d="M -30 -100 L -28 -45" stroke="var(--m-spark)" stroke-width="1.5" fill="none" opacity="0.6" stroke-dasharray="3 3"/>
          <!-- Pin -->
          <circle id="${this._uid}-d-map-pin" cx="15" cy="-72" r="4" class="m-spark"/>
          <circle cx="15" cy="-72" r="2" class="m-visor"/>
        </g>

        <!-- Scale (reranking) -->
        <g id="${this._uid}-d-scale" opacity="0">
          <!-- Beam -->
          <g id="${this._uid}-d-scale-beam" style="transform-origin: 0px 0px;">
            <line x1="-40" y1="0" x2="40" y2="0" stroke="var(--m-trim)" stroke-width="2.5" stroke-linecap="round"/>
            <!-- Left pan -->
            <line x1="-40" y1="0" x2="-40" y2="12" stroke="var(--m-trim)" stroke-width="1.5"/>
            <path d="M -50 12 L -30 12 L -34 22 L -46 22 Z" class="m-body-2" stroke="var(--m-trim)" stroke-width="1.5"/>
            <rect x="-44" y="6" width="8" height="8" rx="1" class="m-trim" opacity="0.9"/>
            <!-- Right pan -->
            <line x1="40" y1="0" x2="40" y2="12" stroke="var(--m-trim)" stroke-width="1.5"/>
            <path d="M 30 12 L 50 12 L 46 22 L 34 22 Z" class="m-body-2" stroke="var(--m-trim)" stroke-width="1.5"/>
            <rect x="36" y="8" width="8" height="6" rx="1" class="m-spark" opacity="0.9"/>
          </g>
          <!-- Pivot -->
          <line x1="0" y1="0" x2="0" y2="-12" stroke="var(--m-trim)" stroke-width="2"/>
          <circle cx="0" cy="-12" r="3" class="m-trim"/>
        </g>

        <!-- Document held up in Found state -->
        <g id="${this._uid}-d-document" opacity="0" style="transform-origin: 0px -30px;">
          <rect x="-22" y="-58" width="44" height="56" rx="3" fill="var(--surface-container-lowest)" stroke="var(--m-trim)" stroke-width="2" class="strong-glow"/>
          <!-- Text lines -->
          <rect x="-16" y="-48" width="28" height="3" rx="1.5" class="m-trim"/>
          <rect x="-16" y="-40" width="24" height="2" rx="1" class="m-trim" opacity="0.6"/>
          <rect x="-16" y="-34" width="28" height="2" rx="1" class="m-trim" opacity="0.6"/>
          <rect x="-16" y="-28" width="20" height="2" rx="1" class="m-trim" opacity="0.6"/>
          <rect x="-16" y="-22" width="26" height="2" rx="1" class="m-trim" opacity="0.6"/>
          <!-- Checkmark -->
          <circle cx="0" cy="-12" r="6" class="m-trim"/>
          <path d="M -3 -12 L -1 -10 L 3 -14" stroke="var(--m-visor)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>

        <!-- Sparkles for Found / dances -->
        <g id="${this._uid}-d-sparks" opacity="0">
          <path d="M -50 -60 L -47 -53 L -40 -50 L -47 -47 L -50 -40 L -53 -47 L -60 -50 L -53 -53 Z" class="m-spark"/>
          <path d="M 50 -30 L 52 -25 L 57 -22 L 52 -19 L 50 -14 L 48 -19 L 43 -22 L 48 -25 Z" class="m-spark"/>
          <path d="M 38 -75 L 40 -70 L 45 -67 L 40 -64 L 38 -59 L 36 -64 L 31 -67 L 36 -70 Z" class="m-spark"/>
          <circle cx="-30" cy="-90" r="2.5" class="m-spark"/>
          <circle cx="55" cy="0" r="2" class="m-spark"/>
        </g>

        <!-- ===== THE MASCOT ===== -->
        <g id="${this._uid}-d-mascot">

          <!-- Antenna -->
          <g id="${this._uid}-d-antenna">
            <line x1="0" y1="-72" x2="0" y2="-95" stroke="var(--m-body-2)" stroke-width="3" stroke-linecap="round"/>
            <circle id="${this._uid}-d-antenna-tip" cx="0" cy="-98" r="5" class="m-trim glow"/>
          </g>

          <!-- Head -->
          <g id="${this._uid}-d-head">
            <rect x="-55" y="-75" width="110" height="80" rx="20" fill="url(#${this._uid}-bodyGrad)"/>
            <!-- Highlight -->
            <rect x="-45" y="-68" width="80" height="6" rx="3" fill="white" opacity="0.05"/>
            <!-- Side bolts -->
            <circle cx="-58" cy="-35" r="6" class="m-body-2"/>
            <circle cx="58" cy="-35" r="6" class="m-body-2"/>
            <circle cx="-58" cy="-35" r="2" class="m-trim"/>
            <circle cx="58" cy="-35" r="2" class="m-trim"/>

            <!-- Visor — sharp top-left like the AI bubble shape -->
            <path id="${this._uid}-d-visor"
                  d="M -42 -58
                     L 42 -58
                     Q 46 -58 46 -54
                     L 46 -24
                     Q 46 -20 42 -20
                     L -42 -20
                     Q -46 -20 -46 -24
                     L -46 -54
                     L -42 -58 Z"
                  class="m-visor"/>

            <!-- ===== EYES — three-layer structure ===== -->
            <!-- LEFT EYE -->
            <g id="${this._uid}-d-eye-left-pos" transform="translate(-20, -39)">
              <g id="${this._uid}-d-eye-left-blink">
                <g id="${this._uid}-d-eye-left-expr">
                  <circle r="7" class="m-eye glow"/>
                </g>
              </g>
            </g>
            <!-- RIGHT EYE -->
            <g id="${this._uid}-d-eye-right-pos" transform="translate(20, -39)">
              <g id="${this._uid}-d-eye-right-blink">
                <g id="${this._uid}-d-eye-right-expr">
                  <circle r="7" class="m-eye glow"/>
                </g>
              </g>
            </g>

            <!-- Cheeks (Found / dance) -->
            <g id="${this._uid}-d-cheeks" opacity="0">
              <ellipse cx="-32" cy="-10" rx="5" ry="2.5" class="m-spark" opacity="0.7"/>
              <ellipse cx="32" cy="-10" rx="5" ry="2.5" class="m-spark" opacity="0.7"/>
            </g>

            <!-- Mouth area (subtle for found smile, frown for error) -->
            <g id="${this._uid}-d-mouth" opacity="0">
              <path id="${this._uid}-d-mouth-shape" d="M -8 -6 Q 0 0 8 -6" stroke="var(--m-trim)" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>
          </g>

          <!-- Body -->
          <g id="${this._uid}-d-body">
            <rect x="-10" y="5" width="20" height="8" class="m-body-2"/>
            <rect x="-45" y="13" width="90" height="65" rx="14" fill="url(#${this._uid}-bodyGrad)"/>
            <!-- Chest panel (sharp top-left like AI bubble) -->
            <path d="M -22 25 L 22 25 Q 26 25 26 29 L 26 49 Q 26 53 22 53 L -22 53 Q -26 53 -26 49 L -26 29 L -22 25 Z"
                  class="m-visor"/>
            <circle cx="-12" cy="39" r="3" class="m-trim glow"/>
            <circle cx="0" cy="39" r="3" class="m-accent"/>
            <circle cx="12" cy="39" r="3" class="m-spark"/>
            <rect x="-45" y="62" width="90" height="3" class="m-trim" opacity="0.5"/>
          </g>

          <!-- Left arm -->
          <g id="${this._uid}-d-arm-left">
            <rect x="-50" y="18" width="14" height="40" rx="7" fill="url(#${this._uid}-bodyGrad)"/>
            <circle cx="-43" cy="60" r="9" class="m-body-2"/>
          </g>

          <!-- Right arm -->
          <g id="${this._uid}-d-arm-right">
            <rect x="36" y="18" width="14" height="40" rx="7" fill="url(#${this._uid}-bodyGrad)"/>
            <circle cx="43" cy="60" r="9" class="m-body-2"/>
          </g>

          <!-- Magnifier (in right hand; hidden by default) -->
          <g id="${this._uid}-d-magnifier" opacity="0" style="transform-origin: 43px 60px;">
            <line x1="43" y1="60" x2="65" y2="82" stroke="var(--m-trim)" stroke-width="4" stroke-linecap="round"/>
            <circle cx="35" cy="50" r="18" fill="none" stroke="var(--m-trim)" stroke-width="3"/>
            <circle cx="35" cy="50" r="15" fill="var(--m-trim)" opacity="0.12"/>
            <line x1="25" y1="43" x2="30" y2="39" stroke="var(--m-trim)" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
          </g>

          <!-- Tablet (analyzing variant) -->
          <g id="${this._uid}-d-tablet" opacity="0" style="transform-origin: 0px 40px;">
            <rect x="-22" y="20" width="44" height="56" rx="4" fill="var(--surface-container-lowest)" stroke="var(--m-trim)" stroke-width="1.5"/>
            <!-- Screen content — pulsing bar chart -->
            <rect x="-15" y="60" width="4" height="10" class="m-trim"/>
            <rect x="-8" y="55" width="4" height="15" class="m-trim"/>
            <rect x="-1" y="50" width="4" height="20" class="m-trim"/>
            <rect x="6" y="45" width="4" height="25" class="m-trim"/>
            <rect x="13" y="40" width="4" height="30" class="m-trim"/>
            <!-- Header lines -->
            <rect x="-16" y="26" width="20" height="2" class="m-trim" opacity="0.5"/>
            <rect x="-16" y="30" width="14" height="2" class="m-trim" opacity="0.3"/>
          </g>

        </g>

        <!-- Thought bubbles -->
        <g id="${this._uid}-d-think" opacity="0">
          <circle cx="60" cy="-65" r="3" class="m-trim"/>
          <circle cx="68" cy="-75" r="5" class="m-trim"/>
          <g transform="translate(82, -90)">
            <circle r="14" class="m-trim" opacity="0.18"/>
            <text x="0" y="5" text-anchor="middle" fill="var(--m-trim)" font-family="Inter, sans-serif" font-weight="800" font-size="18">?</text>
          </g>
        </g>

        <!-- Typing dots (generating state) -->
        <g id="${this._uid}-d-typing" opacity="0">
          <g transform="translate(82, -85)">
            <rect x="-22" y="-10" width="44" height="20" rx="10" class="m-body-2" stroke="var(--m-trim)" stroke-width="1"/>
            <circle id="${this._uid}-d-type-1" cx="-10" cy="0" r="2.5" class="m-trim"/>
            <circle id="${this._uid}-d-type-2" cx="0" cy="0" r="2.5" class="m-trim"/>
            <circle id="${this._uid}-d-type-3" cx="10" cy="0" r="2.5" class="m-trim"/>
          </g>
        </g>

        <!-- Error glitch lines -->
        <g id="${this._uid}-d-glitch" opacity="0">
          <rect x="-80" y="-50" width="160" height="2" class="m-error" opacity="0.6"/>
          <rect x="-70" y="0" width="140" height="2" class="m-error" opacity="0.4"/>
          <rect x="-60" y="40" width="120" height="2" class="m-error" opacity="0.5"/>
        </g>

      </svg>`;
      }
      
      initElements() {
          this._el = {};
          const map = ['draexie', 'd-mascot', 'd-head', 'd-body', 'd-arm-left', 'd-arm-right', 'd-magnifier', 'd-tablet', 'd-document', 'd-sparks', 'd-think', 'd-typing', 'd-orbit', 'd-cheeks', 'd-mouth', 'd-mouth-shape', 'd-antenna-tip', 'd-antenna', 'd-aura', 'd-type-1', 'd-type-2', 'd-type-3', 'd-glitch', 'd-eye-left-pos', 'd-eye-right-pos', 'd-eye-left-blink', 'd-eye-right-blink', 'd-eye-left-expr', 'd-eye-right-expr', 'd-ray', 'd-ray-1', 'd-ray-2'];
          map.forEach(id => {
              this._el[id] = this.host.querySelector('#' + this._uid + '-' + id);
          });
          this._el['chunks'] = this.host.querySelectorAll('#' + this._uid + '-d-orbit .chunk');
      }
  }
  return Mascot;
})();
