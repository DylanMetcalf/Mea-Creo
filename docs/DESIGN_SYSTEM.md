# Design system

**Premium technology company, enterprise-grade product design, human and welcoming UX.**
The website is brand expression, the workspace is operational precision, and the client
portal is trust and clarity. All three share the same visual DNA.

The live source of truth is **Workspace → Design system** (`/workspace/design-system`): every
token and component in each of its states. Tokens live in `src/app/globals.css`; change a
token there and the whole product follows. Emails and PDFs can't read CSS variables, so they
use `src/config/brand.ts`, which mirrors the tokens (change both together).

## Palette: "escarpment light"

Evolved from the original sage monogram (`#4a6b58`) and the Mpumalanga landscape Mea Creo
works from: forest greens, a luminous mint signal, dusk blue and golden-hour ember.

| Role               | Token(s)                                   | Value(s)                          |
| ------------------ | ------------------------------------------ | --------------------------------- |
| Text               | `ink`, `ink-soft`, `muted`, `subtle`       | `#0e1915` … `#7f8c86`             |
| Background         | `paper` (cool sage mist, never plain grey) | `#f1f4f0`                         |
| Surface / elevated | `surface`, `surface-2`, `elevated`         | `#ffffff`, `#f6f8f5`              |
| Border             | `border`, `border-strong`                  | `#dde4de`, `#c5d0c8`              |
| Primary            | `brand-50 … brand-950`                     | `brand-700 #1f4a37` for actions   |
| Signal (accent)    | `signal`                                   | `#7fe0b2`, on dark surfaces only  |
| Secondary accent   | `dusk-100/300/700`                         | `#e4ecf5` / `#9db7d3` / `#284a66` |
| Warm accent        | `ember-500`, `clay-600`                    | decorative light; clay for text   |
| Dark sections      | `night`, `night-2`, `night-3`, `night-*`   | `#07110d` …                       |
| Status             | `success/warning/danger/info` 100 + 700    | always with a label and icon      |

### Gradients (tokens and utilities)

| Utility                 | Use                                                         |
| ----------------------- | ----------------------------------------------------------- |
| `bg-signal`             | Primary and CTA buttons, progress, "the result" moments     |
| `bg-horizon`            | Hero panels, CTA band, daily brief, report hero, auth panel |
| `bg-aurora`             | Soft light behind light page headers                        |
| `text-gradient(-night)` | One phrase per page at most ("Easier to choose.")           |
| `edge-glow`             | 1px luminous border on featured cards                       |
| `bg-grid(-light)`       | Fine grid behind technical visuals, always masked           |

Gradients are never random: three named gradients, each with a job.

### Depth

Radius `card` 14px, `sm` 10px, `lg` 22px. Shadows `card` (resting), `raised` (hover,
menus), `lifted` (overlays, hero visuals), `glow` (primary actions). Glass (`bg-white/5` +
blur) only on dark surfaces.

## Type

- **Manrope** (display, 700, tight tracking): headings, prices, metrics. Engineered and
  precise without being cold. No serif headings anywhere.
- **Geist** (body, UI): readable at small sizes; tabular numbers for money and counts.
- **Geist Mono** (`label-mono`): eyebrows, labels, metadata. Uppercase, tracked.

## Rhythm (website)

Light → gradient moment → dark → light → showcase → gradient CTA → dark footer. `Section`
takes `tone="paper" | "surface" | "night" | "horizon"`.

## Components (`src/components/ui`, `src/components/*`)

- **Actions**: `Button`/`LinkButton`: `primary`, `cta` (conversion moments, with glow),
  `secondary`, `ghost`, `danger`, `inverse`, `glass`; sizes `sm`–`xl`; hover lift, focus
  ring, pressed, disabled, loading (`SubmitButton`).
- **Inputs**: `TextField`, `TextArea`, `SelectField`, `CheckboxField`, `RadioField`,
  `FileDropField`, all inside `ActionForm` (errors, kept values, no-JS support).
- **Feedback**: `Badge`, `Callout`, `Progress`, `Skeleton`, `PageSkeleton`, `Spinner`,
  `EmptyState`, `ErrorState`, `Tooltip`, `Kbd`, `Toaster` + `toast()`.
- **Data**: `Stat`, `Metric` (with change), `BarList`, `Sparkline`, `IndexRing`,
  `IndexPanel`, `Timeline`, `Table`.
- **Navigation**: `Tabs`, workspace sidebar + `Breadcrumb` + `CommandPalette` (⌘K, `/`),
  website header with `SiteNav` and full-screen `MobileMenu`, portal nav + bottom tab bar.
- **Overlays**: `Modal`, `Drawer` (native `<dialog>`), `Dropdown`.

## Motion

Subtle and fast: 150–300ms with `--ease-out`. Buttons lift on hover and press down; nav
underlines slide; cards light up on hover; bars grow and the Index ring draws in; content
reveals on scroll where the browser supports scroll timelines. All motion is disabled under
`prefers-reduced-motion`, and content is visible without it.

## Visibility Index

The Mea Creo Visibility Index (`src/modules/audits/visibility-index.ts`) is always labelled
as Mea Creo's own measure, never a Google score, and the method is one click away wherever
it's shown.

## Accessibility

WCAG 2.2 AA: contrast checked for text tokens on `paper`, `surface` and `night`; visible
focus on every control; keyboard support for the command palette, menus and dialogs;
status never shown by colour alone.
