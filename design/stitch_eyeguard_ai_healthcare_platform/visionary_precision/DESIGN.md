---
name: Visionary Precision
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#404752'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#707883'
  outline-variant: '#bfc7d4'
  surface-tint: '#0061a4'
  primary: '#0061a4'
  on-primary: '#ffffff'
  primary-container: '#2196f3'
  on-primary-container: '#002c4f'
  inverse-primary: '#9ecaff'
  secondary: '#006e1c'
  on-secondary: '#ffffff'
  secondary-container: '#91f78e'
  on-secondary-container: '#00731e'
  tertiary: '#785900'
  on-tertiary: '#ffffff'
  tertiary-container: '#b98b00'
  on-tertiary-container: '#392900'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#9ecaff'
  on-primary-fixed: '#001d36'
  on-primary-fixed-variant: '#00497d'
  secondary-fixed: '#94f990'
  secondary-fixed-dim: '#78dc77'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005313'
  tertiary-fixed: '#ffdf9e'
  tertiary-fixed-dim: '#fabd00'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5b4300'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e5e2e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
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
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1280px
---

## Brand & Style
The design system is engineered to evoke clinical excellence and technological foresight. It targets a demographic ranging from medical professionals to patients seeking advanced ocular diagnostics. The aesthetic is a sophisticated blend of **Corporate Modern** reliability and **Glassmorphism**, reflecting the clarity and transparency required in healthcare. 

The visual language prioritizes a "calm-tech" atmosphere: high-contrast elements ensure medical data is legible at a glance, while soft, layered surfaces reduce cognitive load. The emotional response is one of safety, innovation, and absolute clarity.

## Colors
This design system utilizes a high-contrast palette optimized for medical environments. The **Primary Blue** is the anchor for action and trust, while the semantic colors (Success, Warning, Error) follow standard medical conventions for immediate recognition.

In Light Mode, surfaces are crisp and airy to minimize eye strain. In Dark Mode, the primary color shifts to a higher luminance to maintain WCAG AAA accessibility against deep charcoal backgrounds. Grey scales are strictly neutral to prevent "color bleed" when viewing ocular scans or clinical photography.

## Typography
Typography is systematic and utilitarian, utilizing **Inter** for its exceptional legibility in data-dense interfaces. For Arabic localization, **Cairo** or **Tajawal** should be implemented to maintain the geometric, modern feel.

The hierarchy is structured to lead the eye from critical diagnostic headers to granular patient data. Headlines use tighter letter-spacing for a modern, "engineered" look, while body text maintains generous line-heights to ensure readability for users with varying visual acuity.

## Layout & Spacing
The design system employs a **Fluid Grid** based on an 8px rhythmic scale. 

- **Desktop:** 12-column grid with 24px gutters and 64px side margins. 
- **Tablet:** 8-column grid with 20px gutters and 32px side margins.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.

Medical dashboards should prioritize a "modular" layout where cards can span multiple columns to accommodate complex charts or high-resolution ocular imagery.

## Elevation & Depth
In alignment with Material 3 principles, depth is primarily communicated through **Tonal Layers** and **Soft Shadows**. 

1.  **Level 0 (Base):** The main background surface.
2.  **Level 1 (Cards):** 16px-24px corner radius with a subtle 4px blur shadow (10% opacity) to signify interactable containers.
3.  **Level 2 (Overlays/Modals):** These use **Glassmorphism**. A backdrop filter blur (20px) with a semi-transparent white (80% opacity) or dark (70% opacity) fill creates a focused, sophisticated "lens" effect, appropriate for eye care.
4.  **Level 3 (Popovers):** Higher elevation shadows with 12px blur to indicate immediate user attention.

## Shapes
The shape language is inviting yet precise. Standard containers use a **16px radius (rounded-lg)**, while large hero sections or featured diagnostic cards use a **24px radius (rounded-xl)**. 

Interactive elements like buttons and chips follow the **Pill-shaped** convention (fully rounded) to contrast against the structured, rectangular nature of clinical data grids, making actions clearly distinguishable from information.

## Components
- **Buttons:** Primary buttons are pill-shaped with the primary color and white text. Secondary buttons use a tonal background (10% primary color) for lower visual weight.
- **Cards:** All diagnostic results must be housed in cards with 16px internal padding and 24px corner radii. 
- **Input Fields:** Outlined style with 8px radius. Active states use a 2px primary border. Labels must be persistent to aid users with cognitive impairments.
- **Chips:** Used for patient tags or diagnostic status (e.g., "Stable," "Observation Required"). These utilize high-contrast semantic colors with 50% opacity backgrounds and 100% opacity text.
- **Medical Illustrations:** Use thin-line, clean SVG illustrations. Avoid heavy fills; use primary color accents to highlight specific ocular zones.
- **Selection Controls:** Checkboxes and radio buttons use the primary color with a 4px "touch target" buffer for accessibility.