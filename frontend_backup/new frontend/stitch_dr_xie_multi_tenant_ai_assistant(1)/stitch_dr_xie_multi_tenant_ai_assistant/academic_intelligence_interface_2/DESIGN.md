---
name: Academic Intelligence Interface
colors:
  surface: '#05151c'
  surface-dim: '#05151c'
  surface-bright: '#2b3b43'
  surface-container-lowest: '#011017'
  surface-container-low: '#0d1e25'
  surface-container: '#112229'
  surface-container-high: '#1c2c34'
  surface-container-highest: '#27373f'
  on-surface: '#d4e5ef'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#d4e5ef'
  inverse-on-surface: '#23333a'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#45d8ed'
  on-secondary: '#00363d'
  secondary-container: '#00bacd'
  on-secondary-container: '#00444d'
  tertiary: '#ffffff'
  on-tertiary: '#19343e'
  tertiary-container: '#cbe7f5'
  on-tertiary-container: '#4e6874'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#98f0ff'
  secondary-fixed-dim: '#45d8ed'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#cbe7f5'
  tertiary-fixed-dim: '#afcbd8'
  on-tertiary-fixed: '#021f29'
  on-tertiary-fixed-variant: '#304a55'
  background: '#05151c'
  on-background: '#d4e5ef'
  surface-variant: '#27373f'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is engineered for high-focus academic and research environments. It prioritizes clarity, cognitive ease, and a sophisticated "Intelligence" aesthetic. The style is **Corporate Modern** with a lean toward **Minimalism**, utilizing high-contrast primary elements against a deep, focused backdrop. The personality is professional and authoritative, yet the vibrant teal accents provide a touch of approachability and technological warmth, personified by the bot character.

The interface should evoke a sense of "Deep Work"—minimizing distractions while highlighting crucial data points and AI-driven insights through sharp color transitions and precise typography.

## Colors
This design system utilizes a **Refined Dark Mode** as its primary state. The palette is derived directly from the character and environment of the bot:
- **Background**: A deep, desaturated navy-gray (#263238) serves as the foundation to reduce eye strain during long research sessions.
- **Primary**: Crisp White (#FFFFFF) is reserved for high-priority text, essential icons, and primary UI containers, ensuring maximum legibility.
- **Accent**: Vibrant Teal (#26C6DA) is used sparingly for interactive states, call-to-action buttons, and the bot character's features to signify intelligence and progress.
- **Surfaces**: Tonal variants of the navy-gray (#37474F) are used to create hierarchy and depth within the layout.

## Typography
**Inter** is the exclusive typeface of this design system, chosen for its exceptional readability in data-heavy and technical contexts. 

- **Headlines**: Use Semi-Bold to Bold weights with tight letter-spacing to create a structured, authoritative feel.
- **Body Text**: Maintain a generous line height (1.5x) to facilitate reading of long-form academic content.
- **Labels**: Use uppercase with slight letter-spacing for metadata, citations, and small UI labels to distinguish them from body copy.
- **Hierarchy**: Primary information is always Crisp White; secondary or descriptive text should use a muted teal-gray tint to maintain focus on the core content.

## Layout & Spacing
The system employs a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The rhythm is based on an **8px base unit**, ensuring mathematical harmony across all components.

- **Margins**: Generous 48px margins on desktop create a "canvas" feel for the academic content.
- **Gutters**: Fixed 24px gutters provide clear separation between data cards and sidebar elements.
- **Density**: Use "Medium" density for standard interfaces and "Compact" density for data-heavy research dashboards.

## Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** rather than traditional heavy shadows. This maintains the clean, modern aesthetic suitable for an intelligence interface.

- **Level 0 (Background)**: #263238 (Deep Navy/Gray).
- **Level 1 (Cards/Sidebar)**: #37474F (Surface Gray) with a subtle 1px border in a lighter navy tint.
- **Level 2 (Popovers/Modals)**: Slightly lighter gray with a very soft, diffused shadow (0px 8px 24px rgba(0,0,0,0.4)) to lift the element off the page.
- **Accents**: The teal bot character and associated chat bubbles use Level 2 elevation to appear "active" and ready to assist.

## Shapes
Following the **ROUND_EIGHT** principle, the interface uses a consistent **0.5rem (8px)** corner radius for almost all components.

- **Standard (8px)**: Buttons, input fields, cards, and character containers.
- **Large (16px)**: Major layout sections or large modal containers.
- **Pill**: Reserved exclusively for Tags, Chips, and the "Ask AI" floating action button to differentiate interactive shortcuts from structural elements.

## Components
Consistent component styling ensures the design system feels unified and professional.

- **Buttons**:
  - *Primary*: Solid Vibrant Teal with White text. Bold weight.
  - *Secondary*: White outline with White text.
  - *Ghost*: Transparent background with Teal text for less critical actions.
- **Input Fields**: Darker navy background than the surface, 1px light gray border, 8px radius. Teal focus ring (2px) to indicate active state.
- **AI Chat Bubbles**: The user bubble is Surface Gray; the bot bubble is Crisp White with Navy text to emphasize the "Intelligence" source.
- **Data Cards**: Surface Gray background, 8px radius, with a subtle Teal top-border (2px) to denote categorized AI insights.
- **Chips/Tags**: Small, pill-shaped elements with a low-opacity Teal background and Teal text for metadata and research keywords.
- **Checkboxes/Radios**: Always Teal when selected, utilizing a Crisp White checkmark or dot for high contrast.