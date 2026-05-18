---
name: DRÄXIE Light
colors:
  surface: '#f4fbfb'
  surface-dim: '#d4dbdc'
  surface-bright: '#f4fbfb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f5'
  surface-container: '#e8efef'
  surface-container-high: '#e2e9ea'
  surface-container-highest: '#dde4e4'
  on-surface: '#161d1d'
  on-surface-variant: '#3b494a'
  inverse-surface: '#2b3232'
  inverse-on-surface: '#ebf2f2'
  outline: '#6b7a7b'
  outline-variant: '#bac9ca'
  surface-tint: '#00696f'
  primary: '#00696f'
  on-primary: '#ffffff'
  primary-container: '#20d4df'
  on-primary-container: '#00575c'
  inverse-primary: '#2fdae6'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#865300'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffb046'
  on-tertiary-container: '#704500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#73f5ff'
  primary-fixed-dim: '#2fdae6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb960'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f4fbfb'
  on-background: '#161d1d'
  surface-variant: '#dde4e4'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
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
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is built to evoke the precision of a high-end corporate document environment. The brand personality is intelligent, efficient, and transparent, acting as a silent partner in document analysis. 

The aesthetic follows a **Corporate / Modern** approach with a "Paper Interface" philosophy. This means utilizing pure white backgrounds and subtle tonal shifts to mimic the clarity of physical documents, while injecting a vibrant teal primary color to signal AI intelligence and digital capability. The result is a high-contrast environment that minimizes cognitive load and maximizes focus on content.

## Colors

The color palette is anchored by a pure white surface to establish the "paper" metaphor. Hierarchy is achieved through subtle slate-gray containers rather than heavy shadows.

- **Primary (#20d4df):** Used strictly for action-oriented elements, brand accents, and AI-state indicators.
- **Surface & Containers:** The background is #ffffff. Level 1 depth uses #f8fafc (low) and Level 2 depth uses #f1f5f9.
- **Typography:** The dark slate (#0f172a) provides maximum readability against the white background, while #64748b is reserved for metadata and secondary guidance.
- **Dividers:** Outlines use a highly subtle 5% black alpha to define boundaries without cluttering the visual field.

## Typography

This design system utilizes **Inter** across all levels to maintain a utilitarian and systematic feel. Weights are kept consistent with the dark mode implementation to ensure brand continuity.

Headlines use a tighter letter-spacing and heavier weights to provide clear structural anchoring. Body text is optimized for long-form reading with a generous 1.5x line height. For mobile views, `headline-lg` should scale down to 28px to avoid awkward text wrapping, while maintaining the same 700 weight.

## Layout & Spacing

The layout is built on a strict 8px grid system. This design system employs a **Fixed Grid** for document viewing areas (centered at 1200px) and a **Fluid Grid** for dashboard management views.

- **Desktop:** 12-column grid with 16px gutters and 32px margins.
- **Tablet:** 8-column grid with 16px gutters.
- **Mobile:** 4-column grid with 16px margins.

Spacing rhythm should always be a multiple of 8px. Use `lg` (24px) for padding inside cards and `md` (16px) for spacing between related input elements.

## Elevation & Depth

To maintain the "clean paper" aesthetic, this design system avoids heavy drop shadows. Depth is communicated through:

1.  **Tonal Layering:** Using `surface-container-low` (#f8fafc) for the main workspace and `surface` (#ffffff) for active cards or document sheets.
2.  **Subtle Outlines:** Components use a 1px solid border of `outline-variant` (rgba(0,0,0,0.05)) to define edges.
3.  **Flat Stacking:** Elements like dropdowns or modals use a very soft, high-diffusion shadow (0px 4px 20px rgba(15, 23, 42, 0.08)) to lift them off the page without breaking the minimalist look.

## Shapes

The shape language is structured and approachable. All standard components—including buttons, input fields, and cards—utilize an **8px (0.5rem)** corner radius. 

Larger containers or modals may use `rounded-lg` (1rem) to soften the impact of large surface areas, while small elements like tags or checkboxes stick to the 8px standard. This consistent rounding balances the "corporate" slate tones with a modern, user-friendly softness.

## Components

- **Buttons:** Primary buttons use the vibrant Teal (#20d4df) with white text. Secondary buttons use a transparent background with a 1px `outline-variant` border and `on-surface` text.
- **Input Fields:** Backgrounds should be pure `surface` (#ffffff) with a 1px `outline-variant` border. On focus, the border transitions to Primary Teal.
- **Cards:** Use `surface-container-low` for background cards and `surface` for elevated content cards. Borders are mandatory for visibility on white-on-white areas.
- **Chips/Tags:** Used for document metadata. These should have a background of `surface-container` and `on-surface-variant` text.
- **Document List:** List items should be separated by 1px `outline-variant` dividers. Use a hover state of `surface-container-low` to indicate interactivity.
- **AI Assistant Bubble:** Floating elements should use the Primary Teal for icons or small accents to distinguish AI-generated insights from user content.