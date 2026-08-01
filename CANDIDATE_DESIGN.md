# Candidate Dashboard Design System (Mercor-style)

Apply this consistently to every candidate dashboard page. Clean, light, modern,
lots of whitespace. Reference: the home (`app/dashboard/DashboardHome.js`) and
jobs (`app/dashboard/jobs/page.js`) pages already follow this — match them.

## Layout
- Page wrapper: `max-w-6xl mx-auto` (use `max-w-5xl` for text-heavy pages like profile)
- Page heading: `text-3xl md:text-4xl font-black tracking-tight text-slate-900`
- Heading + optional right-side action on the same row (`flex items-center justify-between`)
- Sub/secondary text: `text-slate-500`
- Section heading: `text-xl font-bold text-slate-900 mb-4` (optionally `(count)` in `text-slate-400 font-medium`)
- Small label: `text-xs font-black uppercase tracking-[0.2em] text-slate-500`

## Cards
- Standard card: `bg-white border border-slate-200 rounded-2xl p-6`
- Hover (clickable): `hover:border-indigo-400 hover:shadow-[0_10px_30px_-12px_rgba(79,70,229,0.25)] transition-all`
- Card grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5` (or 2-col for wider cards)
- Empty state: `rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center` with a `text-slate-500` line + an indigo CTA link

## Buttons
- Primary: `bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-slate-800 transition`
- Primary accent (CTA): `bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 transition`
- Secondary/outline: `border border-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 transition`

## Tabs (pill toggle)
```
<div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100">
  <button className={active ? 'bg-white text-slate-900 shadow-sm ...' : 'text-slate-500 hover:text-slate-800 ...'}>...</button>
</div>
```
Each button: `px-5 py-2 rounded-full text-sm font-semibold transition`

## Banners / status
- Amber info banner: `rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3.5` with `text-amber-800` text + a bold CTA on the right
- Success: emerald equivalents (`bg-emerald-50 border-emerald-200 text-emerald-700`)

## Badges / chips
- `text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full`
- Neutral: `bg-slate-100 text-slate-600` · Success: `bg-emerald-50 text-emerald-700` · Accent: `bg-indigo-50 text-indigo-600 border border-indigo-200`

## Score / rubric bars
- Track: `h-2 bg-slate-100 rounded-full` · Fill: `h-2 bg-indigo-500 rounded-full` (width = value%)
- Score number: `text-indigo-600 font-bold`

## Colors
- Primary text `text-slate-900` · secondary `text-slate-600/700` · muted `text-slate-400/500`
- Accent indigo-600. Success emerald-600. Warning amber-600. Danger red-600.
- Never use dark (`slate-900`) page backgrounds — this is a LIGHT dashboard.

## Tone
- Friendly, spacious, confident. Bold headings, calm secondary text.
- Rounded-2xl everywhere. Thin `border-slate-200`. Subtle shadows on hover only.
