import { useEffect } from 'react';

export default function Mascot() {
  useEffect(() => {
    if (window.mascot) return;
    const script = document.createElement('script');
    script.src = '/draexie-mascot.js';
    script.async = false;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="flex flex-col items-center pointer-events-none select-none pb-1">
      <svg
        id="draexie"
        viewBox="-170 -170 340 340"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width:    'clamp(130px, 13vw, 220px)',
          height:   'clamp(130px, 13vw, 220px)',
          overflow: 'visible',
          filter:   [
            'drop-shadow(0 0 16px rgba(82,241,252,0.75))',
            'drop-shadow(0 0 42px rgba(82,241,252,0.30))',
            'drop-shadow(0 0 80px rgba(82,241,252,0.12))',
            'drop-shadow(0 16px 32px rgba(0,0,0,0.65))',
          ].join(' '),
        }}
      >
        <defs>
          <radialGradient id="auraGrad">
            <stop offset="0%" stopColor="var(--m-trim)" stopOpacity="0.25"/>
            <stop offset="70%" stopColor="var(--m-trim)" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--m-body-2)"/>
            <stop offset="100%" stopColor="var(--m-body)"/>
          </linearGradient>
        </defs>

        {/* 1 — Aura: furthest back */}
        <g id="d-aura" opacity="0.6"><circle cx="0" cy="0" r="115" fill="url(#auraGrad)"/></g>

        {/* 2 — Orbit chunks: behind body */}
        <g id="d-orbit" opacity="0">
          <g className="chunk" data-chunk="0"><rect x="-8" y="-8" width="16" height="16" rx="3" className="m-trim"/></g>
          <g className="chunk" data-chunk="1"><polygon points="0,-10 9,5 -9,5" className="m-spark"/></g>
          <g className="chunk" data-chunk="2"><circle cx="0" cy="0" r="8" className="m-accent"/></g>
          <g className="chunk" data-chunk="3"><rect x="-6" y="-6" width="12" height="12" rx="2" className="m-trim" opacity="0.7"/></g>
          <g className="chunk" data-chunk="4"><circle cx="0" cy="0" r="5" className="m-spark"/></g>
          <g className="chunk" data-chunk="5"><polygon points="-7,-7 7,-7 0,7" className="m-accent" opacity="0.8"/></g>
          <g className="chunk" data-chunk="6"><rect x="-5" y="-5" width="10" height="10" rx="2" className="m-spark"/></g>
        </g>

        {/* 3 — Drawer: appears below mascot */}
        <g id="d-drawer" opacity="0">
          <rect x="-50" y="60" width="100" height="50" rx="6" className="m-body-2"/>
          <rect x="-46" y="64" width="92" height="42" rx="4" className="m-visor"/>
          <rect x="-40" y="68" width="14" height="34" className="m-trim" opacity="0.8"/>
          <rect x="-22" y="68" width="14" height="34" className="m-spark" opacity="0.8"/>
          <rect x="-4"  y="68" width="14" height="34" className="m-accent" opacity="0.8"/>
          <rect x="14"  y="68" width="14" height="34" className="m-trim" opacity="0.6"/>
          <rect x="32"  y="68" width="14" height="34" className="m-spark" opacity="0.6"/>
          <rect x="-10" y="90" width="20" height="3" rx="1.5" className="m-trim"/>
        </g>

        {/* 4 — Map: appears behind/beside mascot */}
        <g id="d-map" opacity="0">
          <rect x="-55" y="-100" width="100" height="60" rx="4" fill="var(--m-body)" stroke="var(--m-trim)" strokeWidth="1.5"/>
          <path d="M -50 -85 Q -25 -75 0 -82 T 40 -78" stroke="var(--m-trim)" strokeWidth="1.5" fill="none" opacity="0.6"/>
          <path d="M -50 -70 Q -20 -60 10 -65 T 40 -62" stroke="var(--m-trim)" strokeWidth="1.5" fill="none" opacity="0.6"/>
          <path d="M -30 -100 L -28 -45" stroke="var(--m-spark)" strokeWidth="1.5" fill="none" opacity="0.6" strokeDasharray="3 3"/>
          <circle id="d-map-pin" cx="15" cy="-72" r="4" className="m-spark"/>
          <circle cx="15" cy="-72" r="2" className="m-visor"/>
        </g>

        {/* 5 — Mascot body: isolation:isolate keeps GSAP CSS-transforms on children
            (arms, head) inside this compositing group so they can't bleed above
            foreground elements that follow in document order */}
        <g id="d-mascot" style={{ isolation: 'isolate' }}>
          <g id="d-body">
            <rect x="-10" y="5" width="20" height="8" className="m-body-2"/>
            <rect x="-45" y="13" width="90" height="65" rx="14" fill="url(#bodyGrad)"/>
            <path d="M -22 25 L 22 25 Q 26 25 26 29 L 26 49 Q 26 53 22 53 L -22 53 Q -26 53 -26 49 L -26 29 L -22 25 Z" className="m-visor"/>
            <circle cx="-12" cy="39" r="3" className="m-trim glow"/>
            <circle cx="0"   cy="39" r="3" className="m-accent"/>
            <circle cx="12"  cy="39" r="3" className="m-spark"/>
            <rect x="-45" y="62" width="90" height="3" className="m-trim" opacity="0.5"/>
          </g>
          <g id="d-arm-left"><rect x="-50" y="18" width="14" height="40" rx="7" fill="url(#bodyGrad)"/><circle cx="-43" cy="60" r="9" className="m-body-2"/></g>
          <g id="d-arm-right"><rect x="36" y="18" width="14" height="40" rx="7" fill="url(#bodyGrad)"/><circle cx="43" cy="60" r="9" className="m-body-2"/></g>
          <g id="d-head">
            <rect x="-55" y="-75" width="110" height="80" rx="20" fill="url(#bodyGrad)"/>
            <rect x="-45" y="-68" width="80" height="6" rx="3" fill="white" opacity="0.05"/>
            <circle cx="-58" cy="-35" r="6" className="m-body-2"/><circle cx="58" cy="-35" r="6" className="m-body-2"/>
            <circle cx="-58" cy="-35" r="2" className="m-trim"/><circle cx="58" cy="-35" r="2" className="m-trim"/>
            <path id="d-visor" d="M -42 -58 L 42 -58 Q 46 -58 46 -54 L 46 -24 Q 46 -20 42 -20 L -42 -20 Q -46 -20 -46 -24 L -46 -54 L -42 -58 Z" className="m-visor"/>
            <g id="d-eye-left-pos"><g id="d-eye-left-blink"><g id="d-eye-left-expr"><circle r="7" className="m-eye glow"/></g></g></g>
            <g id="d-eye-right-pos"><g id="d-eye-right-blink"><g id="d-eye-right-expr"><circle r="7" className="m-eye glow"/></g></g></g>
            <g id="d-cheeks" opacity="0">
              <ellipse cx="-32" cy="-10" rx="5" ry="2.5" className="m-spark" opacity="0.7"/>
              <ellipse cx="32" cy="-10" rx="5" ry="2.5" className="m-spark" opacity="0.7"/>
            </g>
            <g id="d-mouth" opacity="0">
              <path id="d-mouth-shape" d="M -8 -6 Q 0 0 8 -6" stroke="var(--m-trim)" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </g>
          </g>
          <g id="d-antenna">
            <line x1="0" y1="-72" x2="0" y2="-95" stroke="var(--m-body-2)" strokeWidth="3" strokeLinecap="round"/>
            <circle id="d-antenna-tip" cx="0" cy="-98" r="5" className="m-trim glow"/>
          </g>
        </g>

        {/* 6 — Scale: held in front, above body */}
        <g id="d-scale" opacity="0">
          <g id="d-scale-beam" style={{ transformOrigin: '0px 0px' }}>
            <line x1="-40" y1="0" x2="40" y2="0" stroke="var(--m-trim)" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="-40" y1="0" x2="-40" y2="12" stroke="var(--m-trim)" strokeWidth="1.5"/>
            <path d="M -50 12 L -30 12 L -34 22 L -46 22 Z" className="m-body-2" stroke="var(--m-trim)" strokeWidth="1.5"/>
            <rect x="-44" y="6" width="8" height="8" rx="1" className="m-trim" opacity="0.9"/>
            <line x1="40" y1="0" x2="40" y2="12" stroke="var(--m-trim)" strokeWidth="1.5"/>
            <path d="M 30 12 L 50 12 L 46 22 L 34 22 Z" className="m-body-2" stroke="var(--m-trim)" strokeWidth="1.5"/>
            <rect x="36" y="8" width="8" height="6" rx="1" className="m-spark" opacity="0.9"/>
          </g>
          <line x1="0" y1="0" x2="0" y2="-12" stroke="var(--m-trim)" strokeWidth="2"/>
          <circle cx="0" cy="-12" r="3" className="m-trim"/>
        </g>

        {/* 7 — Magnifier: held by right arm, above body */}
        <g id="d-magnifier" opacity="0" style={{ transformOrigin: '43px 60px' }}>
          <line x1="43" y1="60" x2="65" y2="82" stroke="var(--m-trim)" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="35" cy="50" r="18" fill="none" stroke="var(--m-trim)" strokeWidth="3"/>
          <circle cx="35" cy="50" r="15" fill="var(--m-trim)" opacity="0.12"/>
          <line x1="25" y1="43" x2="30" y2="39" stroke="var(--m-trim)" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
        </g>

        {/* 8 — Tablet: held in arms, above body */}
        <g id="d-tablet" opacity="0" style={{ transformOrigin: '0px 40px' }}>
          <rect x="-22" y="20" width="44" height="56" rx="4" fill="var(--m-visor)" stroke="var(--m-trim)" strokeWidth="1.5"/>
          <rect x="-15" y="60" width="4" height="10" className="m-trim"/><rect x="-8" y="55" width="4" height="15" className="m-trim"/>
          <rect x="-1"  y="50" width="4" height="20" className="m-trim"/><rect x="6"  y="45" width="4" height="25" className="m-trim"/>
          <rect x="13"  y="40" width="4" height="30" className="m-trim"/>
          <rect x="-16" y="26" width="20" height="2" className="m-trim" opacity="0.5"/>
          <rect x="-16" y="30" width="14" height="2" className="m-trim" opacity="0.3"/>
        </g>

        {/* 9 — Pen: stylus held in right hand, above body */}
        <g id="d-pen" opacity="0" style={{ transformOrigin: '43px 60px' }}>
          <rect x="39.5" y="25" width="7" height="38" rx="3.5" fill="var(--m-trim)"/>
          <rect x="39.5" y="32" width="7" height="5" rx="1" fill="var(--m-spark)"/>
          <rect x="44" y="25" width="2" height="28" rx="1" fill="var(--m-trim)" opacity="0.4"/>
          <path d="M 39.5 63 L 43 72 L 46.5 63 Z" fill="var(--m-trim)"/>
          <circle cx="43" cy="71" r="1.5" fill="var(--m-spark)"/>
        </g>

        {/* 10 — Notepad: floating writing surface, above pen */}
        <g id="d-notepad" opacity="0" style={{ transformOrigin: '50% 50%' }}>
          <rect x="55" y="10" width="58" height="55" rx="4" fill="var(--m-visor)" stroke="var(--m-trim)" strokeWidth="1.5"/>
          <rect x="55" y="10" width="9" height="55" rx="3" fill="var(--m-body-2)" opacity="0.8"/>
          <line id="d-notepad-line-1" x1="69" y1="25" x2="107" y2="25" stroke="var(--m-trim)" strokeWidth="1.5" strokeLinecap="round" opacity="0"/>
          <line id="d-notepad-line-2" x1="69" y1="36" x2="107" y2="36" stroke="var(--m-trim)" strokeWidth="1.5" strokeLinecap="round" opacity="0"/>
          <line id="d-notepad-line-3" x1="69" y1="47" x2="107" y2="47" stroke="var(--m-trim)" strokeWidth="1.5" strokeLinecap="round" opacity="0"/>
          <line id="d-notepad-line-4" x1="69" y1="58" x2="97" y2="58" stroke="var(--m-trim)" strokeWidth="1.5" strokeLinecap="round" opacity="0"/>
        </g>

        {/* 11 — Document: held up in found state */}
        <g id="d-document" opacity="0" style={{ transformOrigin: '0px -30px' }}>
          <rect x="-22" y="-58" width="44" height="56" rx="3" fill="var(--m-visor)" stroke="var(--m-trim)" strokeWidth="2" className="strong-glow"/>
          <rect x="-16" y="-48" width="28" height="3" rx="1.5" className="m-trim"/>
          <rect x="-16" y="-40" width="24" height="2" rx="1" className="m-trim" opacity="0.6"/>
          <rect x="-16" y="-34" width="28" height="2" rx="1" className="m-trim" opacity="0.6"/>
          <rect x="-16" y="-28" width="20" height="2" rx="1" className="m-trim" opacity="0.6"/>
          <rect x="-16" y="-22" width="26" height="2" rx="1" className="m-trim" opacity="0.6"/>
          <circle cx="0" cy="-12" r="6" className="m-trim"/>
          <path d="M -3 -12 L -1 -10 L 3 -14" stroke="var(--m-visor)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* 12 — Think bubble: above head */}
        <g id="d-think" opacity="0">
          <circle cx="60" cy="-65" r="3" className="m-trim"/>
          <circle cx="68" cy="-75" r="5" className="m-trim"/>
          <g transform="translate(82,-90)">
            <circle r="14" className="m-trim" opacity="0.18"/>
            <text x="0" y="5" textAnchor="middle" fill="var(--m-trim)" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="18">?</text>
          </g>
        </g>

        {/* 13 — Typing dots: above head */}
        <g id="d-typing" opacity="0">
          <g transform="translate(82,-85)">
            <rect x="-22" y="-10" width="44" height="20" rx="10" className="m-body-2" stroke="var(--m-trim)" strokeWidth="1"/>
            <circle id="d-type-1" cx="-10" cy="0" r="2.5" className="m-trim"/>
            <circle id="d-type-2" cx="0"   cy="0" r="2.5" className="m-trim"/>
            <circle id="d-type-3" cx="10"  cy="0" r="2.5" className="m-trim"/>
          </g>
        </g>

        {/* 14 — Sparks: celebratory, topmost */}
        <g id="d-sparks" opacity="0">
          <path d="M -50 -60 L -47 -53 L -40 -50 L -47 -47 L -50 -40 L -53 -47 L -60 -50 L -53 -53 Z" className="m-spark"/>
          <path d="M 50 -30 L 52 -25 L 57 -22 L 52 -19 L 50 -14 L 48 -19 L 43 -22 L 48 -25 Z" className="m-spark"/>
          <path d="M 38 -75 L 40 -70 L 45 -67 L 40 -64 L 38 -59 L 36 -64 L 31 -67 L 36 -70 Z" className="m-spark"/>
          <circle cx="-30" cy="-90" r="2.5" className="m-spark"/>
          <circle cx="55" cy="0" r="2" className="m-spark"/>
        </g>

        {/* 15 — Glitch lines: topmost */}
        <g id="d-glitch" opacity="0">
          <rect x="-80" y="-50" width="160" height="2" className="m-error" opacity="0.6"/>
          <rect x="-70" y="0"   width="140" height="2" className="m-error" opacity="0.4"/>
          <rect x="-60" y="40"  width="120" height="2" className="m-error" opacity="0.5"/>
        </g>

      </svg>
      <div id="dxm-caption" className="text-[10px] font-mono text-[#52f1fc] tracking-wider opacity-0 transition-opacity h-4 leading-4 text-center" />
    </div>
  );
}
