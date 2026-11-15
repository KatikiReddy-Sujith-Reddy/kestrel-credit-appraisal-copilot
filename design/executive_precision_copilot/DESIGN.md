---
name: Executive Precision Copilot
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#45464d'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#525e7d'
  primary: '#000a24'
  on-primary: '#ffffff'
  primary-container: '#14213d'
  on-primary-container: '#7c89aa'
  inverse-primary: '#b9c6ea'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#99efe5'
  on-secondary-container: '#006f67'
  tertiary: '#00072c'
  on-tertiary: '#ffffff'
  tertiary-container: '#001a60'
  on-tertiary-container: '#5d80ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b9c6ea'
  on-primary-fixed: '#0d1b36'
  on-primary-fixed-variant: '#3a4664'
  secondary-fixed: '#9cf2e8'
  secondary-fixed-dim: '#80d5cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#dce1ff'
  tertiary-fixed-dim: '#b7c4ff'
  on-tertiary-fixed: '#001551'
  on-tertiary-fixed-variant: '#0039b5'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  financial-metric-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  financial-metric-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  financial-table-cell:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies high-stakes financial intelligence, institutional trust, and analytical clarity. Engineered for enterprise SME credit underwriting and appraisal, the visual personality balances authoritative banking rigor with the agility of assistive AI. 

The aesthetic is grounded in **Modern Corporate Minimalism** infused with high-density data architecture. It avoids superficial decoration, opting instead for crisp boundaries, calibrated contrast, and clear structural hierarchy. The core philosophy is augmented agency: intelligence is assistive, transparent, and verifiable, reinforcing the non-negotiable tenet: *"Copilot advises. Humans decide."*

The UI prioritizes cognitive ergonomics: high-density tabular ledgers, contextual audit trails, role-delineated perspectives, and zero visual ambiguity across risk markers.

## Colors

The palette establishes role-driven operational environments and unambiguous credit appraisal statuses. 

### Core Palette
- **Primary Chrome & Executive Navigation:** `#14213D` (Deep Navy) conveys institutional weight and operational governance.
- **Base Surfaces & Backgrounds:** `#F8FAFC` (Slate Canvas) paired with `#FFFFFF` (Surface Container) ensures high legibility during multi-hour financial analysis.
- **Dividers & Structural Rules:** `#E2E8F0` (Default Rule) and `#CBD5E1` (Emphasized/Column Rule).
- **Typography:** `#0F172A` (Primary Text), `#1E293B` (Secondary Text), and `#64748B` (Muted/Microcopy).

### Role Contextual Accents
Color tokens define active operational viewpoints across appraisal workflows:
- **Relationship Manager (RM / Field):** `#0F766E` (Deep Teal), with `#F0FDFA` (Surface) and `#CCFBF1` (Border).
- **Credit Analyst:** `#1D4ED8` (Deep Royal Blue), with `#EFF6FF` (Surface) and `#BFDBFE` (Border).
- **Credit Manager / Risk Approver:** `#1E293B` (Slate Navy), with `#F1F5F9` (Surface) and `#334155` (Border).
- **Governance / Super-Admin / Audit:** `#6D28D9` (Royal Purple), with `#FAF5FF` (Surface) and `#E9D5FF` (Border).

### Semantic & Appraisal Status Tokens
Every status indicator must use matched pairs (solid text/icon against calibrated light surface):
- **Valid / Approved / Low Risk:** Text `#15803D`, Surface `#DCFCE7`, Border `#86EFAC`.
- **Needs Review / Caution / Pending:** Text `#B45309`, Surface `#FEF3C7`, Border `#FDE68A`.
- **Blocked / Breach / Critical Error:** Text `#B91C1C`, Surface `#FEE2E2`, Border `#FCA5A5`.
- **In-Progress / Underwriting:** Text `#1D4ED8`, Surface `#DBEAFE`, Border `#93C5FD`.
- **Draft / Inactive / Non-Applicable:** Text `#64748B`, Surface `#F1F5F9`, Border `#E2E8F0`.

## Typography

Inter serves as the unified typographical engine. Its mechanical neutrality, optical clarity at micro-scales, and robust OpenType font features make it ideal for data-dense underwriting.

### Numerical & Financial Formatting Rules
All financial figures, ledger tables, currency calculations, balance sheets, and ratios must strictly enforce:
- **Font Feature Settings:** `font-feature-settings: "tnum" 1, "cv05" 1, "zero" 1` (Tabular numbers, slashed zero, and unambiguous glyph forms).
- **Indian Digit Grouping:** Amounts in ₹ (INR) must follow the Indian numbering standard `[XX,XX,XX,XXX.XX]`. Examples:
  - Base currency: `₹18,50,000`
  - Compact analytical format: `₹18.50 L` (Lakhs) or `₹4.25 Cr` (Crores).
- Ratios (e.g., DSCR, TOL/ATNW) and percentages must align with the same tabular figures standard.

## Layout & Spacing

The layout is built upon an 8px grid system (with a sub-grid of 4px for compact data tables, toolbars, and pill badges). 

### Layout Model
- **Enterprise Desktop (≥1280px):** Multi-column workbench structure. A fixed 72px left-hand executive navigation rail expands on hover or lock, paired with a 12-column dynamic work canvas (1.5rem gutters, 2rem margins). When the Copilot AI drawer is pinned, it occupies an exact 380px or 440px right panel with the primary grid reflowing dynamically.
- **Tablet (768px - 1279px):** 8-column fluid grid. Executive navigation collapses into an off-canvas drawer or top persistent app-bar. Copilot acts as a floating bottom sheet or overlay drawer.
- **Mobile (<768px):** 4-column single-stack flow with 1rem margins. Financial data cards convert from multi-column tabular viewports into vertical key-value appraisal tiles.

### Density Tiers
- **Comfortable:** Margin `1.5rem`, gap `1rem`. Reserved for Executive Summary dashboards and portfolio-level risk charts.
- **High-Density Underwriting:** Margin `0.75rem`, cell padding `0.375rem 0.5rem`. Used in financial spreads, GST reconciliations, bank statement analyzers, and covenant trackers.

## Elevation & Depth

Visual depth is communicated primarily through **tonal separation and low-contrast architectural borders**, eliminating arbitrary, heavy drop-shadows that degrade data readability in dense screens.

### Depth Hierarchy
1. **Canvas (Base Level 0):** `#F8FAFC`. Background bedrock.
2. **Cards & Table Rows (Level 1):** `#FFFFFF` bordered by `#E2E8F0`. Crisp separation using `border: 1px solid #E2E8F0`. No drop shadow.
3. **Sticky Headers & Tabular Sticky Columns (Level 2):** `#FFFFFF` with a bottom boundary of `#CBD5E1`. On scroll, applies an ambient diffused shadow: `0 2px 4px -1px rgba(15, 23, 42, 0.04), 0 4px 6px -1px rgba(15, 23, 42, 0.02)`.
4. **Interactive Overlays & Role Switcher Menus (Level 3):** `#FFFFFF` container with `border: 1px solid #CBD5E1` and precise, crisp shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.
5. **Modal Underwriting Confirmations & Copilot Flyouts (Level 4):** Surface `#FFFFFF`, border `#CBD5E1`, with backdrop veil `rgba(15, 23, 42, 0.50)` using `backdrop-filter: blur(4px)`.

## Shapes

The design uses a **Soft (Level 1)** structural curve logic. Sharp enough to convey institutional discipline, yet polished with subtle border radiuses.

- **Base Radius (0.25rem / 4px):** Form inputs, table cells, micro-badges, checkbox frames, and nested data cards.
- **Medium Radius (0.375rem / 6px):** Primary/secondary action buttons, role selector toggles, and dropdown popovers.
- **Large Radius (0.5rem / 8px):** Structural cards, modal dialogues,Copilot advisory prompt containers, and data widgets.
- **Full Pill Radius (9999px):** Status badges, numerical risk counters, and the "SIMULATED DATA" watermark tag.

## Components

### 1. Simulated Data Badge
- **Placement & Visuals:** Fixed top-center or top-right in the global navigation bar.
- **Structure:** Pill shape (`9999px`), `0.125rem` solid border.
- **Color:** Background `#FEF3C7`, text `#92400E`, border `#F59E0B`.
- **Typography:** `label-sm`, uppercase, `letter-spacing: 0.05em`.
- **Iconography:** Leading orange alert triangle (12x12px).

### 2. Human Governance Disclaimer Strip
- **Format:** Persistent or inline contextual bar positioned at the base of Copilot recommendations and CAM (Credit Appraisal Memo) generation triggers.
- **Copy:** `"Copilot advises. Humans decide. All risk scores and appraisal rationale require formal underwriter sign-off."`
- **Visuals:** Surface `#F8FAFC`, left border `3px solid #14213D`, text `#475569`, icon `shield-check` in `#14213D`.

### 3. Role Switcher & Persona Indicator
- **Variants:** Segmented control button or active profile dropdown.
- **Current Role Representation:**
  - *RM:* Badge border `#0F766E`, text `#0F766E`, subtle glow/dot `#14B8A6`.
  - *Analyst:* Badge border `#1D4ED8`, text `#1D4ED8`, subtle glow/dot `#3B82F6`.
  - *Credit Manager:* Badge border `#334155`, text `#1E293B`, subtle glow/dot `#64748B`.
  - *Governance:* Badge border `#6D28D9`, text `#6D28D9`, subtle glow/dot `#8B5CF6`.

### 4. Financial Status Pill Badges
- **Dimensions:** Height 22px, padding `0 8px`, border radius `9999px`.
- **Typography:** `label-sm`, tabular weight.
- **Rules:** Must never use raw saturated primaries. Strictly light tint background + contrasting dark border + dark text matching the semantic color specification.

### 5. Buttons & Actions
- **Primary:** Background `#14213D`, text `#FFFFFF`, hover `#1E293B`, focus ring 2px `#0F766E`.
- **Secondary / Ghost:** Surface transparent, border `1px solid #CBD5E1`, text `#0F172A`, hover `#F1F5F9`.
- **Role Accent Button:** Dynamically mapped to active role (e.g., Deep Teal for RM actions, Royal Blue for Analyst runs).

### 6. Inputs & Financial Form Fields
- **Container:** Border `1px solid #CBD5E1`, background `#FFFFFF`, text `#0F172A`, placeholder `#94A3B8`.
- **Focus State:** Border `1.5px solid #0F766E`, ring `2px rgba(15, 118, 110, 0.15)`.
- **Currency Adornment:** Fixed left addon `₹` in `#64748B`, background `#F8FAFC`, right-aligned tabular text input.

### 7. Dense Financial Cards & Ledgers
- **Header:** Height 44px, bottom border `1px solid #E2E8F0`, uppercase category label with secondary total in tabular format.
- **Table Grid:** Row height 36px (compact) or 44px (standard). Alternating row highlight `#F8FAFC` on hover. Numeric columns right-aligned. Negative monetary values denoted in brackets `(₹X,XX,XXX)` or `#B91C1C`.
- **Responsive Behavior:** Below 768px, horizontal grid lines convert into isolated stacked key-value blocks with the metric pinned prominently in bold.