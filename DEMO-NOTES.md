# Demo notes — the deliberate "before" state

The app is fully functional. All of the ugliness is confined to
[public/styles.css](public/styles.css); the markup and JavaScript are untouched and
semantic. A design pass should be able to fix everything below by rewriting that one
file — no HTML or JS edits required.

The previous polished stylesheet is kept at
[backup/styles.polished.css](backup/styles.polished.css) as a fallback if the live demo
goes sideways. Copy it over `public/styles.css` and reload.

## What is deliberately wrong

Each of these is a finding a design review should raise on its own.

**Typography**
1. Comic Sans for headings, Times New Roman for body — two typefaces that agree on nothing.
2. No type scale. Sizes are ad hoc: 9, 10, 11, 12, 13, 14, 15, 17, 19, 22, 26, 42px.
3. `text-shadow` used decoratively on the logo, the primary button and alarmed note text.
4. Labels are 10px uppercase, well below a comfortable reading size.

**Colour**
5. No palette and no tokens — every colour is a hardcoded hex, several of them pure
   primaries (`#ff00ff`, `#00ffff`, `#ff0000`, `#ffff00`).
6. Clashing hues with no hierarchy: mint background, cyan top bar, magenta borders.
7. Poor contrast in places — the olive `#999900` tagline on white is the worst offender,
   and yellow-on-magenta buttons are not far behind.
8. Dark mode was removed entirely. There is no `prefers-color-scheme` block.

**Spacing and layout**
9. No spacing system. Paddings and margins are arbitrary one-offs (1px, 2px, 3px, 4px,
   6px, 8px, 9px, 12px, 14px, 18px, 22px, 25px, 30px).
10. No `max-width` on the content, so text lines run the full width of the display.
11. Float-based note rows instead of flexbox, with `overflow: hidden` to clear them.
12. Everything is centre-aligned, including left-aligned content that should not be.
13. The add-note form is a cramped vertical stack rather than a considered row.

**Interaction and accessibility**
14. No `:hover` states anywhere.
15. No `:focus-visible` styles — keyboard focus is browser-default or invisible.
16. Beveled `outset`/`inset` borders and `ridge` — 1990s widget chrome.
17. No transitions.
18. The responsive breakpoint was deleted, so narrow windows overflow horizontally.
19. Inconsistent shape language: nothing has a border radius, and border widths jump
    between 1, 2, 3, 4 and 5px, mixing `solid`, `dashed`, `dotted`, `inset`, `outset`
    and `ridge`.

## What must keep working

If a redesign breaks any of these, it has gone too far.

- **`[hidden] { display: none !important; }` must survive.** Every view swap depends on
  it. Without it the login screen never disappears and the app looks dead on sign-in —
  because any author `display` rule silently overrides the browser's `[hidden]` default.
  This one line is load-bearing, and it is the single easiest thing to lose in a rewrite.
- Alarmed notes need a red background — it is in the original brief.
- The `.done`, `.alarmed` and `.tab.active` states must stay visually distinct.
- The `dev only` badge should stay visibly a warning, not decoration.

## Verifying a redesign

The headless browser checks used while building this live in the scratchpad and exercise
all three views, sign-up, add, delete, and the alarmed state. Re-running them after a
redesign confirms nothing structural broke. The quick manual version:

1. `npm run dev`, open the site, click **Skip login**.
2. Expect five notes, two with red backgrounds, and a `2` badge on the Due soon tab.
3. Open **Due soon** — the two red ones sort to the top.
4. Add a note with an alarm in the past; it should appear red immediately.
5. Tick it done, then delete it; the empty state and badge should update.
