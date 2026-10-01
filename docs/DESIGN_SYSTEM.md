# Design system

Calm, editorial and trustworthy: the brand should feel like a careful advisor, not an
agency shouting. Built from the existing identity (hand-drawn monogram, sage green,
near-black ink, warm paper), deepened for accessible contrast.

## Tokens (`src/app/globals.css`)

| Token                                   | Value                                  | Use                                       |
| --------------------------------------- | -------------------------------------- | ----------------------------------------- |
| `ink`                                   | `#191717`                              | Body text, headings                       |
| `ink-soft`                              | `#3a3633`                              | Secondary text                            |
| `muted` / `subtle`                      | `#6b6560` / `#8f8881`                  | Descriptions, metadata                    |
| `paper`                                 | `#f6f3ee`                              | Page background                           |
| `surface` / `surface-2`                 | `#ffffff` / `#faf8f5`                  | Cards, hover rows                         |
| `border` / `border-strong`              | `#e6e0d7` / `#d4ccc0`                  | Dividers, inputs                          |
| `brand-50…950`                          | sage ramp, `brand-700 #3b5a48` primary | Buttons, links, active states, charts     |
| `clay-600`                              | `#a55a36`                              | Accent for "needs you" badges, sparingly  |
| `success/warning/danger/info` 100 + 700 |                                        | Status only, always with a label and icon |

Radius 10px; two shadows (`card`, `raised`).

## Type

- **Newsreader** (serif) for display headings and the portal's greetings and page titles.
- **Geist** for everything else; tabular numbers for money and counts.

## Components (`src/components/ui`)

`Button`/`LinkButton` (primary, secondary, ghost, danger, inverse), `Card` + `CardHeader` +
`CardBody`, `Badge`, `Callout` (info, warning, danger, success, neutral, brand), `Stat`,
`EmptyState`, `DescriptionList`, `Progress`, `Tabs`, `PageHeader`, forms (`ActionForm`,
`TextField`, `TextArea`, `SelectField`, `CheckboxField`, `SubmitButton`), `StatusBadge`,
`HealthLabel`, `DueLabel`, `BarList`, `Sparkline`, `Prose` (sanitised markdown).

## Rules

- **Status is never colour alone**: every badge has text; health uses an icon + label.
- **Charts**: one hue (sage) for magnitude, values printed at the bar end (the chart is
  its own table), no dual axes. Health is a labelled list rather than a coloured chart.
- **Not connected** is a first-class state: say what's missing and how to connect it.
- **Demo data** is always labelled ("(Demo)" names, demo badges and banners).
- **Mobile**: the portal is designed phone-first with a bottom tab bar; every grid is one
  column by default; nothing scrolls sideways at 375px except tables, which scroll inside
  their card.
- **Copy**: plain English, specific, no guarantees, no buzzwords (QC enforces this on
  client-facing text).
- **Accessibility**: skip links, labelled form fields with inline errors, visible focus,
  `aria-live` for async results, sufficient contrast on all text tokens.
