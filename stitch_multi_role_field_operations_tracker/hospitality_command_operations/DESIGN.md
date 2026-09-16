---
name: Hospitality Command & Operations
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c9b3'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c937f'
  outline-variant: '#424938'
  surface-tint: '#9cd84f'
  primary: '#a6e358'
  on-primary: '#203700'
  primary-container: '#8cc63f'
  on-primary-container: '#304f00'
  inverse-primary: '#416900'
  secondary: '#ffb693'
  on-secondary: '#562000'
  secondary-container: '#eb6a1b'
  on-secondary-container: '#4b1b00'
  tertiary: '#99d9ff'
  on-tertiary: '#00354a'
  tertiary-container: '#3ec1fc'
  on-tertiary-container: '#004c69'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b7f568'
  primary-fixed-dim: '#9cd84f'
  on-primary-fixed: '#102000'
  on-primary-fixed-variant: '#304f00'
  secondary-fixed: '#ffdbcb'
  secondary-fixed-dim: '#ffb693'
  on-secondary-fixed: '#341000'
  on-secondary-fixed-variant: '#7a3000'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system delivers an enterprise-grade, real-time command center interface tailored for high-tempo corporate hospitality management, live logistics monitoring, and operational accountability. 

The visual language bridges tactical precision with hospitality warmth:
- **Design Archetype:** High-Contrast Dark Modern SaaS & Operations Dashboard.
- **Brand Personality:** Vigilant, streamlined, precise, responsive, and hospitable.
- **Audience:** Corporate hospitality operations directors, multi-venue logistics managers, event floor leads, and dispatch operators managing catering, personnel deployment, VIP banquets, and executive service pipelines.
- **Emotional Response:** Inspires absolute clarity under pressure, operational mastery, effortless situational awareness, and trust in live data feeds.

## Colors

The color palette directly extracts its vibrant DNA from the brand logo's signature chartreuse green and warm persimmon orange, anchored within deep dark slate canvas layers that prevent fatigue during prolonged control-room shifts.

### Palette Architecture
- **Primary (`#8CC63F` / Vibrant Chartreuse):** Used for primary system confirmations, online status indicators, active live dispatch updates, KPI positive deltas, and focal actions.
- **Secondary (`#F37021` / Vivid Orange):** Used for urgent live warnings, bottleneck highlights, active pipeline transit stages, critical shift handovers, and high-priority alerts.
- **Tertiary (`#38BDF8` / Electric Cerulean):** Represents communication channels, messaging sync pings, telemetry streams, and informational system timestamps.
- **Neutral Foundation:**
  - Background Canvas: `#090D16` (Deepest Void)
  - Surface Tier 1 (Containers/Nav): `#0F172A` (Rich Dark Slate)
  - Surface Tier 2 (Cards & Modules): `#1E293B` (Elevated Charcoal Slate)
  - Surface Tier 3 (Popovers, Tooltips, Table Rows Active): `#334155`
  - Border Subtles: `rgba(148, 163, 184, 0.12)`
  - Text Primary: `#F8FAFC`
  - Text Muted: `#94A3B8`

## Typography

The typographic hierarchy pairs structural industrial authority with frictionless legibility:
- **Display & Headlines (Space Grotesk):** Delivers clean geometry, crisp apexes, and a modern technical tone ideal for dashboard summaries, zone banners, and real-time counter metrics.
- **Body Text (Plus Jakarta Sans):** Offers balanced proportions, open apertures, and human warmth, allowing operators to parse staff assignments, guest dietary logs, and incident descriptions comfortably.
- **Labels & Telemetry (JetBrains Mono):** Reserved for RFID tags, order numbers, floor status codes, timestamps, and data grid tables to guarantee absolute tabular alignment and eliminate ambiguity.

## Layout & Spacing

This design system uses a strict 12-column responsive fluid grid structured for dense information architecture:
- **Desktop (1440px+):** 12 columns with 24px gutters and 32px screen edge margins. Allows tripartite dashboard configurations: Left navigation dock (64px mini / 240px expanded), Center operational canvas (8 columns), Right live stream feed / telemetry drawer (4 columns).
- **Tablet / Field Terminals (768px - 1439px):** 8 columns with 16px gutters and 24px margins. Right utility panel collapses into an on-demand slide-over sheet.
- **Mobile Handheld Dispatch (320px - 767px):** 4 columns with 12px gutters and 16px margins. Modular cards stack vertically into single-column operational timelines with bottom sheet interactions.

## Elevation & Depth

Visual hierarchy on dark slate canvases relies on controlled ambient luminescent rims and tonal surface containment rather than heavy drop shadows.

- **Base Canvas (`#090D16`):** The foundational substrate behind all modules.
- **Level 1 Containers (`#0F172A`):** Pinned headers, side nav rails, and data card backplates. Framed by a subtle hairline stroke: `border: 1px solid rgba(148, 163, 184, 0.08)`.
- **Level 2 Interactive Cards (`#1E293B`):** Hoverable delivery status cards and live tracking pods. Features a soft back-glow on hover: `box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(140, 198, 63, 0.2)`.
- **Level 3 Modals & Alert Drawers (`#1E293B` elevated):** Floats above the interface with high depth blur: `box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(243, 112, 33, 0.3)`.
- **Pulse & Live Signals:** Critical status chips emit an ambient localized blur pulse (`box-shadow: 0 0 12px rgba(140, 198, 63, 0.45)` for green active nodes; `0 0 12px rgba(243, 112, 33, 0.45)` for urgent warnings).

## Shapes

The geometric framework balances technical rigor with modern refinement. Radii scale predictably:
- Small interactive controls (chips, status badges, tiny toggles) adopt `0.375rem` (6px) or full capsule `9999px` geometry.
- Standard form inputs, buttons, and list row items utilize `0.5rem` (8px).
- Modular tracking cards, telemetry panels, and graph viewports utilize `0.75rem` (12px) to maintain cohesive containment.

## Components

### Buttons
- **Primary Action (Dispatch / Finalize):** Background `#8CC63F`, text `#090D16` (Bold Space Grotesk), sharp hover lift with glowing accent rim.
- **Secondary / Urgent Action:** Background `#F37021`, text `#FFFFFF`. Used for escalations, priority reassignment, or rerouting alerts.
- **Ghost / Utility:** Transparent surface with `border: 1px solid rgba(148, 163, 184, 0.2)`, text `#F8FAFC`, background shifts to `rgba(255, 255, 255, 0.06)` on hover.

### Status Badges & Chips
- Designed with high-contrast semi-transparent pill badges featuring a pulsating live status pip:
  - **Operational / Live / Normal:** Surface `rgba(140, 198, 63, 0.12)`, text `#8CC63F`, border `rgba(140, 198, 63, 0.25)`.
  - **In Route / Priority Attention:** Surface `rgba(243, 112, 33, 0.12)`, text `#FF7A18`, border `rgba(243, 112, 33, 0.25)`.
  - **Comms / System Idle:** Surface `rgba(56, 189, 248, 0.12)`, text `#38BDF8`, border `rgba(56, 189, 248, 0.25)`.

### Cards & Pipeline Trackers
- Nested structural panels with dark slate fills (`#1E293B`) divided by crisp, hairline grid lines.
- Pipeline tracks present horizontal connected nodes with orange/green progress lines indicating delivery phase, kitchen pass handoff, table clearance, or VIP banquet service progression.

### Live Communication & Incident Feeds
- Compact micro-feed rows with monospaced timestamps (`JetBrains Mono`), role avatar pills, and priority indicator borders along the left edge (4px solid green or orange indicator strip).

### Form Controls & Inputs
- Dark fields (`#0F172A`) inset within `#1E293B` containers. Active focus states replace soft borders with an energetic chartreuse outline (`outline: 2px solid #8CC63F; outline-offset: 1px`).
- Custom Checkboxes and Radios utilize high-contrast glowing tick marks filled with `#8CC63F`.