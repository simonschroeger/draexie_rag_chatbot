/* ================================================================
   DRÄXIE — mascot animation engine v0.3
   API: mascot.setState(name, variantIndex?) · .state · .variant · .caption
   ================================================================ */

(function () {

  // ----- Element refs -----
  const $ = sel => document.querySelector(sel);
  const svg      = $('#draexie');
  const mascot   = $('#d-mascot');
  const head     = $('#d-head');
  const body     = $('#d-body');
  const armL     = $('#d-arm-left');
  const armR     = $('#d-arm-right');
  const mag      = $('#d-magnifier');
  const tablet   = $('#d-tablet');
  const document_= $('#d-document');
  const sparks   = $('#d-sparks');
  const think    = $('#d-think');
  const typing   = $('#d-typing');
  const orbit    = $('#d-orbit');
  const chunks   = document.querySelectorAll('#d-orbit .chunk');
  const cheeks   = $('#d-cheeks');
  const mouth    = $('#d-mouth');
  const mouthShape = $('#d-mouth-shape');
  const antenna  = $('#d-antenna-tip');
  const antennaG = $('#d-antenna');
  const aura     = $('#d-aura');
  const drawer   = $('#d-drawer');
  const map      = $('#d-map');
  const mapPin   = $('#d-map-pin');
  const scaleG   = $('#d-scale');
  const scaleBeam= $('#d-scale-beam');
  const glitch   = $('#d-glitch');
  const visor    = $('#d-visor');
  const eyeLPos  = $('#d-eye-left-pos');
  const eyeLBlink= $('#d-eye-left-blink');
  const eyeLExpr = $('#d-eye-left-expr');
  const eyeRPos  = $('#d-eye-right-pos');
  const eyeRBlink= $('#d-eye-right-blink');
  const eyeRExpr = $('#d-eye-right-expr');
  const type1    = $('#d-type-1');
  const type2    = $('#d-type-2');
  const type3    = $('#d-type-3');

  // Eye pos layers have NO SVG transform attr — GSAP owns their position entirely.
  gsap.set(eyeLPos, { x: -20, y: -39 });
  gsap.set(eyeRPos, { x:  20, y: -39 });

  // ----- Eye expression presets -----
  const EYE = {
    normal:     () => `<circle r="7" class="m-eye glow"/>`,
    curious:    () => `<circle r="8" class="m-eye glow"/><circle cx="2" cy="-2" r="2.5" fill="white" opacity="0.9"/>`,
    focused:    () => `<circle r="9" class="m-eye strong-glow"/><circle cx="2" cy="-2" r="3" fill="white"/>`,
    squint:     () => `<path d="M -8 -2 Q 0 4 8 -2" stroke="var(--m-eye)" stroke-width="3" fill="none" stroke-linecap="round" class="glow"/>`,
    happy:      () => `<path d="M -8 2 Q 0 -8 8 2" fill="none" stroke="var(--m-eye)" stroke-width="3" stroke-linecap="round" class="strong-glow"/>`,
    closed:     () => `<rect x="-7" y="-1" width="14" height="2.5" rx="1.25" class="m-eye"/>`,
    confused:   (s) => s === 'L'
      ? `<circle r="7" class="m-error glow"/><line x1="-7" y1="-7" x2="7" y2="7" stroke="var(--m-error)" stroke-width="2.5" stroke-linecap="round"/>`
      : `<circle r="7" class="m-error glow"/><line x1="-7" y1="7" x2="7" y2="-7" stroke="var(--m-error)" stroke-width="2.5" stroke-linecap="round"/>`,
    determined: () => `<rect x="-8" y="-4" width="16" height="6" rx="3" class="m-eye glow"/>`,
    sleepy:     () => `<path d="M -8 0 Q 0 4 8 0" stroke="var(--m-eye)" stroke-width="2.5" fill="none" stroke-linecap="round" class="glow"/>`,
    wide:       () => `<circle r="10" class="m-eye strong-glow"/><circle cx="3" cy="-3" r="3.5" fill="white" opacity="0.95"/>`,
    heart:      () => `<path d="M 0 5 L -7 -2 Q -9 -9 0 -6 Q 9 -9 7 -2 Z" fill="var(--m-error)" style="filter:drop-shadow(0 0 4px var(--m-error))"/>`,
  };

  const setExpr = (name) => {
    if (name === 'confused') {
      eyeLExpr.innerHTML = EYE.confused('L');
      eyeRExpr.innerHTML = EYE.confused('R');
    } else {
      const m = EYE[name]();
      eyeLExpr.innerHTML = m;
      eyeRExpr.innerHTML = m;
    }
  };

  // ----- State management -----
  let activeTimeline  = null;
  let activeTimelines = [];
  let blinkTimer      = null;
  let easterEggTimer  = null;
  let currentState    = 'idle';
  let currentVariant  = 0;
  const listeners     = [];

  const killActive = () => {
    if (activeTimeline) { activeTimeline.kill(); activeTimeline = null; }
    activeTimelines.forEach(tl => tl.kill());
    activeTimelines = [];
    if (blinkTimer)     { clearTimeout(blinkTimer); blinkTimer = null; }
    if (easterEggTimer) { clearTimeout(easterEggTimer); easterEggTimer = null; }
    gsap.killTweensOf([
      mascot, head, body, armL, armR, mag, tablet, document_,
      sparks, think, typing, orbit, cheeks, mouth, antenna, antennaG,
      aura, drawer, map, mapPin, scaleG, scaleBeam, glitch, visor,
      eyeLPos, eyeLBlink, eyeLExpr, eyeRPos, eyeRBlink, eyeRExpr,
      type1, type2, type3, ...chunks,
    ]);
  };

  const resetAll = () => {
    // Eyes: pos layer MUST restore its x/y — no SVG transform attr, GSAP owns it
    gsap.set(eyeLPos,   { x: -20, y: -39, rotation: 0, scale: 1 });
    gsap.set(eyeRPos,   { x:  20, y: -39, rotation: 0, scale: 1 });
    gsap.set(eyeLBlink, { scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    gsap.set(eyeRBlink, { scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    gsap.set(eyeLExpr,  { x: 0, y: 0, rotation: 0, scale: 1 });
    gsap.set(eyeRExpr,  { x: 0, y: 0, rotation: 0, scale: 1 });

    gsap.set(mascot,    { x: 0, y: 0, rotation: 0, scale: 1, scaleX: 1, scaleY: 1, transformOrigin: '50% 50%' });
    gsap.set(head,      { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '0px -35px' });
    gsap.set(body,      { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(armL,      { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '-43px 20px' });
    gsap.set(armR,      { x: 0, y: 0, rotation: 0, scale: 1, transformOrigin: '43px 20px' });
    gsap.set(antennaG,  { x: 0, y: 0, rotation: 0, transformOrigin: '0px -72px' });
    gsap.set(antenna,   { scale: 1, opacity: 1, transformOrigin: '50% 50%' });

    gsap.set([mag, tablet, document_, sparks, think, typing, drawer, map, scaleG, glitch], { opacity: 0 });
    gsap.set(orbit,     { opacity: 0 });
    gsap.set(chunks,    { opacity: 0, scale: 1, rotation: 0 });
    chunks.forEach(c => c.setAttribute('transform', 'translate(0,0)'));
    gsap.set(cheeks,    { opacity: 0 });
    gsap.set(mouth,     { opacity: 0 });
    gsap.set(mag,       { scale: 0, rotation: -20, opacity: 0, transformOrigin: '43px 60px' });
    gsap.set(tablet,    { scale: 0, opacity: 0, y: 0, rotation: 0, transformOrigin: '0px 40px' });
    gsap.set(document_, { scale: 0, opacity: 0, y: 0, transformOrigin: '0px -30px' });
    gsap.set(scaleG,    { x: 0, y: -10, opacity: 0, scale: 0 });
    gsap.set(scaleBeam, { rotation: 0, transformOrigin: '0px 0px' });
    gsap.set(drawer,    { y: 60, opacity: 0 });
    gsap.set(map,       { y: -20, opacity: 0, scale: 0 });
    gsap.set(aura,      { opacity: 0.6, scale: 1, transformOrigin: '50% 50%' });
    gsap.set(visor,     { opacity: 1 });
  };

  // ----- Blink -----
  const blinkOnce = (dur = 0.18) => gsap.timeline()
    .to([eyeLBlink, eyeRBlink], { scaleY: 0.07, duration: dur * 0.4, ease: 'power2.in',  transformOrigin: '50% 50%' })
    .to([eyeLBlink, eyeRBlink], { scaleY: 1,    duration: dur * 0.6, ease: 'power2.out', transformOrigin: '50% 50%' });

  const scheduleBlink = (min = 2.5, max = 5.5) => {
    blinkTimer = setTimeout(() => {
      blinkOnce().eventCallback('onComplete', () => scheduleBlink(min, max));
    }, (min + Math.random() * (max - min)) * 1000);
  };

  // Double-blink (used in some easter eggs)
  const doubleBlink = () => gsap.timeline()
    .add(blinkOnce(0.14))
    .add(blinkOnce(0.14), '+=0.12');

  // ----- Idle easter eggs -----
  const idleEggs = [
    // Yawn — weight 5
    { w: 5, play: () => gsap.timeline()
        .to(antenna, { scale: 0.75, duration: 0.4, ease: 'sine.inOut' })
        .call(() => setExpr('sleepy'), null, '<')
        .to([eyeLBlink, eyeRBlink], { scaleY: 0.25, duration: 0.5, ease: 'sine.inOut', transformOrigin: '50% 50%' }, '<')
        .to(mascot, { scaleY: 1.06, scaleX: 0.95, y: -7, duration: 0.7, ease: 'sine.inOut' }, '<')
        .to(mascot, { scaleY: 1, scaleX: 1, y: 0, duration: 0.6, ease: 'sine.inOut' }, '+=0.3')
        .to([eyeLBlink, eyeRBlink], { scaleY: 1, duration: 0.4, ease: 'sine.inOut', transformOrigin: '50% 50%' }, '<')
        .call(() => setExpr('normal'))
        .to(antenna, { scale: 1, duration: 0.4, ease: 'sine.inOut' }, '<')
    },
    // Stretch arms — weight 3
    { w: 3, play: () => gsap.timeline()
        .to([armL, armR], { rotation: (i) => i === 0 ? -85 : 85, duration: 0.5, ease: 'back.out(1.4)' })
        .to(mascot, { scaleY: 1.05, duration: 0.5, ease: 'power2.out' }, '<')
        .to([armL, armR], { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }, '+=0.5')
        .to(mascot, { scaleY: 1, duration: 0.5, ease: 'power2.inOut' }, '<')
    },
    // Look around curiously — weight 4
    { w: 4, play: () => gsap.timeline()
        .call(() => setExpr('curious'))
        .to(head, { rotation: -18, duration: 0.6, ease: 'power2.inOut' })
        .to(head, { rotation: 12, duration: 1.0, ease: 'power2.inOut' }, '+=0.5')
        .to(head, { rotation: 0, duration: 0.6, ease: 'power2.inOut' }, '+=0.4')
        .call(() => setExpr('normal'))
    },
    // Wave — weight 2
    { w: 2, play: () => {
        const tl = gsap.timeline();
        tl.to(armR, { rotation: -70, duration: 0.35, ease: 'back.out(2)' });
        for (let i = 0; i < 3; i++) {
          tl.to(armR, { rotation: -55, duration: 0.22, ease: 'sine.inOut' })
            .to(armR, { rotation: -80, duration: 0.22, ease: 'sine.inOut' });
        }
        tl.to(armR, { rotation: 0, duration: 0.5, ease: 'back.inOut(1.4)' });
        return tl;
    }},
    // Surprised jolt — weight 2
    { w: 2, play: () => gsap.timeline()
        .call(() => setExpr('wide'))
        .to(mascot, { y: -18, scaleY: 0.92, scaleX: 1.08, duration: 0.18, ease: 'power3.out' })
        .to(antennaG, { rotation: 15, duration: 0.12, ease: 'power2.out' }, '<')
        .to(mascot, { y: 0, scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
        .to(antennaG, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, '<')
        .to({}, { duration: 0.4 })
        .call(() => setExpr('normal'))
    },
    // Little groove dance — weight 1
    { w: 1, play: () => gsap.timeline()
        .call(() => setExpr('happy'))
        .to(mascot, { x: -8, rotation: -3, duration: 0.25, ease: 'sine.inOut' })
        .to(armL, { rotation: -30, duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(armR, { rotation: 20,  duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(mascot, { x:  8, rotation:  3, duration: 0.25, ease: 'sine.inOut' })
        .to(armL, { rotation: 20,  duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(armR, { rotation: -30, duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(mascot, { x: -8, rotation: -3, duration: 0.25, ease: 'sine.inOut' })
        .to(armL, { rotation: -30, duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(armR, { rotation: 20,  duration: 0.25, ease: 'sine.inOut' }, '<')
        .to(mascot, { x: 0, rotation: 0, duration: 0.35, ease: 'power2.inOut' })
        .to([armL, armR], { rotation: 0, duration: 0.35, ease: 'power2.inOut' }, '<')
        .call(() => setExpr('normal'))
    },
    // Spin (rare) — weight 0.5
    { w: 0.5, play: () => gsap.timeline()
        .to(mascot, { scaleX: 0, duration: 0.25, ease: 'power2.in' })
        .set(mascot, { scaleX: -1 })
        .to(mascot, { scaleX: 0, duration: 0.25, ease: 'power2.out' })
        .set(mascot, { scaleX: 1 })
        .to(mascot, { scaleX: 0, duration: 0.2, ease: 'power2.in' })
        .set(mascot, { scaleX: -1 })
        .to(mascot, { scaleX: 0, duration: 0.2, ease: 'power2.out' })
        .set(mascot, { scaleX: 1 })
        .to(mascot, { scaleY: 1.08, y: -8, duration: 0.2, ease: 'power2.out' })
        .to(mascot, { scaleY: 1, y: 0, duration: 0.35, ease: 'elastic.out(1, 0.5)' })
    },
    // Heart eyes (legendary) — weight 0.2
    { w: 0.2, play: () => gsap.timeline()
        .call(() => setExpr('heart'))
        .to(antenna, { scale: 1.6, duration: 0.4, ease: 'back.out(2)' })
        .to(cheeks, { opacity: 1, duration: 0.3 }, '<')
        .to(mascot, { y: -6, duration: 0.5, ease: 'sine.inOut' })
        .to(mascot, { y: 0, duration: 0.5, ease: 'sine.inOut' }, '+=0.3')
        .to({}, { duration: 0.4 })
        .call(() => setExpr('normal'))
        .to(cheeks, { opacity: 0, duration: 0.3 }, '<')
        .to(antenna, { scale: 1, duration: 0.4, ease: 'power2.inOut' }, '<')
    },
  ];

  const scheduleIdleEgg = () => {
    easterEggTimer = setTimeout(() => {
      const total = idleEggs.reduce((s, e) => s + e.w, 0);
      let roll = Math.random() * total;
      for (const egg of idleEggs) {
        roll -= egg.w;
        if (roll <= 0) { activeTimelines.push(egg.play()); break; }
      }
      scheduleIdleEgg();
    }, 7000 + Math.random() * 5000);
  };

  const pick = (arr, forced) => (forced != null && arr[forced]) ? forced : Math.floor(Math.random() * arr.length);

  /* ============================================================ IDLE */
  const playIdle = () => {
    setExpr('normal');
    const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } });
    tl.to(mascot,  { scale: 1.02, duration: 1.8, repeat: -1, yoyo: true }, 0);
    tl.to(mascot,  { y: -4, duration: 2.4, repeat: -1, yoyo: true }, 0);
    tl.to(antenna, { scale: 1.25, opacity: 0.8, duration: 1.6, repeat: -1, yoyo: true }, 0);
    tl.to(aura,    { opacity: 0.3, scale: 1.05, duration: 2.8, repeat: -1, yoyo: true }, 0);

    const look = gsap.timeline({ repeat: -1, repeatDelay: 3 });
    look.to(head, { rotation: -5, duration: 1.0, ease: 'power1.inOut' })
        .to(head, { rotation:  0, duration: 0.8, ease: 'power1.inOut' }, '+=1.4')
        .to(head, { rotation:  4, duration: 1.0, ease: 'power1.inOut' }, '+=0.5')
        .to(head, { rotation:  0, duration: 0.8, ease: 'power1.inOut' }, '+=1.4');
    activeTimelines.push(look);
    activeTimeline = tl;
    scheduleBlink(2.5, 5.5);
    scheduleIdleEgg();
    return 'breathing';
  };

  /* ============================================================ SEARCHING (5 variants) */
  const searchV = [
    { name: 'magnifier-scan', play: () => {
        setExpr('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(mag,   { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.8)' }, 0);
        tl.to(armR,  { rotation: -22, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(armL,  { rotation:  30, duration: 0.5, ease: 'back.out(1.6)' }, 0);
        tl.to(think, { opacity: 1, duration: 0.5 }, 0.3);

        const bounce = gsap.timeline({ repeat: -1, repeatDelay: 0.1 });
        bounce.to(mascot, { y: -7, duration: 0.5, ease: 'power1.out' })
              .to(mascot, { y:  0, duration: 0.5, ease: 'power1.in' });
        activeTimelines.push(bounce);

        const wiggle = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.05 });
        wiggle.to(mag, { rotation: 20, duration: 1.4, ease: 'sine.inOut' });
        activeTimelines.push(wiggle);
        return tl;
    }},
    { name: 'peeking-around', play: () => {
        setExpr('curious');
        const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } });
        tl.to([armL, armR], { rotation: (i) => i === 0 ? 8 : -8, duration: 0.4 }, 0);

        const peek = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
        peek.to(mascot, { x: -13, rotation: -2.5, duration: 0.8, ease: 'power1.inOut' })
            .to(head,   { rotation: -8, duration: 0.8 }, '<')
            .to(mascot, { x: 0, rotation: 0, duration: 0.6, ease: 'power1.inOut' }, '+=0.5')
            .to(head,   { rotation: 0, duration: 0.6 }, '<')
            .to(mascot, { x: 13, rotation: 2.5, duration: 0.8, ease: 'power1.inOut' }, '+=0.2')
            .to(head,   { rotation: 8, duration: 0.8 }, '<')
            .to(mascot, { x: 0, rotation: 0, duration: 0.6, ease: 'power1.inOut' }, '+=0.5')
            .to(head,   { rotation: 0, duration: 0.6 }, '<');
        activeTimelines.push(peek);
        return tl;
    }},
    { name: 'rummaging-drawer', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(drawer, { y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.3)' }, 0);
        tl.to(armL,   { rotation:  72, duration: 0.5, ease: 'back.out(1.5)' }, 0.25);
        tl.to(armR,   { rotation: -72, duration: 0.5, ease: 'back.out(1.5)' }, 0.25);
        tl.to(head,   { y: 5, duration: 0.4 }, 0);

        const rummage = gsap.timeline({ repeat: -1, repeatDelay: 0.1 });
        rummage.to([armL, armR], { y: 7, duration: 0.32, stagger: 0.12, ease: 'sine.inOut' })
               .to([armL, armR], { y: 0, duration: 0.32, stagger: 0.12, ease: 'sine.inOut' });
        activeTimelines.push(rummage);

        const dw = gsap.timeline({ repeat: -1, yoyo: true });
        dw.to(drawer, { x: 2.5, duration: 0.18, ease: 'none' }).to(drawer, { x: -2.5, duration: 0.18, ease: 'none' });
        activeTimelines.push(dw);
        return tl;
    }},
    { name: 'map-tracing', play: () => {
        setExpr('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(map,  { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0);
        tl.to(armR, { rotation: -48, duration: 0.5, ease: 'back.out(1.5)' }, 0.2);
        tl.to(head, { rotation: -7, y: -3, duration: 0.5 }, 0.1);

        const pin = gsap.timeline({ repeat: -1 });
        pin.to(mapPin, { x: -24, y:  6, duration: 1.0, ease: 'sine.inOut' })
           .to(mapPin, { x: -8,  y: -9, duration: 0.8, ease: 'sine.inOut' }, '+=0.15')
           .to(mapPin, { x: 12,  y:  4, duration: 0.9, ease: 'sine.inOut' }, '+=0.15')
           .to(mapPin, { x:  0,  y:  0, duration: 0.7, ease: 'sine.inOut' }, '+=0.15');
        activeTimelines.push(pin);

        const trace = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2 });
        trace.to(head, { rotation: 5, duration: 1.8, ease: 'sine.inOut' });
        activeTimelines.push(trace);
        return tl;
    }},
    { name: 'chin-tap-think', play: () => {
        setExpr('curious');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armR,  { rotation: -82, duration: 0.5, ease: 'back.out(1.5)' }, 0);
        tl.to(armL,  { rotation: 6,   duration: 0.4 }, 0);
        tl.to(think, { opacity: 1, duration: 0.5 }, 0.3);

        const tap = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
        tap.to(armR, { rotation: -92, duration: 0.22, ease: 'power2.out' })
           .to(armR, { rotation: -82, duration: 0.22, ease: 'power2.in' });
        activeTimelines.push(tap);

        const tilt = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 });
        tilt.to(head, { rotation: -9, duration: 2.0, ease: 'sine.inOut' });
        activeTimelines.push(tilt);

        const pulse = gsap.timeline({ repeat: -1, yoyo: true });
        pulse.to(antenna, { scale: 1.45, duration: 0.7, ease: 'sine.inOut' });
        activeTimelines.push(pulse);
        return tl;
    }},
  ];

  const playSearching = (forced) => {
    const idx = pick(searchV, forced);
    currentVariant = idx;
    activeTimeline = searchV[idx].play();
    scheduleBlink(1.6, 3.2);
    return searchV[idx].name;
  };

  /* ============================================================ ANALYZING (5 variants) */
  const analyzeV = [
    { name: 'orbital-sort', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL,  { rotation: -18, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armR,  { rotation:  18, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.5 }, 0.2);
        tl.to(aura,  { opacity: 0.85, scale: 1.09, duration: 0.7 }, 0);

        chunks.forEach((chunk, i) => {
          const r     = 72 + (i % 3) * 18;
          const speed = 2.8 + i * 0.22;
          const start = (i / chunks.length) * Math.PI * 2;
          const obj   = { a: start };
          const orb = gsap.to(obj, { a: start + Math.PI * 2, duration: speed, repeat: -1, ease: 'none',
            onUpdate: () => chunk.setAttribute('transform', `translate(${Math.cos(obj.a)*r},${Math.sin(obj.a)*r*0.52})`)
          });
          activeTimelines.push(orb);
          const inner = chunk.querySelector('rect,circle,polygon');
          if (inner) activeTimelines.push(gsap.to(inner, { rotation: '+=360', duration: 1.8+i*0.18, repeat: -1, ease: 'none', transformOrigin: '50% 50%' }));
          tl.fromTo(chunk, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 0.25+i*0.07);
        });

        tl.to(mascot, { y: -2, duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        return tl;
    }},
    { name: 'tablet-readout', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL,   { rotation: -42, duration: 0.5, ease: 'back.out(1.5)' }, 0);
        tl.to(armR,   { rotation:  42, duration: 0.5, ease: 'back.out(1.5)' }, 0);
        tl.to(tablet, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.2);
        tl.to(head,   { y: 4, duration: 0.4 }, 0.1);

        const bars = tablet.querySelectorAll('rect:nth-child(n+2):nth-child(-n+6)');
        bars.forEach((bar, i) => {
          const p = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: Math.random() * 0.3 });
          p.to(bar, { scaleY: 0.4 + Math.random() * 0.9, duration: 0.28 + Math.random() * 0.3, ease: 'sine.inOut', transformOrigin: '50% 100%', delay: i * 0.09 });
          activeTimelines.push(p);
        });
        const tilt = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.3 });
        tilt.to(tablet, { rotation: 4, duration: 1.8, ease: 'sine.inOut' });
        activeTimelines.push(tilt);
        const nod = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
        nod.to(head, { rotation: -4, duration: 0.5, ease: 'sine.inOut' }).to(head, { rotation: 0, duration: 0.5, ease: 'sine.inOut' });
        activeTimelines.push(nod);
        return tl;
    }},
    { name: 'chunk-stream', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL,  { rotation: -28, duration: 0.45 }, 0);
        tl.to(armR,  { rotation:  28, duration: 0.45 }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.35 }, 0.2);

        chunks.forEach((chunk, i) => {
          const lane = (i % 3 - 1) * 22;
          const obj  = { x: 160 };
          chunk.setAttribute('transform', `translate(${obj.x},${lane})`);
          const s = gsap.to(obj, { x: -160, duration: 2.8 + i * 0.2, repeat: -1, ease: 'none', delay: i * 0.45,
            onUpdate: () => chunk.setAttribute('transform', `translate(${obj.x},${lane})`)
          });
          activeTimelines.push(s);
          tl.set(chunk, { opacity: 1 }, 0.2);
        });

        const track = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.3 });
        track.to(head, { rotation: 6, duration: 1.4, ease: 'sine.inOut' });
        activeTimelines.push(track);
        return tl;
    }},
    { name: 'chunk-catch', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -18, duration: 0.4 }, 0);
        tl.to(armR, { rotation:  18, duration: 0.4 }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.3 }, 0);

        chunks.forEach((chunk, i) => {
          const obj = { x: (i - 3) * 32, y: -110 };
          const targetY = 28 + (i % 2) * 12;
          chunk.setAttribute('transform', `translate(${obj.x},${obj.y})`);
          const drop = gsap.timeline({ repeat: -1, delay: i * 0.45, repeatDelay: 0.2 });
          drop.set(chunk, { opacity: 1 }).set(obj, { y: -110 })
              .to(obj, { y: targetY, duration: 0.65, ease: 'power2.in', onUpdate: () => chunk.setAttribute('transform', `translate(${obj.x},${obj.y})`) })
              .to(chunk, { scale: 1.25, duration: 0.12, transformOrigin: '50% 50%' }, '-=0.06')
              .to(chunk, { scale: 1, duration: 0.18, ease: 'elastic.out(1, 0.5)' })
              .to(chunk, { opacity: 0, duration: 0.35, delay: 0.35, ease: 'power1.in' });
          activeTimelines.push(drop);
        });

        const react = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
        react.to(mascot, { y: 3, scaleY: 0.95, duration: 0.12, ease: 'power2.out' })
             .to(mascot, { y: 0, scaleY: 1,    duration: 0.35, ease: 'elastic.out(1, 0.5)' })
             .to({}, { duration: 0.45 });
        activeTimelines.push(react);
        return tl;
    }},
    { name: 'ellipse-orbit', play: () => {
        setExpr('determined');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -35, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armR, { rotation:  35, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(orbit, { opacity: 1, duration: 0.4 }, 0.2);
        tl.to(aura, { opacity: 0.9, scale: 1.1, duration: 0.6 }, 0);

        // All chunks orbit on two overlapping ellipses
        chunks.forEach((chunk, i) => {
          const rx   = 55 + (i % 2) * 30;
          const ry   = 28 + (i % 3) * 10;
          const spd  = 1.8 + i * 0.3;
          const off  = (i / chunks.length) * Math.PI * 2;
          const obj  = { a: off };
          activeTimelines.push(gsap.to(obj, { a: off + Math.PI * 2, duration: spd, repeat: -1, ease: 'none',
            onUpdate: () => chunk.setAttribute('transform', `translate(${Math.cos(obj.a)*rx},${Math.sin(obj.a)*ry})`)
          }));
          tl.fromTo(chunk, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0.2+i*0.06);
        });

        const spin = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.1 });
        spin.to(head, { rotation: 6, duration: 1.2, ease: 'sine.inOut' });
        activeTimelines.push(spin);
        tl.to(mascot, { y: -3, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        return tl;
    }},
  ];

  const playAnalyzing = (forced) => {
    const idx = pick(analyzeV, forced);
    currentVariant = idx;
    activeTimeline = analyzeV[idx].play();
    scheduleBlink(0.9, 1.8);
    return analyzeV[idx].name;
  };

  /* ============================================================ RERANKING (2 variants) */
  const rerankV = [
    { name: 'weighing-scale', play: () => {
        setExpr('squint');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -48, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armR, { rotation:  48, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.fromTo(scaleG, { y: -10, opacity: 0, scale: 0 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.2);
        gsap.set(scaleG, { x: 0, y: 30 });

        const weigh = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2 });
        weigh.to(scaleBeam, { rotation: 14, duration: 1.4, ease: 'sine.inOut' });
        activeTimelines.push(weigh);

        const tilt = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2 });
        tilt.to(head, { rotation: 7, duration: 1.4, ease: 'sine.inOut' });
        activeTimelines.push(tilt);

        tl.to(mascot, { y: -2, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        activeTimeline = tl;
        return tl;
    }},
    { name: 'compare-nod', play: () => {
        setExpr('squint');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL, { rotation: -25, duration: 0.4, ease: 'back.out(1.4)' }, 0);
        tl.to(armR, { rotation:  25, duration: 0.4, ease: 'back.out(1.4)' }, 0);

        // Head nods left-right as if weighing two options
        const compare = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
        compare
          .to(head, { rotation: -12, x: -4, duration: 0.45, ease: 'power2.inOut' })
          .to(armL, { rotation: -38, duration: 0.45, ease: 'power2.inOut' }, '<')
          .to({}, { duration: 0.25 })
          .to(head, { rotation: 12, x: 4, duration: 0.45, ease: 'power2.inOut' })
          .to(armR, { rotation: 38, duration: 0.45, ease: 'power2.inOut' }, '<')
          .to({}, { duration: 0.25 })
          .to(head, { rotation: 0, x: 0, duration: 0.35, ease: 'sine.inOut' })
          .to([armL, armR], { rotation: (i) => i === 0 ? -25 : 25, duration: 0.35, ease: 'sine.inOut' }, '<');
        activeTimelines.push(compare);

        const pulse = gsap.timeline({ repeat: -1, yoyo: true });
        pulse.to(antenna, { scale: 1.3, duration: 0.9, ease: 'sine.inOut' });
        activeTimelines.push(pulse);

        activeTimeline = tl;
        return tl;
    }},
  ];

  const playReranking = (forced) => {
    const idx = pick(rerankV, forced);
    currentVariant = idx;
    activeTimeline = rerankV[idx].play();
    scheduleBlink(2.0, 3.8);
    return rerankV[idx].name;
  };

  /* ============================================================ GENERATING (2 variants) */
  const generateV = [
    { name: 'typing-fast', play: () => {
        setExpr('determined');
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        tl.to(armL,   { rotation:  22, y: 8, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(armR,   { rotation: -22, y: 8, duration: 0.5, ease: 'back.out(1.4)' }, 0);
        tl.to(head,   { y: 3, duration: 0.35 }, 0);
        tl.to(typing, { opacity: 1, duration: 0.4 }, 0.3);
        tl.to(aura,   { opacity: 0.75, duration: 0.5 }, 0);

        // Staggered arm typing
        const typeL = gsap.timeline({ repeat: -1 });
        typeL.to(armL, { y: 5,  duration: 0.11, ease: 'sine.inOut' })
             .to(armL, { y: 11, duration: 0.11, ease: 'sine.inOut' })
             .to(armL, { y: 8,  duration: 0.14, ease: 'sine.inOut' });
        activeTimelines.push(typeL);

        const typeR = gsap.timeline({ repeat: -1, delay: 0.09 });
        typeR.to(armR, { y: 11, duration: 0.11, ease: 'sine.inOut' })
             .to(armR, { y: 5,  duration: 0.11, ease: 'sine.inOut' })
             .to(armR, { y: 8,  duration: 0.14, ease: 'sine.inOut' });
        activeTimelines.push(typeR);

        [type1, type2, type3].forEach((dot, i) => {
          const d = gsap.timeline({ repeat: -1, delay: i * 0.18 });
          d.to(dot, { opacity: 0.25, duration: 0.18 }).to(dot, { opacity: 1, duration: 0.18 }).to({}, { duration: 0.38 });
          activeTimelines.push(d);
        });

        tl.to(antenna, { scale: 1.5, duration: 0.28, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0);
        activeTimeline = tl;
        return tl;
    }},
    { name: 'deep-focus', play: () => {
        setExpr('focused');
        const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } });
        // Contemplative: arms folded down, head slightly forward
        tl.to(armL,   { rotation: 15, y: 6, duration: 0.7, ease: 'power2.inOut' }, 0);
        tl.to(armR,   { rotation: -15, y: 6, duration: 0.7, ease: 'power2.inOut' }, 0);
        tl.to(head,   { y: 5, rotation: -3, duration: 0.6, ease: 'power2.inOut' }, 0);
        tl.to(typing, { opacity: 1, duration: 0.6 }, 0.4);
        tl.to(aura,   { opacity: 1.0, scale: 1.12, duration: 0.8 }, 0);

        // Slow, deep breathing
        const breath = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 });
        breath.to(mascot, { scaleY: 1.025, scaleX: 0.98, y: -3, duration: 1.6, ease: 'sine.inOut' });
        activeTimelines.push(breath);

        // Antenna glows slowly
        const glow = gsap.timeline({ repeat: -1, yoyo: true });
        glow.to(antenna, { scale: 1.7, duration: 1.4, ease: 'sine.inOut' });
        activeTimelines.push(glow);

        // Dots pulse slowly
        [type1, type2, type3].forEach((dot, i) => {
          const d = gsap.timeline({ repeat: -1, delay: i * 0.3 });
          d.to(dot, { opacity: 0.2, duration: 0.3 }).to(dot, { opacity: 1, duration: 0.3 }).to({}, { duration: 0.7 });
          activeTimelines.push(d);
        });

        activeTimeline = tl;
        return tl;
    }},
  ];

  const playGenerating = (forced) => {
    const idx = pick(generateV, forced);
    currentVariant = idx;
    activeTimeline = generateV[idx].play();
    scheduleBlink(1.4, 2.8);
    return generateV[idx].name;
  };

  /* ============================================================ FOUND */
  const playFound = () => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to([orbit, tablet, mag, drawer, map, scaleG, typing, think], { opacity: 0, duration: 0.3 }, 0);
    tl.to(chunks, { opacity: 0, scale: 0, duration: 0.3, stagger: 0.03, ease: 'power2.in' }, 0);

    tl.call(() => setExpr('happy'), null, 0.3);
    tl.to(cheeks, { opacity: 1, duration: 0.4 }, 0.3);
    tl.to(mouth,  { opacity: 0.85, duration: 0.35 }, 0.3);

    // Jump with squash
    tl.to(mascot, { y: -28, scaleY: 1.09, scaleX: 0.93, duration: 0.32, ease: 'power2.out' }, 0.2)
      .to(mascot, { y: 0, scaleY: 0.92, scaleX: 1.08, duration: 0.28, ease: 'power2.in' })
      .to(mascot, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });

    tl.to(armL, { rotation: -68, duration: 0.4, ease: 'back.out(2)' }, 0.4);
    tl.to(armR, { rotation:  68, duration: 0.4, ease: 'back.out(2)' }, 0.4);

    tl.fromTo(document_, { opacity: 0, scale: 0, y: 35 }, { opacity: 1, scale: 1, y: 0, duration: 0.65, ease: 'back.out(1.8)' }, 0.5);
    tl.fromTo(sparks,    { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, 0.75);

    // Settle hover
    tl.to(mascot, { y: -5, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }, '>');
    const docBob = gsap.timeline({ repeat: -1, yoyo: true });
    docBob.to(document_, { y: -5, duration: 1.4, ease: 'sine.inOut' });
    activeTimelines.push(docBob);

    const twinkle = gsap.timeline({ repeat: -1, yoyo: true });
    twinkle.to(sparks, { rotation: 12, opacity: 0.55, duration: 1.8, ease: 'sine.inOut', transformOrigin: '50% 50%' });
    activeTimelines.push(twinkle);

    tl.to(aura,    { opacity: 1, scale: 1.14, duration: 0.65 }, 0.4);
    tl.to(antenna, { scale: 1.8, duration: 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }, 0.5);
    activeTimeline = tl;
    return 'celebrate';
  };

  /* ============================================================ ERROR */
  const playError = () => {
    setExpr('confused');
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    tl.to(glitch, { opacity: 1, duration: 0.1 }, 0);

    const flicker = gsap.timeline({ repeat: -1 });
    flicker.to(glitch, { opacity: 0.25, duration: 0.07 })
           .to(glitch, { opacity: 0.9,  duration: 0.07 })
           .to(glitch, { opacity: 0.55, duration: 0.10 })
           .to({}, { duration: 0.65 });
    activeTimelines.push(flicker);

    const visorFlick = gsap.timeline({ repeat: -1 });
    visorFlick.to(visor, { opacity: 0.35, duration: 0.05 })
              .to(visor, { opacity: 1,    duration: 0.05 })
              .to({}, { duration: 1.1 });
    activeTimelines.push(visorFlick);

    tl.to(armL, { rotation: -72, duration: 0.4, ease: 'back.out(1.4)' }, 0.1);
    tl.to(armR, { rotation:  12, duration: 0.4 }, 0.1);

    const scratch = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.15 });
    scratch.to(armL, { rotation: -84, duration: 0.38, ease: 'sine.inOut' });
    activeTimelines.push(scratch);

    const shake = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
    shake.to(head, { rotation: -11, duration: 0.42, ease: 'sine.inOut' })
         .to(head, { rotation:  11, duration: 0.42, ease: 'sine.inOut' })
         .to(head, { rotation:   0, duration: 0.35, ease: 'sine.inOut' });
    activeTimelines.push(shake);

    tl.to(antennaG, { rotation: -28, duration: 0.5 }, 0);
    tl.to(antenna,  { opacity: 0.45, scale: 0.75, duration: 0.5 }, 0);
    tl.to(aura,     { opacity: 0.22, duration: 0.5 }, 0);
    activeTimeline = tl;
    return 'error-state';
  };

  /* ============================================================ DISPATCHER */
  const states = {
    idle: playIdle, searching: playSearching, analyzing: playAnalyzing,
    reranking: playReranking, generating: playGenerating, found: playFound, error: playError,
  };

  const CAPTIONS = {
    idle:       '',
    searching:  'Suche in Dokumenten…',
    analyzing:  'Analysiere Inhalte…',
    reranking:  'Bewerte Relevanz…',
    generating: 'Schreibe Antwort…',
    found:      'Antwort gefunden!',
    error:      'Etwas ist schiefgelaufen.',
  };

  const setState = (name, variantIndex) => {
    if (!states[name]) { console.warn('[Draexie] Unknown state:', name); return; }
    killActive();
    resetAll();
    currentState   = name;
    currentVariant = 0;
    const vName = states[name](variantIndex);
    listeners.forEach(fn => fn(name, vName));
  };

  window.mascot = {
    setState,
    get state()   { return currentState; },
    get variant() { return currentVariant; },
    get caption() { return CAPTIONS[currentState] || ''; },
    onStateChange(fn) { listeners.push(fn); },
  };

  const captionEl = document.getElementById('dxm-caption');
  if (captionEl) {
    window.mascot.onStateChange((s) => {
      captionEl.textContent  = CAPTIONS[s] || '';
      captionEl.style.opacity = s === 'idle' ? '0' : '1';
    });
  }

  setState('idle');
})();
