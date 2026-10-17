---
name: Awakening
description: A dense, cosmic operating surface for fixed-maturity BTC credit previews.
colors:
  bg: "#04060c"
  bg-deep: "#020308"
  panel: "#0c0614"
  panel-high: "#120a1e"
  panel-inset: "#190e27"
  line: "rgba(147, 0, 228, 0.16)"
  line-medium: "rgba(171, 61, 239, 0.28)"
  line-strong: "rgba(190, 102, 255, 0.48)"
  violet: "#9300e4"
  violet-deep: "#6f00ad"
  violet-bright: "#b44dff"
  lavender: "#d4b3ff"
  text: "#ffffff"
  text-mid: "#eadff7"
  text-muted: "#a694b7"
  text-dim: "#746681"
  success: "#d4b3ff"
  warning: "#b44dff"
  danger: "#ff8181"
typography:
  display:
    fontFamily: "Space Grotesk, var(--font-local-sans), Avenir Next, sans-serif"
    fontSize: "clamp(38px, 4.3vw, 62px)"
    fontWeight: 690
    lineHeight: 1.02
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "Space Grotesk, var(--font-local-sans), Avenir Next, sans-serif"
    fontSize: "20px"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, var(--font-local-sans), Helvetica Neue, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, var(--font-local-sans), Helvetica Neue, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.08em"
  data:
    fontFamily: "JetBrains Mono, var(--font-local-mono), SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  micro: "5px"
  compact: "7px"
  control: "9px"
  field: "10px"
  surface: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "22px"
  xl: "24px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    height: "44px"
  button-secondary:
    backgroundColor: "rgba(147, 0, 228, 0.055)"
    textColor: "{colors.text-mid}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    height: "44px"
  field-amount:
    backgroundColor: "rgba(4, 6, 12, 0.68)"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  card-surface:
    backgroundColor: "rgba(12, 6, 20, 0.68)"
    rounded: "{rounded.surface}"
    padding: "22px"
  status-success:
    backgroundColor: "rgba(180, 77, 255, 0.095)"
    textColor: "{colors.success}"
    rounded: "{rounded.micro}"
    padding: "5px 8px"
---

# Design System: Awakening

## Overview

**Creative North Star: "The Protected Settlement Observatory"**

Awakening is an operate-first financial console set against a near-black cosmic ground. Its visual language carries a high-fidelity evolution of the `awakening-mvp` reference: precise violet and lavender hierarchy, restrained ambient light, dense market ledgers, and transaction detail that earns trust by making the mechanism legible rather than decorative.

The system should feel like a calm observation deck for protected settlement. Financial numbers, maturity dates, and PAT states stay sharper and more literal than the atmospheric framing around them. The product is deliberately not a generic SaaS dashboard: its signature is a visible invariant, explicit preview state, and dark-violet surfaces that make exact data easy to scan.

**Key Characteristics:**

- Near-black cosmic atmosphere with two diffuse violet ambient layers.
- Dense, ledger-like information surfaces with thin violet dividers instead of roomy marketing cards.
- Violet directs attention; lavender carries hierarchy and non-error state, while red remains reserved for failures.
- Preview/mock status is persistent, specific, and never styled as live protocol confirmation.
- Desktop prioritizes a wide data shell; mobile retains the information model through cards and stacked controls.

## Colors

The palette is a black-violet field where tonal surfaces establish depth, violet reserves attention for protocol structure and action, and semantic colors state operational truth.

### Primary

- **Protocol Violet** (`colors.violet`): primary action fill, active navigation, and the core signal in invariant and PAT treatments.
- **Focused Violet** (`colors.violet-bright`): narrow highlights, table labels, active track edges, and instrument-like line work; it is more precise than promotional.
- **Deep Violet** (`colors.violet-deep`): the darker terminus of primary action gradients.
- **Lavender Hierarchy** (`colors.lavender`): selected text, high-value secondary emphasis, and keyboard-visible focus.

### Secondary

- **Resolved Lavender** (`colors.success`): open/healthy statuses, positive rates, and confirmation only.
- **Preview Violet** (`colors.warning`): non-live, unsigned, or otherwise constrained states; it must not be used to imply a failure.
- **Exception Red** (`colors.danger`): field errors and unavailable/error states only.

### Neutral

- **Cosmic Ground** (`colors.bg`, `colors.bg-deep`): the uninterrupted application field beneath all content.
- **Violet Glass Surfaces** (`colors.panel`, `colors.panel-high`, `colors.panel-inset`): layered containers, with translucent panel variants preserving the ambient field.
- **Three-Step Hairline** (`colors.line`, `colors.line-medium`, `colors.line-strong`): quiet separation at rest, stronger affordance on controls and focus-adjacent elements.
- **Readable White Scale** (`colors.text`, `colors.text-mid`, `colors.text-muted`, `colors.text-dim`): from primary data to supporting operational metadata.

**The Violet Rarity Rule.** Let dark ground and text carry most of a screen. Use bright violet to identify hierarchy, interaction, protocol logic, and explicitly labeled preview states—not to flood surfaces or make color the only carrier of state.

## Typography

**Display Font:** Space Grotesk, with the bundled local Geist sans fallback.

**Body Font:** Inter, with the bundled local Geist sans fallback.

**Label/Mono Font:** JetBrains Mono, with the bundled local Geist Mono fallback.

**Character:** The display face provides the confident, compact voice for page-level promises and section titles. Inter keeps explanatory copy humane and quick to read; the mono role makes rates, dates, IDs, labels, equations, and exact decimal values behave like inspectable financial instruments.

### Hierarchy

- **Display** (`typography.display`): page titles and the core product promise; use the responsive display scale and compact tracking.
- **Headline** (`typography.headline`): panel and section headings, concise and visibly subordinate to the page title.
- **Body** (`typography.body`): explanatory and safety text; keep paragraphs bounded to the established readable measure.
- **Label** (`typography.label`): compact uppercase field and metadata labels with deliberate tracking.
- **Data** (`typography.data`): table cells, rates, balances, IDs, statuses, equations, and time values. Do not substitute proportional body text for exact figures.

**The Instrument Rule.** If a value can be compared, signed, settled, or audited, present it in the data role; interpretation belongs beside it in the body role.

## Layout

The desktop shell is constrained to `--content` (1440px) with generous outer breathing room and a sticky, translucent 72px protocol header. Main content uses a 24px desktop gutter, a 36px page rhythm, and compact internal panel padding. The markets hero is an asymmetric two-column composition: explanation and invariant on the left, API-derived metric grid on the right. Borrow and lend flows use a wide context column beside a narrower sticky transaction ticket so the consequences remain visible while users work.

Tables are the primary desktop market and position surface. Cells align numeric values to the right, use hairline separators, and preserve a minimum ledger width for precision. At 1100px, the market hero stacks and portfolio summary reorganizes. At 860px, the header wraps, network detail retreats, flow columns become one column, and the ticket releases from sticky positioning. At 640px, market tables transform into labeled two-column cards with their semantic table headers visually hidden; controls become full-width or stacked while preserving at least 44px touch targets.

**The Dense-Until-Narrow Rule.** Preserve data density when there is room for it. Change the container model on small screens; do not merely shrink the desktop ledger until it becomes illegible.

## Elevation & Depth

Awakening uses tonal layering and translucent panels as its default depth system, not heavy card shadows. The ambient field stays fixed behind content; blurred violet glows create a restrained cosmic depth. Borders do most of the structural work. Only the sticky transaction ticket receives a soft, wide violet shadow, and primary actions receive a compact violet glow that intensifies slightly on hover.

**The Resting-Flat Rule.** At rest, depth comes from panel tone, translucency, and hairlines. Shadows are reserved for the sticky decision surface and active primary action—not ordinary cards, rows, or badges.

## Shapes

The form language is gently rounded and technical. Main surfaces use the `rounded.surface` corner; fields use `rounded.field`; compact controls and metadata use tighter radii; network and preview status use `rounded.pill`. Dividers are one-pixel violet hairlines, with nested metric and summary grids using a shared divider background to create a precise ledger seam.

Asset markers, PAT seals, status dots, and transaction-step numerals are circular. Avoid oversized pills, blob-like cards, or arbitrary mixed radii: curvature should soften dense financial surfaces without making them playful.

## Components

### Buttons

**Character:** compact, certain, and operational.

- **Shape:** minimum touch height of 44px; primary and secondary controls use `rounded.control`.
- **Primary:** `button-primary` uses the violet-to-deep-violet action gradient with white text and a small violet lift/glow on hover.
- **Secondary:** `button-secondary` is a quiet translucent violet surface with a medium hairline; hover strengthens the border and background, not the elevation.
- **Disabled:** reduce opacity and block the pointer affordance; disabled copy must remain explicit about why live action is unavailable.
- **Focus:** all interactive links, buttons, and inputs use an offset lavender focus outline.

### Badges and Statuses

**Character:** small, mono, and evidentiary—not decorative tags.

- **Network / preview badges:** use a pill silhouette, compact mono type, a medium hairline, and an explicit status dot.
- **Market status:** use lavender for open/healthy state and brighter violet for matured or non-live state; wording carries the semantic distinction.
- **Preview honesty:** deterministic, mock, unsigned, and transaction-disabled states stay in visible copy near the action or data they qualify.

### Cards / Containers

**Character:** dark ledger surfaces rather than floating SaaS cards.

- **Surface:** `card-surface` uses panel translucency, a quiet hairline, and the main surface radius.
- **Metric grids:** use shared thin seams between individual dark cells; labels are bright mono and values use data typography.
- **Transaction ticket:** remains sticky only on wider layouts, with the system's sole structural shadow and progressive quote/preview disclosure.
- **PAT explainer:** combines a violet-tinted gradient panel, circular seal, compact PAT label, and visible terminal-repayment equation.

### Inputs / Fields

**Character:** precise quote-entry instruments.

- **Style:** amount controls use `field-amount`, a medium hairline, mono entry text, and a compact unit token inside the field.
- **Focus:** the containing field strengthens its hairline and gains a subtle violet focus halo; the inner input does not add a second outline.
- **Error:** helper copy uses the danger color while keeping the user's entered amount visible and intact.

### Navigation

**Character:** a persistent protocol rail, not a marketing menu.

- **Desktop:** the sticky translucent header contains brand, primary routes, runtime badge, and wallet actions.
- **Active state:** a faint violet surface and a one-pixel bright-violet underline identify the current section.
- **Mobile:** the header wraps into a full-width route row; the runtime badge may hide to protect action space, but preview truth remains on each relevant core surface.

### Dense Tables and Mobile Market Cards

**Character:** a readable market ledger that changes form without changing facts.

- **Desktop:** semantic tables retain column labels, aligned numeric cells, hover row tint, and compact action controls.
- **Mobile:** each market row becomes a bordered card with `data-label` headings for values; asset pair and actions span the full width.
- **Precision:** never round away protocol-relevant decimal information merely to make a card look cleaner.

### Transaction Preview Steps

**Character:** a calm, explicit commitment sequence.

- **Style:** an ordered, vertically divided list with circular, zero-padded mono numerals.
- **Behavior:** show only after a quote result exists; pair the steps with clear local/unsigned/live capability language.

## Do's and Don'ts

### Do:

- **Do** keep the near-black ground, fixed ambient violet layers, and restrained violet accents together as one cosmic operating environment.
- **Do** use display type for promises and panel titles, Inter for explanation, and the mono role for every exact market, quote, and position value.
- **Do** keep PAT coverage, maturity, and preview/mock state adjacent to the decisions they qualify.
- **Do** preserve semantic HTML tables on desktop and their labeled card transformation on mobile.
- **Do** retain visible keyboard focus, reduced-motion support, and 44px minimum controls on mobile.

### Don't:

- **Don't** turn the ledger into a sparse grid of generic white or pastel SaaS cards.
- **Don't** use rich violet or glowing primary buttons to imply a live transaction, signature, or deployed-contract state.
- **Don't** hide deterministic, mock, unsigned, or disabled status behind a tooltip, wallet state, or secondary screen.
- **Don't** replace exact decimal values or mono protocol labels with vague, rounded marketing copy.
- **Don't** add continuous animation, parallax, or decorative motion; preserve the existing short reveal and spinner behavior, then honor reduced-motion preferences.
