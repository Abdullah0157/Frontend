# Dark → Light Theme Conversion Map (canonical — every agent uses THIS)

Goal: convert the site from a dark theme to a clean, friendly **white/light** theme.
Apply these class replacements consistently. When a class isn't listed, pick the
nearest light equivalent that preserves the visual hierarchy (darker text = more
emphasis on light bg).

## Backgrounds
| Dark (find) | Light (replace) |
|---|---|
| `bg-slate-950` | `bg-slate-50` |
| `bg-slate-900` | `bg-white` |
| `bg-slate-900/95`, `bg-slate-950/80`, `bg-slate-950/40` | `bg-white/95` (nav) or `bg-white` |
| `bg-slate-800` (cards/pills) | `bg-slate-100` |
| `bg-slate-800 hover:bg-slate-700` | `bg-slate-100 hover:bg-slate-200` |
| `bg-indigo-950/40`, `bg-indigo-950/30` | `bg-indigo-50` |
| `bg-emerald-950/40`, `bg-emerald-950/30`, `bg-emerald-950/20` | `bg-emerald-50` |
| `bg-amber-950/40`, `bg-amber-950/30` | `bg-amber-50` |
| `bg-red-950/40` | `bg-red-50` |
| `bg-slate-950/60`, `bg-slate-950` (inputs) | `bg-white` |

## Text
| Dark (find) | Light (replace) |
|---|---|
| `text-white` | `text-slate-900` |
| `text-slate-100` | `text-slate-900` |
| `text-slate-200` | `text-slate-800` |
| `text-slate-300` | `text-slate-700` |
| `text-slate-400` | `text-slate-500` |
| `text-slate-500` | `text-slate-400` |
| `text-indigo-400` | `text-indigo-600` |
| `text-emerald-400` | `text-emerald-600` |
| `text-amber-400` | `text-amber-600` |
| `text-red-400` | `text-red-600` |
| `text-purple-400` | `text-purple-600` |
| `text-blue-400` | `text-blue-600` |

## Borders
| Dark (find) | Light (replace) |
|---|---|
| `border-slate-800` | `border-slate-200` |
| `border-slate-700` | `border-slate-300` |
| `border-slate-900` | `border-slate-200` |
| `border-indigo-900` | `border-indigo-200` |
| `border-emerald-900` | `border-emerald-200` |
| `border-amber-800`, `border-amber-900` | `border-amber-200` |
| `border-red-800` | `border-red-200` |

## Accent buttons — KEEP indigo-600 fills (they already read on light)
- `bg-indigo-600 hover:bg-indigo-500 text-white` → **keep as-is** (primary button)
- `bg-gradient-to-br from-blue-500 to-indigo-600` (logo) → keep
- `.btn-style-9` and `.btn-shimmer` → keep; they work on light

## Shadows
- `shadow-2xl`, `shadow-indigo-500/30`, `shadow-indigo-500/5` → keep or soften; fine as-is.
- Dark drop shadows on dark cards can become `shadow-sm` / `shadow-md` on light.

## Focus rings on inputs
- `focus:border-indigo-500` → keep
- `focus:ring-2 focus:ring-indigo-100` → keep (already light)
- `focus:ring-indigo-500/20` → keep

## Special cases
- **globals.css** (Agent 1 only): flip `:root` `--foreground-rgb` to a dark slate
  (e.g. `15,23,42`) and `--background-*` to white/near-white (`255,255,255`).
  Change `body { color; background }` to light. The `input, textarea, select`
  default rule currently forces DARK inputs — flip it to WHITE bg + dark text so
  typed text is visible on the light theme. Keep `input.bg-white` override.
- **ParticleBackground.js** (Agent 1): the colored particle canvas over a dark bg
  will look wrong on white. Either lower particle opacity substantially and use
  muted/light-blue tones, OR make the component render nothing / a very subtle
  light effect. Prefer subtle: reduce opacity to ~0.15 and connection lines faint.
- **Admin pages (`app/admin/**`) are ALREADY light — do NOT touch them.**
- Gradients like `from-slate-900 to-indigo-50/30` → `from-white to-indigo-50`.
- `from-indigo-950/40 via-slate-950 to-blue-950/40` → `from-indigo-50 via-white to-blue-50`.

## Rule of thumb
On light bg: primary text = `text-slate-900`, secondary = `text-slate-600/700`,
muted = `text-slate-400/500`, cards = `bg-white border-slate-200`, page = `bg-slate-50`.
Keep all indigo/emerald/amber ACCENT semantics; just shift the shade for contrast.
