---
name: Hyperloop Awakening
description: Existing dark, violet and white interface for fixed-maturity credit and testnet actions.
colors:
  bg: "#04060c"
  bg-deep: "#020308"
  panel: "#0c0614"
  panel-high: "#120a1e"
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
  danger: "#ff8181"
typography:
  display:
    fontFamily: '"Space Grotesk", var(--font-local-sans), "Avenir Next", sans-serif'
    fontSize: "clamp(38px, 4.3vw, 62px)"
    fontWeight: 690
    lineHeight: 1.02
    letterSpacing: "-0.038em"
  title:
    fontFamily: '"Space Grotesk", var(--font-local-sans), "Avenir Next", sans-serif'
    fontSize: "20px"
    fontWeight: 620
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Inter", var(--font-local-sans), "Helvetica Neue", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  data:
    fontFamily: '"JetBrains Mono", var(--font-local-mono), "SFMono-Regular", Consolas, monospace'
    fontSize: "12px"
    fontWeight: 400
rounded:
  badge: "6px"
  navigation: "8px"
  button: "9px"
  field: "10px"
  panel: "14px"
  pill: "999px"
spacing:
  compact: "8px"
  row: "16px"
  panel: "24px"
components:
  button-primary:
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-secondary:
    backgroundColor: "rgba(147, 0, 228, 0.055)"
    textColor: "{colors.text-mid}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  faucet-claim:
    backgroundColor: "{colors.violet-deep}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
  faucet-ledger:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
---

# Design System: Hyperloop Awakening

## Overview

The incumbent interface uses near-black ground, purple panels, white text and lavender emphasis. Dense financial data sits inside bordered surfaces; wallet actions and transaction feedback remain visible beside the relevant task. This is a record of the existing implementation, not a new identity or redesign.

**Key Characteristics:**

- Dark ground with violet borders and white/lavender typography.
- Compact data surfaces with responsive stacking.
- Explicit wallet, network and transaction states.

## Colors

### Primary

Violet and deep violet provide action fills; bright violet marks active navigation and emphasis. Lavender supplies highlighted text, focus outlines and status feedback.

### Neutral

Background and deep background anchor the page. Panel and raised panel distinguish containers and rows. White is the principal text color; mid and muted text support descriptions. The three purple border strengths distinguish quiet divisions, controls and focused elements. Danger is the existing error accent; status meaning also appears in text.

**The Existing Palette Rule.** Extend the current dark ground and white/purple accents without introducing a replacement color identity.

## Typography

The stylesheet requests Space Grotesk for display, Inter for UI text and JetBrains Mono for data. The root layout bundles Geist Sans and Geist Mono as local fallbacks; the requested named fonts are not bundled there. Treat the CSS stacks as declared intent, not proof those first-choice fonts render.

Large headings have tight tracking and short line height; section titles are compact. Body text is fourteen pixels, while subtitles use fifteen pixels and a more open line height. Tables use the data stack. Faucet balances use UI text with tabular numerals and wrapping, with muted supporting labels.

## Layout

The centered shell has a maximum width of 1440px, desktop side padding of 24px and a sticky header with a minimum height of 72px. At 860px the navigation wraps onto its own horizontally scrollable row and content side padding becomes 18px. Repeated gaps and padding use the compact, row and panel steps above, with local intermediate values retained in code.

Faucet uses one bordered ledger with asset, wallet balance, per-claim amount and action columns. At 900px columns tighten; at 700px each asset becomes a stacked row with paired numeric fields, visible field labels and a full-width claim action. Footer columns also stack. This responsive pattern belongs to the Faucet; existing market and position layouts retain their own breakpoints.

## Elevation & Depth

Depth comes from tonal purple surfaces, thin borders and diffuse background glows. The sticky header uses translucent dark fill and backdrop blur. Shared primary actions have a soft violet shadow and a one-pixel hover lift; Faucet claim actions override the resting gradient and shadow with a solid deep-violet fill and no resting shadow. Wallet dialogs use a dark ambient shadow.

## Shapes

Panels use the shared fourteen-pixel radius. Controls have smaller rounded corners; network badges and search fields are pills. Asset artwork and existing logo treatments are retained. Borders remain thin and colored by the shared line strengths.

## Components

### Buttons

Primary and wallet buttons share a violet gradient, white text and a minimum height of 44px. Secondary controls use a translucent violet fill and a visible border, which strengthens on hover. Disabled buttons reduce opacity and use a disabled cursor. Focus-visible outlines are lavender, two pixels wide with a three-pixel offset.

### Inputs / Fields

Search fields use dark translucent fill and pill corners; transaction fields use smaller rounded corners. Borders strengthen on focus. Preserve the existing explicit field labels and error messages.

### Chips

Network and status badges use tinted violet backgrounds, lavender text and compact data typography. A small dot supplements their text state.

### Cards / Containers

Dark purple panels use thin violet borders and compact internal padding. The Faucet ledger groups rows inside one container, using subtle row separators and a raised-panel hover fill.

### Navigation

Muted navigation links become brighter on hover. The current route has a purple tint, white text and a fine bright-violet underline. Faucet follows Settlement in the existing header.

### Faucet asset rows

Each row keeps its asset image and symbol beside the contract link, then shows wallet balance, claim quantity and wallet-aware action. Disconnected, wrong-network, pending and unavailable states change action text or availability. Live feedback distinguishes signature requests, submitted transactions and confirmed results.

## Do's and Don'ts

- Do preserve the existing dark ground and white/purple accents.
- Do keep asset identity, numerical labels and wallet action states explicit.
- Do preserve responsive stacking and visible keyboard focus.
- Don't redesign other pages as part of a narrow Faucet extension.
- Don't present submitted transactions as confirmed results.

Not canonized: tiny tracked eyebrow labels elsewhere in the stylesheet, unverified text contrast and unresolved `--font-mono` references are not prescriptions for new surfaces. This source-based record does not claim a rendered accessibility audit.
