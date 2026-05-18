---
name: Academic Intelligence Interface
colors:
  surface: '#0e1515'
  surface-dim: '#0e1515'
  surface-bright: '#333a3b'
  surface-container-lowest: '#090f10'
  surface-container-low: '#161d1d'
  surface-container: '#1a2121'
  surface-container-high: '#242b2c'
  surface-container-highest: '#2f3637'
  on-surface: '#dde4e4'
  on-surface-variant: '#bac9ca'
  inverse-surface: '#dde4e4'
  inverse-on-surface: '#2b3232'
  outline: '#859394'
  outline-variant: '#3b494a'
  surface-tint: '#2fdae6'
  primary: '#52f1fc'
  on-primary: '#00363a'
  primary-container: '#20d4df'
  on-primary-container: '#00575c'
  inverse-primary: '#00696f'
  secondary: '#b0cade'
  on-secondary: '#1a3343'
  secondary-container: '#314a5a'
  on-secondary-container: '#9fb8cc'
  tertiary: '#ffd5a6'
  on-tertiary: '#472a00'
  tertiary-container: '#ffb046'
  on-tertiary-container: '#704500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#73f5ff'
  primary-fixed-dim: '#2fdae6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#cce6fa'
  secondary-fixed-dim: '#b0cade'
  on-secondary-fixed: '#021e2d'
  on-secondary-fixed-variant: '#314a5a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb960'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0e1515'
  on-background: '#dde4e4'
  surface-variant: '#2f3637'
typography:
  brand-logo:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    letterSpacing: 5px
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  citation:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  max-width-content: 1200px
---

## Brand & Style
The design system reflects a "University version" of AI assistance: a sophisticated, authoritative, yet accessible environment for deep research and document analysis. The brand personality is intellectually rigorous and technically advanced, bridging the gap between traditional academia and future-forward computation.

The style leverages **Glassmorphism** and **Minimalism** to create a sense of depth and focus. Translucent layers and backdrop blurs mimic the clarity of a high-end laboratory interface, while the dark mode foundation ensures long-form readability for students and researchers. Visual interest is generated through subtle teal glows that signify AI activity, suggesting a "living" intelligence behind the static documents.

## Colors
This design system utilizes a deep, oceanic palette to reduce eye strain during extended research sessions. The core experience is built on four functional dark tones:
- **Base:** The primary canvas for the application.
- **Surface:** Used for sidebars and secondary content areas.
- **Elevated:** Reserved for cards, modals, and floating elements.
- **Active:** Indicates selection, hover states, or focused interactions.

The **Brand Accent (#20d4df)** is used sparingly to draw attention to AI-generated insights, primary actions, and active progress indicators. Status colors follow global standards but are calibrated for high legibility against the dark background.

## Typography
The typography strategy prioritizes information hierarchy and academic utility. **Inter** serves as the primary typeface, offering exceptional legibility and a modern, neutral tone for body text and navigation. 

**JetBrains Mono** is employed specifically for citations, source code, metadata, and technical references. This font switch signals to the user that they are viewing "raw data" or "evidence," reinforcing the assistant's role in evidence-based Q&A. 

The brand name uses extreme tracking (5px) and a heavy weight to create a distinctive, architectural logotype that feels stable and established.

## Layout & Spacing
The layout follows a **fluid grid** system with strict margins to maintain an organized, "document-first" feel. 
- **Desktop:** A 12-column grid with a fixed sidebar (280px) for document navigation. The main content area is centered with a max-width of 1200px to ensure line lengths remain readable.
- **Tablet:** Transitions to an 8-column grid. The sidebar becomes a collapsible drawer.
- **Mobile:** A single-column flow with 16px horizontal margins.

Spacing follows a 4px baseline shift, but primarily relies on 16px (md) and 32px (lg) increments to create clear separation between different sections of research data.

## Elevation & Depth
Depth in this design system is achieved through **Tonal Layers** combined with **Glassmorphism**. Rather than traditional heavy shadows, we use:

1.  **Backdrop Blurs:** Headers and input bars use a `blur(16px)` effect with a semi-transparent surface color to maintain context of the content scrolling beneath.
2.  **Inner Glows:** Active elements (like the currently selected document) feature a subtle 1px inner border and a very soft outer glow in the brand accent color (#20d4df) at 10-15% opacity.
3.  **Subtle Outlines:** Objects are separated by a consistent `rgba(255,255,255,0.07)` border rather than drop shadows, maintaining a flat, modern aesthetic.

## Shapes
The shape language is defined by large, friendly corner radii that soften the formal dark-mode environment. A base **16px roundedness (Level 2)** is applied to all primary containers, including cards, modals, and the main chat input. 

Small interactive elements like buttons and tags use a slightly tighter radius (8px) to maintain a crisp look, while avatars and status indicators remain circular. The 16px radius creates a "bubble of focus" around complex document information, making the interface feel approachable despite its high-tech capabilities.

## Components
- **Buttons:** High-emphasis buttons use the Teal accent with dark text. Ghost buttons use the subtle border with teal text. All buttons have a transition effect that increases the "glow" on hover.
- **Input Fields:** The primary AI prompt area is a large, 16px-rounded container with a `backdrop-filter: blur(16px)`. It uses a slightly brighter surface color to indicate interactivity.
- **Source Chips:** Small, JetBrains Mono-styled badges that link directly to document pages. These should have a subtle background and change to the accent color on hover.
- **AI Response Cards:** Use the `bg_surface` color with a 1px teal left-border to distinguish assistant messages from user queries.
- **Progress Indicators:** Use thin, glowing teal lines. For document processing, use a pulse effect rather than a standard spinning loader to maintain the high-tech feel.
- **Multi-tenancy Support:** All components reference CSS variables (e.g., `--brand-accent`, `--font-primary`) allowing university-specific branding (logos and colors) to be injected without changing the underlying architecture.