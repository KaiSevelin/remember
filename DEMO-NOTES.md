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

## The component library

Eight preview cards live in [public/design-system/](public/design-system/), with a gallery
at **http://localhost:3000/design-system/** that shows all of them on one page.

| Card | Group | Covers |
| --- | --- | --- |
| Type scale | Type | `.logo`, `.tagline`, `.note-text`, `.note-meta`, `label`, `.hint`, `.empty` |
| Semantic colour | Colors | danger / accent / default / muted, shown as real states |
| Note row | Components | `.note` default, countdown, `.alarmed`, `.done`, full list |
| Buttons | Components | `.primary`, `.link`, `.tab`, `.delete`, dev-only button |
| Form fields | Components | all four input types, plus a field with an error |
| Navigation | Components | `.topbar`, `.tabs`, `.badge` |
| Panels | Components | `.card.auth-card`, `.card.note-form` |
| Feedback | Components | `.error`, `.empty`, `.hint`, `.dev-badge` |

**The cards restyle themselves.** Each preview links to the live `/styles.css` rather than
copying it, so redesigning the app redesigns the library in the same breath. There is no
regeneration step and nothing goes stale mid-demo.

The Colors card deliberately shows *states* rather than hex swatches — an alarmed row, an
error, a primary button — so it stays correct through any restyle, and it doubles as the
"red means overdue, not `#ff0000`" story.

To push to a Claude Design project, first make the previews self-contained (an uploaded
card has no server to resolve `/styles.css` against):

```sh
npm run ds:bundle      # writes dist/design-system/*.html with the CSS inlined
```

Then sync from `dist/design-system/`. Re-run the bundle after any restyle so the uploaded
cards match what is on screen.

## Running the demo

**Move 1 — the restyle.** Paste:

> Redesign the stylesheet: type scale, spacing system, semantic colour tokens, focus
> states, dark mode. Keep alarmed notes red. Keep every existing class name. Don't change
> the HTML or JS.

*"Keep every existing class name" is not optional.* The previews and the app both select on
`.note`, `.primary`, `.tab` and friends. If a redesign renames them, the app keeps working
(it sets those classes in JS) but every card in the library goes unstyled.

Reload the app, then flip the OS to dark mode.

**Move 2 — the system.** Open the gallery. Same eight cards, now wearing the new design,
without anyone regenerating them. Run `npm run ds:bundle` and sync.

**Move 3 — the payoff.** Paste:

> Add a priority chip to each note — low, medium, high — using the existing tokens.

No colours named; it should come out matching. This is the beat that makes the case.

## The banked result — `after-design`

The Organic restyle has already been run and pushed to the **`after-design`** branch, so
there is a working "after" even if the live generation misbehaves.

```sh
git checkout after-design -- public/styles.css   # five-second recovery, mid-talk
git checkout main -- public/styles.css           # back to ugly
```

Only the stylesheet differs. Reload the browser; no restart needed.

**What it decided, so you can speak to it:**

- **It added a `danger` role.** Organic is a mono scheme — terracotta accent, sage
  accent-2, and no colour meaning "something is wrong". Remember requires red for
  overdue notes, so the restyle extended the system with a semantic danger token in
  Organic's own idiom rather than dropping in a stock red. This is the honest
  design-system moment of the talk: systems don't cover everything, and extending one
  deliberately is different from ignoring it.
- **It added dark mode.** Organic ships light only (`"band": "light"`). The dark variant
  is derived from Organic's own neutral ramp so the accent stays put. Also an extension,
  also marked as one in the stylesheet.

Everything else — palette, ramps, Caprasimo over Figtree, the 4.4px spacing steps, radius
and shadow scales, pill controls, `radius-lg` cards — is Organic's, copied unchanged.

**⚠ Organic pulls Caprasimo and Figtree from Google Fonts over the network.** On venue
wi-fi that is a real risk: without them the headings fall back to Georgia and a good chunk
of the visual impact goes with them. Load the app once on the venue connection before you
present so the fonts are cached, and don't panic if the logo looks plain — nothing else
breaks.

## Verifying a redesign

The headless browser checks used while building this live in the scratchpad and exercise
all three views, sign-up, add, delete, and the alarmed state. Re-running them after a
redesign confirms nothing structural broke. The quick manual version:

1. `npm run dev`, open the site, click **Skip login**.
2. Expect five notes, two with red backgrounds, and a `2` badge on the Due soon tab.
3. Open **Due soon** — the two red ones sort to the top.
4. Add a note with an alarm in the past; it should appear red immediately.
5. Tick it done, then delete it; the empty state and badge should update.
