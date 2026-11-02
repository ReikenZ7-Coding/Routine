# Symphony OS on a wide window: the desktop shell

Status: the shell (sidebar, top bar, palette, menus, side panels), the wide worlds and every page in section 9 are built: Overview, Today, Calendar (week and month), Inbox, Gym, Language, Library, Groceries, Music, Settings and Your week (with "When things get done"). Still to come: right-click menus, a menu for more than four languages on Language (it falls back to a chip row), and keeping imported songs on the computer. Written 2 November 2026 for the Windows build (Electron around the Expo web export). The phone app is the reference for everything this document does not change, and it must not change at all.

Matthew's decision on the three desktop references: **their layout, our four looks.** The desktop copies the references' layout (where things sit, how big they are, how they behave). Every colour, material, radius, typeface and light comes from the four looks already in `src/theme.ts`, `assets/art/looks.json`, `DESIGN.md` and `.impeccable/design.json`. If this file and those disagree on a colour or a material, they win.

How to read the tags: **[ref1]** Sage (light and dark, rail plus labelled panel, week calendar), **[ref2]** Vitrea (dark glass, floating rail, pill navigation, board), **[ref3]** Sorvo (charcoal and orange, labelled floating sidebar, photo hero), **[ours]** something the references do not have, or a reference idea replaced by our own system. The reference frames live outside the repo in `/tmp/sym/ref` (1280x720, 2 fps; contact sheets `sheet-ref1.jpg`, `sheet-ref2.jpg`, `sheet-ref3.jpg`).

The phone baseline that proves the phone did not change (taken at `b74a939`, before any desktop work):

- `/tmp/sym/baseline`: `/tmp/rt/all.js`, 13 screens x 4 looks at 400x860, live clock and motion.
- `/tmp/sym/baseline-still`: the same 52 frames with a fixed clock (2026-11-02 10:30) and reduced motion, so a later build can be diffed pixel for pixel. Capture with `/tmp/sym/tools/all-still.js`, compare with `python3 -I /tmp/sym/tools/diff.py /tmp/sym/baseline-still <new dir> <heatmap dir>`. Two captures of the same build differ by at most 0.001% of pixels (anti-aliasing); any frame above 0.01% is a real change.
- `/tmp/sym/wide-now`: what HEAD draws in a 1440x900 and a 1024x768 window today (the phone layout stretched edge to edge; see "The world on a wide window").

---

## 1. Decisions at a glance

| Question            | Decision                                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One app or two      | One codebase. At 1024 dp and wider the app draws the desktop shell; below it, the phone app exactly as it is today. Android keeps building the APK from the same code.                                                                                                                                   |
| Sidebar             | One floating glass sidebar that is either a labelled panel (264 dp) or an icon rail (72 dp) **[ref3 structure, ref1 contents]**. Groups and items from the module map, counts where real data supports them, a "Needs you" block and a progress card **[ref1]**, the user card at the bottom **[ref3]**. |
| Top bar             | No bar container. Breadcrumbs on the left; on the right a search pill that opens the command palette (Ctrl+K), the look picker, reminders and a primary "New" button **[ref1]**.                                                                                                                         |
| Page header         | Big title, one line of real facts with the numbers emphasised, secondary actions on the right **[ref1]**.                                                                                                                                                                                                |
| Content             | A 12-column grid of glass panels with 20 dp gutters **[ref1, ref3]**. Panels are the pane tier; one hero per page at most.                                                                                                                                                                               |
| Forms and panels    | Forms open as a floating side panel on the right, not a bottom sheet **[ours]**. Settings and "Your week" become pages.                                                                                                                                                                                  |
| Colour and material | Only the four looks' tokens. New tokens are listed in section 12 and must exist in all four looks.                                                                                                                                                                                                       |
| World               | Each look gets a landscape master of its world, rendered by the same script, with its own pre-blurred lens and light layout (section 11). The portrait art is never stretched over a wide window.                                                                                                        |
| Phone               | Unchanged, pixel for pixel, proven against `/tmp/sym/baseline-still` (section 15).                                                                                                                                                                                                                       |

---

## 2. What the references measure

Measured on the 1280x720 frames with a pixel grid, then scaled by 1.125 to a 1440 wide window. Our values (last column) keep our own floors: reading text 16, targets 40 dp on desktop with hover and focus states (44 under a coarse pointer), our radii per look.

| Part               | ref1 @1280                                                 | ref2 @1280                                    | ref3 @1280                                        | Scaled to 1440 | Symphony OS @1440                                                                                       |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| Sidebar, collapsed | rail 76 wide, docked, hairline edge                        | floating pill rail 58 x 420, 21 from the edge | floating rail 74 wide, 14 from the edges          | 83 to 86       | **72**, floating 16 from the window edges (88 to its outer edge)                                        |
| Sidebar, expanded  | rail 76 + panel 236 = 312                                  | none                                          | one panel 225, 14 from the edges, radius about 22 | 253 to 351     | **264**, floating, radius 30 (the tab bar's `BAR.radius`)                                               |
| Logo tile          | 44, radius 12                                              | pill 126 x 50                                 | 36, radius 10                                     | 40 to 50       | **40** tile at the look's inset radius                                                                  |
| Nav item           | 46 square, pitch 52                                        | 40 discs, pitch 50                            | 40 tall, pitch 41, radius 10                      | 45 to 52       | **40** tall, pitch 44, pill radius 20, inside 12 dp of sidebar padding (concentric with 30)             |
| Group label        | "NEEDS YOU", 11 caps, tracked                              | none                                          | "STUDIO", 11 caps, tracked                        | 12             | **13**, sentence case, the look's label face (never uppercase)                                          |
| Collapse toggle    | 32 square, radius 8, panel top right                       | none                                          | 28, radius 8                                      | 31 to 36       | **36**, control glass circle                                                                            |
| User card          | avatar 34 + two lines                                      | avatar 40 in the top bar                      | 206 x 46, radius 12                               | 52             | **52** tall inset card                                                                                  |
| Top bar controls   | 40 tall at y 13 to 53                                      | 50 tall pills                                 | 40 tall in a 56 floating bar                      | 45             | **40** tall, centred on the sidebar's brand row (y 28 to 68)                                            |
| Search field       | 358 x 40, "Ctrl K" hint                                    | none                                          | icon only                                         | 403            | **360** x 40 control pill that opens the palette                                                        |
| Primary "New"      | 85 x 40, radius 12                                         | 46 disc in the rail                           | 88 x 40 pill                                      | 96             | **about 100** x 40 primary pill with the action glow                                                    |
| Page side padding  | 27 from the panel, 29 right                                | 21 right                                      | 12 from the sidebar, 26 right                     | 30 to 33       | **32** (24 below 1280)                                                                                  |
| Page title         | about 35 px (cap height 24)                                | two lines, about 33                           | about 33                                          | 37 to 39       | **38 on a 44 line** (34 on 40 below 1280), the look's title face                                        |
| Subtitle           | 14 on a 20 line, numbers bold                              | stat chips instead                            | 13, numbers bold                                  | 15 to 16       | **16 on 22** (body), figures in body medium and text ink                                                |
| Panel radius       | about 18                                                   | about 22                                      | about 20                                          | 20 to 25       | the look's `pane` radius (Lavender 22, Stone 24, Paper 22, Pine 20); hero radius for the hero           |
| Panel gap          | 18                                                         | 18                                            | 16 to 18                                          | 18 to 20       | **20** (16 below 1280)                                                                                  |
| Panel padding      | 19 to 20                                                   | 18                                            | 18                                                | 20 to 22       | **20** (16 below 1280)                                                                                  |
| Panel title        | 15, subtitle 13                                            | 15                                            | 15, subtitle 13                                   | 17, 15         | the look's section title (18 to 21) and `small` 14                                                      |
| Segmented range    | 160 x 34                                                   | 36 tall pills in a trough                     | none                                              | 38             | **36** tall trough (44 under a coarse pointer)                                                          |
| Filter chips       | 32 tall, 8 apart                                           | 30 tall with counts                           | none                                              | 36             | **36** tall pills (44 coarse)                                                                           |
| Rows               | 57 pitch, 34 icon tile, 14 + 12 text                       | 40                                            | 31 (thumbnails)                                   | 64             | **56** for two lines, **44** for one, 40 pebble                                                         |
| Bar chart          | bars 22 wide, pitch 42, hover column 44 wide radius 8      | area line with dashed comparison              | bars, heatmap, area                               | 25 / 48        | bars 28 wide on a full-height track column, radius 8                                                    |
| Week calendar      | gutter 56, day header 68, hour 44, event inset 4, radius 8 | none                                          | none                                              | 63 / 77 / 50   | gutter 56, day header 64, hour **48** (44 below 1280), blocks inset 3, radius = the look's inset radius |

What each reference gives us:

- **[ref1]** the information architecture and nearly every measurement: the sidebar's contents ("Needs you" with counts, a progress card, the user card), the top bar (breadcrumbs, search with a Ctrl+K hint, calendar, theme toggle, bell with a badge, "+ New"), the page header (title, a subtitle of facts with numbers emphasised, actions on the right), panels with a title, a one-line subtitle and controls on the right (segmented ranges, an "open" arrow button), filter chips, table rows grouped under day headers, the week calendar with a now line and a legend, the collapsed state where the sidebar becomes a rail and the module's sub-views become tabs, tooltips on rail icons, content that fades in on page change.
- **[ref2]** glass panels with a lit rim over a world that shows between them, a floating rounded rail, the selected item as a glass pill inside a trough (our Segmented already does this), a dashed comparison line on a chart, the board of columns (used for Inbox), a tinted hero card for a single item (used for Gym and Language).
- **[ref3]** the floating labelled sidebar with group labels and counts that collapses to icons, the selection pill that stretches from the old item to the new one (our tab bar's drop does exactly this), the top bar breadcrumbs, "Good morning, Marta" with a hero card on the left and a live panel on the right, the scrubber chart across the hero (our day line), a ranked list with bars (best streaks), a weekday-by-time heatmap (when things get done).

What we do not take, and why (the standing rules):

- Uppercase tracked group labels **[ref1, ref3]**: our labels are sentence case.
- The 2 px stripe on the left of the selected nav item and of calendar events **[ref1]**: no border-left over 1 px. The selected item is the glass drop; an event is told by its kind dot and a soft kind tint.
- The light and dark toggle **[ref1, ref3]**: we have four looks, so the toggle becomes the look picker.
- Floating bubbles and orbs **[ref2]**: glass as decoration. Our worlds already have their own moving light.
- Stat chips beside the title **[ref2]** and the row of four stat cards with sparklines **[ref3]**: hero-metric tiles. Facts go in the subtitle sentence and in panels that let you act on them.
- The photo hero **[ref3]** and product photos: stock pictures. Our hero is glass over our own world.
- The eyebrow chip on the hero ("Latest upload · Thu, 18:00") **[ref3]**: eyebrow chips. A plain meta line under the title says the same.
- "Help" in the sidebar **[ref3]**: there is no help content to link to.
- Every number the references show (money, subscribers, ratings): demo content. Every panel here shows the person's own data from the store, with an honest empty state.

---

## 3. Breakpoints and window behaviour

| Window width            | What draws                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| below 1024 dp           | The phone app, exactly as today: single column, the floating tab bar, bottom sheets, the floating button. Tablets and narrow browser windows stay here.                                                                                                                                                                                            |
| 1024 to 1279            | The desktop shell, **compact**: the sidebar starts as the 72 dp rail. Expanding it opens the 264 dp labelled sidebar **over** the content (an overlay with the look's `backdrop` dim behind it), which closes on Esc, on a click outside it, or after choosing a page. Shell inset 12, page padding 24, gutters 16, panel padding 16, title 34/40. |
| 1280 and wider          | The desktop shell, **comfortable**: the sidebar starts expanded and docked, and the content moves over for it. Collapsing it to the rail gives the content the room. Shell inset 16, page padding 32, gutters 20, panel padding 20, title 38/44.                                                                                                   |
| content wider than 1440 | The grid stops at 1440 dp and sits centred in the space right of the sidebar, so lines and panels never stretch past what the eye can follow.                                                                                                                                                                                                      |

- The switch uses `useWindowDimensions()` with a 24 dp band so a window dragged across the line does not flicker: it enters the shell at 1024 and leaves it below 1000. On a phone the switch is a constant and never listens to the window's size.
- A window that starts wide opens on Overview. Crossing the line keeps the page where it can: a desktop page the phone does not have stands in as its phone equivalent (Overview, Calendar, Music, Settings and Your week as Today; Groceries as the Library), and going wide again returns to the desktop page that was open. What is open inside a page (a half-typed form, a running focus timer, a review) does not survive the crossing yet, because the phone and the desktop are two navigators; the Windows app can only cross it by zooming.
- The docked or collapsed choice is remembered for comfortable windows only, under a new key `routine.desktop.v1` (`{ sidebar: 'expanded' | 'collapsed' }`). No existing key or shape changes. Compact windows always start with the rail.
- The Windows build sets the window's minimum to 1024 x 680, so the desktop app never shows the phone layout. A browser window can still go narrow and gets the phone app.
- Height: every page scrolls in the content area; the sidebar and the top bar stay put. Below 760 dp of height the sidebar's "Needs you" block shows fewer rows (section 5).

---

## 4. Shell anatomy

At 1440 x 900, sidebar expanded (all values dp):

```
x  0  16                     280  312                                                         1408  1440
y  0  +------------------------------------------------------------------------------------------------+
  16  |  +--------------------+                                                                       |
  28  |  | [logo] Symphony OS |  Symphony OS > Overview      [ Search or jump to...  Ctrl K ] (o) (!) [+ New] |  <- controls y 28-68
  68  |  |  Monday 2 November <|                                                                       |
  88  |  |  Overview        o |                                                                       |
  96  |  |  Today         10  |  Good morning, Matthew                          [Your week] [Open today] |  <- title 38/44
      |  |  Calendar          |  Monday 2 November · 1 of 11 done · Stretch is up next at 21:00 ·      |  <- subtitle 16/22
      |  |  Inbox          1  |  2 words to review                                                     |
 192  |  |                    |  +-- hero: Up next | Now playing (8 cols, 724) --+ +-- Needs you (4, 352) --+
      |  |  Health and growth |  |                                               | |                       |
      |  |  Gym               |  |                                               | |                       |
      |  |  Language       2  |  |  day line 05:00 ...... now ........... 24:00  | |                       |
 552  |  |                    |  +-----------------------------------------------+ +-----------------------+
      |  |  Home life         |  +-- Today's trail (8) ---------------------------+ +-- Calendar today (4) -+
      |  |  Groceries      4  |  ...                                                                       |
      |  |  Library           |                                                                            |
      |  |  Music          *  |                                                                            |
      |  |                    |                                                                            |
      |  |  Needs you         |  (hidden on Overview, which shows it in full)                              |
      |  |  [Today  1 of 11 ] |  <- progress card                                                          |
 832  |  |  [(M) Matthew    ] |  <- user card, opens Settings                                              |
 884  |  +--------------------+                                                                       |
 900  +------------------------------------------------------------------------------------------------+
```

At 1024 x 768, compact, rail:

```
x 0 12     84   108                                                                      1000 1024
  +-------------------------------------------------------------------------------------------+
  | +------+  Symphony OS > Gym       [ Search or jump to... Ctrl K ] (o) (!) [+ New]          |  <- y 24-64
  | |[logo]|                                                                                   |
  | |  >   |  Gym                                                    [Add session]           |  <- title 34/40 at y 88
  | | (o)  |  Push day today · 1 of 9 sets · 2 sessions a week                                  |
  | | (o)  |  +-- Today · Push day (8 cols) ------------------+ +-- Weekly plan (4) --------+    |
  | |  ..  |  ...                                                                              |
  | | (M)  |                                                                                   |
  | +------+                                                                                   |
  +-------------------------------------------------------------------------------------------+
```

Layering, bottom to top: the world (one `WorldFrame` for the whole window, with the wide art), the page content in its scroll, the top bar (with a `WorldFade` band once the page has scrolled), the sidebar, popovers and menus, the dim plus a side panel or the palette, `ThemeFade`. One world for the whole window means a page change crossfades only the content, never the world **[ours]**.

---

## 5. The sidebar

**Structure [ref3], contents [ref1], material [ours].** One glass object in two widths.

### Expanded (264 dp)

Top to bottom, inside 12 dp of padding:

1. **Brand row** (40 tall): the app icon in a 40 dp tile at the look's inset radius, "Symphony OS" in body medium 16, the date under it in `small` 14 muted ("Monday 2 November"), and the collapse button (36 dp control circle, chevron back; `accessibilityLabel` "Collapse sidebar", `aria-expanded`) **[ref1 title and subtitle, ref3 toggle]**.
2. **Navigation**, 20 dp below. Items are 40 tall, 4 apart, icon 20 at 14 dp from the item's left, label 16 body medium, an optional count on the right. Groups after the first have a 13 dp label in the look's label face, sentence case, 12 above and 4 below.

   | Group             | Item      | Icon (Ionicons)         | Count, from the store                                                                    |
   | ----------------- | --------- | ----------------------- | ---------------------------------------------------------------------------------------- |
   | (no label)        | Overview  | `home-outline`          | none (a dot in rail mode when anything needs you)                                        |
   |                   | Today     | `today-outline`         | steps still to do today (`total - done`, the same sums as the Today screen)              |
   |                   | Calendar  | `calendar-outline`      | none                                                                                     |
   |                   | Inbox     | `file-tray-outline`     | to sort (`inboxOpen(inbox, today).length`)                                               |
   | Health and growth | Gym       | `barbell-outline`       | none; when a session is planned today its name shows in the tooltip and in Needs you     |
   |                   | Language  | `language-outline`      | words to review (`dueWords(language, today).length`)                                     |
   | Home life         | Groceries | `basket-outline`        | to buy today (items where `needsBuying(item, today)`)                                    |
   |                   | Library   | `library-outline`       | none                                                                                     |
   |                   | Music     | `musical-notes-outline` | none; a 6 dp accent dot while something plays, the same dot as the phone's sounds button |

   A count is shown only when it is above zero. It is a 22 dp pill of inset glass, 8 dp side padding, the look's `type.badge` (13, or 12 on Paper), tabular. Counts are part of the item's accessible name ("Inbox, 1 to sort").

3. **Needs you** **[ref1]**, pushed to the bottom of the free space: a 13 dp label "Needs you", then up to three 40 dp rows from the same list Overview shows (section 9.1): a 16 dp glyph in the kind's text ink, the item's name (16, one line, ellipsis), and a short right-hand fact in muted (`21:00`, `2`, `late`). A row goes to the thing itself (Today with that step focused, the Language review, the Groceries list). When the list is longer: a "3 more on Overview" link row. With nothing waiting: one line, "Nothing needs you right now." On Overview this block is not drawn, because the page shows the full list; the same list never appears twice on one screen.
4. **Progress card** **[ref1 "October close 1/8"]**: inset glass, 12 dp padding: "Today" and "1 of 11" (tabular) on one line, then a bar of one segment per step (a continuous bar above 16 steps) in the `accent` on `track`, then one line in `small`: "Up next: Stretch at 21:00", "Trail complete", or "A clear day". Pressing it opens Today.
5. **User card** **[ref3]**: 52 dp inset card: the first letter of the name in a 36 dp disc (`node` with `onNode` ink), the name in body medium, the current look in `small` ("Lavender look"), and a gear glyph at the end. The whole card is one target that opens Settings ("Settings, Matthew"). This is where Settings lives, at the bottom.

Height budget at 900: brand row and padding 52, navigation 480 (9 items at 40 with 4 between, two group labels, 20 above), Needs you 148, progress card 72, user card 52, gaps 64: 868. Below 760 of height the Needs you rows drop one at a time (to the single "N things need you" link); the navigation never scrolls until there are more modules than fit (see "Room for what comes next").

### Rail (72 dp) [ref1, ref2]

The brand tile (40) at the top, the expand button (36) under it, then one 48 x 40 drop per item, 4 apart, with the icon at 22. Groups are separated by a 24 dp hairline in `border`. A count becomes a 7 dp dot in the `accent` at the icon's top right **[ref1's orange dots]**; the number moves into the tooltip and the accessible name. At the bottom, the user's 40 dp letter disc opens Settings. Needs you and the progress card are not in the rail; Overview's dot says something is waiting.

Tooltips **[ref1 "Money"]**: sheet glass, 13 caption text, 8 dp right of the rail, shown 400 ms after the pointer rests and at once on keyboard focus, gone 100 ms after it leaves. The tooltip repeats the item's accessible name; it never holds anything the item does not.

### Selection, hover, motion

- The current page's item carries the tab bar's glass drop (`material.drop`: fill, rim, side rim, shadow, ink). Moving to another page, the drop flows there on the tab bar's two springs (the leading edge springs ahead, the trailing edge catches up, then one glint) **[ref3's stretching pill, done our way]**. Under reduced motion it fades out and back in at the new item.
- Hover and focus put the new hover light (section 12) under the item in 120 ms and take it away in 160 ms. Focus also draws the ring. Nothing is shown on hover alone.
- Docking and collapsing (comfortable windows): the sidebar's width eases from 264 to 72 (or back) over 260 ms on the house ease-out; labels fade out in the first 120 ms (in during the last 150 ms when expanding); the content's left edge follows. Under reduced motion the sidebar and content fade out, switch, and fade in (150 ms each way). Glass inside re-measures its place when it settles, as it does today.
- Overlay (compact windows): the sidebar fades in and slides 12 dp from the left over 220 ms, the dim fades in over 200 ms; it leaves in 160 ms.

### Room for what comes next

The module map will grow (Time, Maps, Jarvis, more apps). Nothing for them is drawn now: no items, no pages, no "coming soon". The sidebar is built from a data list of groups and items, so a module is one entry: Time would join the first group after Calendar; Maps would start a new group; an assistant would also answer from the command palette's input. With up to 13 items the expanded sidebar fits a 900 dp window; past that the navigation scrolls inside the sidebar (with the edge fade) and the Needs you block yields first.

---

## 6. The top bar

No container **[ref1]**: the controls are separate pieces of control glass sitting on the world, centred on the sidebar's brand row (y 28 to 68 at comfortable, 24 to 64 at compact). Once the page scrolls, a `WorldFade` band fades in behind them with a 32 dp fade below, so nothing scrolls through the breadcrumbs (the same fade Now Playing uses under its fixed bar).

**Breadcrumbs [ref1, ref3]** at the content's left edge: 14 `small`, muted (`onSlabMuted` on Pine's slab), separated by a 12 dp chevron in faint; the last crumb is text ink in body medium and is not a link. The first crumb, "Symphony OS", goes to Overview. Real hierarchy only: "Symphony OS > Gym", "Symphony OS > Language > Chinese", "Symphony OS > Overview > Your week", "Symphony OS > Today > Tuesday 3 November". When space is short the middle crumbs fold into "...".

**Search pill [ref1]**, 360 x 40 (320 compact), control glass: a magnifier, the visible text "Search or jump to..." and a hint pill "Ctrl K" (inset glass, 13 in the label face, never mono; "⌘ K" on a Mac browser). It is a button that opens the command palette (`aria-haspopup="dialog"`, label "Search or jump to, Ctrl+K"). Ctrl+K opens it from anywhere.

**Command palette [ours, ref1's search made into a palette]**: a 640 dp sheet-glass dialog, 15% from the top, over the `backdrop` dim; enters with a 180 ms fade and a scale from 0.98 (fade only under reduced motion). A visible 13 dp label "Search or jump to" sits above the input; the input's placeholder is only an example ("A page, a routine, a word..."). Results are 44 dp rows (glyph, title, a short meta, a shortcut hint on the right) in groups:

- **Go to**: every page in sidebar order, then Settings and Your week.
- **Add**: Routine, To-do for today, Grocery item, and "Chinese word" (or "A language" before one is chosen, which goes to Language), the same four as the phone's Add sheet. Each opens the same form in the side panel.
- **Your things** (only while typing): matching routines (open the routine's form), to-dos (Inbox, focused), grocery items, words, songs and playlists, by name.
- **Look**: Lavender, Stone, Paper, Pine (the current one checked).
- **Do**: Start a 15 or 25 minute focus, play or pause the focus sound or song, the sleep timer, collapse or expand the sidebar, make a backup.

With no match: "Nothing matches "dentist"." and one action, "Add "dentist" to the inbox". Up and Down move, Enter runs, Esc closes and returns focus to whatever opened it; Tab stays inside. It is a combobox over a listbox (`aria-activedescendant`).

**Look button [ours, in ref1's theme toggle place]**: a 40 dp control circle with `color-palette-outline`, labelled "Change look, now Lavender". It opens a popover with the four looks as the Settings swatches (preview, name, one line), the current one checked; choosing one runs the existing 240 ms `ThemeFade`. A popover rather than a cycle: each change of look repaints the whole world, and stepping blind through four worlds to reach one is slower than seeing them.

**Reminders bell [ref1]**: a 40 dp control circle with `notifications-outline`. Its badge (an 18 dp pill of `node` with `onNode` ink, tabular 12) counts only what is due now: routines whose reminder time has passed today and that are still open, and timed steps whose time has passed without a tick or a skip. The popover (360 dp, sheet glass) lists them as rows with a 26 dp tick ring: "Stretch · reminder at 21:00", "Rise and shine · was at 07:00, still open". The words are calm: "still open", never "overdue" or "missed". Empty: "Nothing is due right now. Reminders you set on a routine show here when they come up." On this computer the bell is the only reminder (no system notifications yet); the popover's footer says so: "On this computer, reminders show here while Symphony OS is open."

**New [ref1 "+ New", ref3 "+ Create"]**: the screen's one primary action: a 40 dp primary pill (`primaryGradient`, `onPrimary`, `actionGlow`), a plus and "New". It opens a menu with the Add sheet's four rows (pebble in the kind's ink, title, one line) and their menu-only keys (R, T, G, W while the menu is open). Ctrl+N opens it from anywhere.

Everything else that is a page action (Your week, Share list, Add session) is a glass (secondary) button in the page header, so each screen still has one primary action.

---

## 7. The page header

**[ref1]**, every page: the title (the look's title face; 38/44 comfortable, 34/40 compact; tracking from the look's title token) and, 6 dp under it, one or two lines of facts in body 16 muted, with the figures set in body medium and text ink. Secondary actions sit on the right, bottom-aligned with the subtitle (40 dp glass buttons, 8 apart). The header's top is 24 dp under the top bar's controls; the grid starts 24 dp under the subtitle.

The subtitle is a sentence of real facts, never a slogan. When there is nothing to say yet, it says what the page is for ("Jot down anything. Put it on a day when you're ready.", the phone's Inbox line). A count of nothing is said in words ("Nothing planned this week"), never as a zero figure.

The title and the subtitle keep to a 720 dp measure, so they never run under the header art at the right; the actions stay at the right edge. The shell draws the header art between the world and the page (`HeaderArt.tsx`): Pine's canopy slab behind every page header, Paper's mountains behind the Overview and Today headers (section 10). Nothing in the header moves because of it.

---

## 8. Panels, grid and controls

**Grid.** 12 columns in the content box (1096 dp at 1440 with the sidebar docked; 936 at 1280; about 890 at 1024 with the rail). Gutters 20 (16 compact). Each page below gives spans. A panel whose span would come out narrower than 280 dp takes the whole row instead (or pairs 6 and 6). Rows align their panels' tops; a panel's height is its content's, except that the panels sharing the first row of a page match the tallest.

**Panel anatomy [ref1, ref2].** Pane glass at the look's pane radius. A header row: the title in the look's section-title face, a one-line subtitle in `small` muted under it, and on the right at most one control group (a segmented range, a 36 dp "open" button with `arrow-forward` labelled "Open Gym", or an action chip). The title sits at the panel's top padding whether or not a subtitle follows, and the control on the right is centred on the title's line, so panels side by side share a title baseline. 20 dp padding, the content 16 under the header. A panel holds content or a control; a panel with nothing to say is not drawn.

**Hero.** At most one per page, hero tier (with the bloom on Lavender and Pine), the look's hero radius and shadow.

**Primary button.** The top bar's New, and on a page only the one action a panel exists for (the first-run "Restore from a backup"): a 40 dp pill in `primaryGradient` with `onPrimary` ink. Its hover and focus light darkens a pill with light ink and lightens one with dark ink, so the label keeps its contrast (the gate checks both).

**Rows [ref1 table].** 56 dp for two lines (16 body medium title, 14 muted meta), 44 for one. A 40 dp inset pebble with the kind's glyph in its text ink on the left; the tick ring (26 dp in a 40 target) or a chevron on the right; a visible 36 dp "more" button where the phone has one. Hover light on the row, focus ring on the row. Group headers are 36 dp: the label face on the left, a quiet summary on the right ("Today · 1 of 4 done").

**Chips and switches.** Filter chips 36 tall with 14 padding, captioned by a label (`Micro`), the phone's `FilterRow` at desktop size. The segmented switch is the phone's `Segmented` at 36. Under a coarse pointer (`(pointer: coarse)`, a touch screen laptop) both go back to 44 and every target to 44.

**Charts [ref1, ref2].** Bars 28 wide, radius 8 at the top and square on the baseline, drawn over a full-height track column (`track`, radius 8), filling over 600 ms with a 40 ms stagger, as on the phone's "Your week". Axis labels in 13 caption `label` ink, in a 56 dp gutter on the left. Gridlines are 1 px in `border`, dashed 4/4, at the top, the middle and the base. The Gym series scales to at least 9 sets, so a single set is not a full bar. A target or last-week line is 1.5 px dashed in `label` **[ref2]**. Hovering or focusing a column puts a soft column behind it (the hover light, radius 8) and a sheet-glass tooltip above it **[ref1]**: "Saturday · 3 of 4 routines". Every column is focusable with its sentence as its label. No chart carries colour that means nothing: series are kinds.

**Popovers and menus.** Sheet glass with all corners rounded to the look's pane radius, the float shadow, 8 dp padding, 40 dp rows; open with a 160 ms fade and a 4 dp rise, close in 120 ms. Menus follow the menu-button pattern (Enter, Space or Down opens; arrows move; Esc closes and returns focus).

**Side panel (forms) [ours].** Every form that is a bottom sheet on the phone (routine, to-do, grocery item, word, session, backup, rename, confirm delete) opens on desktop as a floating panel on the right: 440 dp wide, 16 from the top, right and bottom, sheet glass with all corners at the hero radius, a 64 dp header (the sheet title face and a 40 dp close button), a scrolling body, the primary action at the bottom. The world dims under it (`backdrop`). It slides 24 dp in from the right and fades over 320 ms on the sheet curve, and leaves in 220 ms (fade only under reduced motion). Esc closes it (asking first if something was typed); focus is held inside and returns to the opener. One panel at a time, with the existing hand-over between sheets. The phone keeps its bottom sheets: the `Sheet` component picks its presentation from the shell, not from the look.

---

## 9. Pages

Spans are for comfortable windows; compact rules follow the 280 dp floor in section 8. Every page fades in its content over 180 ms with panels rising 10 dp in a 40 ms stagger (the first six), once per visit, as the phone's cards do **[ref1, ref3]**.

### 9.1 Overview (the new home)

**Header [ref1, ref3].** Title: the phone's greeting and name, "Good morning, Matthew" ("friend" before a name is set). Subtitle, built from the store: "Monday 2 November · **1 of 11** done · **Stretch** is up next at **21:00** · **2 words** to review." With nothing planned: "Monday 2 November · A clear day so far." On a new install: "Monday 2 November · Nothing on this computer yet." With everything done: "Monday 2 November · Every step done. **4 days** in a row." Actions: "Your week" (opens the Your week page) and "Open today".

**Row 1.**

- **Up next and Now playing**, hero, span 8 **[ref3's hero with its scrubber; ours inside]**. The left 60%: the meta line "Up next · 21:00 · in 53 min" (or "Happening now · 5 min left", the phone's exact wording, from `upNext`), the step's name in the look's display face at 32/38, its kind and duration in `small`, and two glass buttons: "Tick off" and "Open today". The right 40% is an inset well, **Now playing**: the 64 dp `SoundArt`, the name and its line ("Steady rain on a window"), play or pause and next, and "Open music". With nothing playing: "Nothing playing" and the three focus sounds as tiles that start one. Under the buttons, "Then": the next two timed steps with their times. Across the whole hero at the bottom, **the day line [ours, from ref3's scrubber]**: a 44 dp rounded band (the look's `track`; on Pine the slab trough, so its light nodes keep their contrast) from 05:00 to 24:00, the hours already gone tinted again up to now, 13 caption ticks every three hours under it, each timed step as a trail node at its time (done filled, up next lit, ahead as waypoints, skipped dashed: the trail's own node states and tokens; steps closer than 16 dp share one node with their count), and a now marker with its time. Hover or focus a node for its names and times (the tip fades in 120 ms and out 160 ms). No timed steps: the day line is not drawn. Everything done: the phone's "Trail complete" hero takes this place.
- **Needs you**, span 4 **[ref1]**. 56 dp rows, most urgent first: steps still open from earlier today ("Was at 07:00 · still open", with a tick ring), what is happening now or up next within an hour, to-dos for today (tick ring), words to review ("2 words to review", a "Review" glass button), today's gym session if not finished ("Push day · 1 of 9 sets", chevron), groceries to buy ("4 to buy", chevron), the inbox to sort ("1 to sort", chevron). Up to five; "Show all 8" expands in place. On a compact window the names take two lines. Empty: "Nothing needs you right now." The list comes from one new pure function, `needsYou(state, today, now)` in `src/lib`, with tests; the sidebar block and the bell read the same function.

**Row 2.**

- **Today's trail**, span 8: the trail's rows at desktop width (the same card, node, pebble and tick as the phone), the first six with "Open today · 5 more". Ticking here is ticking on Today.
- **Calendar today**, span 4 **[ref1 week calendar as an agenda]**: today's timed steps in time order (13 caption time in tabular `label` ink, the kind's dot, the title, a check when done), a "Now · 10:30" divider in the accent, then the day's untimed things under "Any time" (anytime routines, to-dos, the gym session, practice, groceries). Footer link "Open calendar". Empty: "Nothing with a time today."

**Row 3.**

- **Your week**, span 8 **[ref1 cash flow chart, ref2 dashed line]**: subtitle "The last 7 days"; on the right a segmented switch, Routines / Gym / Practice. Routines: each day's share of planned routines done (`weekStats().days`), kind routines. Gym: sets logged that day, kind gym. Practice: minutes that day with the daily target as a dashed line, kind language. Today's letter sits in the primary disc, as on the phone. Under the chart, the phone's sentence: "41% of routines done, 2 gym days and 20 min of Chinese practice." Gym sets and practice minutes per day need a small addition to `src/lib/stats.ts` (`weekSeries`), with tests. Before any data: "Your week fills in as you tick things off." On Overview a column opens the Your week page.

**First run.** The phone keeps its own copy, so a new install would otherwise open on eight empty panels. Until anything is saved on this computer, Overview shows one hero, "Bring your days across" (export a backup from Settings on the phone and restore it here, or start fresh), with "Restore from a backup" as the primary button and "Add a routine" and "Add a to-do" beside it, and a "Set up the rest" panel with Gym plan, Language practice and Groceries. The sidebar's progress card hides while the day has nothing planned.

- **Groceries to buy**, span 4: today's list by aisle (CheckRows; ticking buys), with "Share" as an action chip. Empty: "Nothing to buy today."

**Row 4.**

- **Gym today**, span 6 **[ref2 tinted item card]**: the session's name, "1 of 9 sets", the 8 dp bar, then each exercise as one row (name, working weight, set bubbles), and "Open gym". Rest day: "Rest day. Next: Pull day on Wednesday." (`nextSession`). No plan: "No gym plan yet." with "Set up a plan" (goes to Gym).
- **Language practice**, span 6: "5 of 15 min today" with its bar, "+5 / +10 / +15", the review line ("2 words to review", "Review"), and "Start a 15 min focus". No language: "Pick a language to start practising." with "Choose a language".

### 9.2 Today

**Header.** Title "Today" (or the weekday and date for another day: "Tuesday 3 November"). Subtitle: "Monday 2 November · **1 of 11** done" (the streak is said once, by the streak pill). A day still to come says "**10** planned". Actions: previous and next day (40 dp control circles, "Previous day", "Next day"), "Back to today" when another day is shown.

**Body.** Span 7: the phone's Today column as it is, on the bare world (glass on glass would make every card an inset): the streak pill, "Today's trail" with its count badge, the trail, the hint pane. Cards stop at 720 dp wide. A day still to come behaves exactly as on the phone. Span 5, stacked: **Month** (the calendar strip opened to its month view, with its marks and moods; a day opens that day here), **Balance** (the three rings), **How was today?** (the DayNote). No floating button: "New" in the top bar adds to the day shown.

### 9.3 Calendar

**[ref1 week calendar, our data.]** Header: "Calendar". Subtitle: "26 October to 1 November · **23** things planned · **9** done so far" (grocery lines are not counted as things; an empty week says "Nothing planned this week"). Actions: a Week / Month segmented switch, then previous, "This week", next.

**Week.** One pane, span 12, filling the window's height under the header; the time grid scrolls inside it under a fixed day header, and opens scrolled to two hours before now, or higher, to the top of a block that would otherwise be cut by the pane's edge.

- Day header (64 dp): the weekday in the 13 label face and the date at 20 tabular; today's date sits in a 32 dp disc of `node` with `onNode` ink **[ref1's green circle]**.
- An all-day lane (up to two rows, then "2 more", which opens that day): anytime routines ("Drink water · 3 of 8"), the gym session ("Push day"), practice ("Chinese · 15 min"), groceries ("Groceries · 4"), dated to-dos.
- The grid: 05:00 to 24:00, 48 dp an hour (44 compact), a 56 dp gutter with 24-hour times ("07:00") in 13 caption `label` ink, hour lines 1 px in `border`. Days are equal columns.
- Blocks: timed routines from their start for their duration (15 min when none is set), inset 3 dp in their column, inset glass tinted with the kind's soft wash, the look's inset radius, an 8 dp kind dot before the title (14 body medium) and "21:00 · 10 min" under it (13). No side stripe. Done blocks recede (faint ink, a line through the title). Overlapping blocks cascade: each later one is indented 12 dp and sits raised above the one it overlaps (sheet glass with the kind's wash and the float shadow), so every title keeps the column's width. Blocks that start within 30 minutes of each other share the column side by side instead.
- The now line **[ref1]**: 2 px in the `accent` across today's column, with an 8 dp dot at the gutter.
- Clicking a block opens the routine's form; a block 40 dp or taller has its own tick ring. Clicking an empty slot opens "New routine" with that start time and that weekday filled in. Dragging to move is not in this step: moving a weekly routine needs per-day changes the data does not have yet.
- Legend under the pane **[ref1]**: Routines, Gym, Language, Groceries, To-dos, each with its kind dot.

**Month.** The month grid (`monthGrid`), each day with the kind marks (`marksFor`) and a past day's mood; a day opens Today on that date.

**Phone calendars.** Events from the phone's calendars exist only in the Android app (`calendarSupported` is false on the web). On desktop the legend says "Phone calendar events show in the Android app." There is no invented event.

### 9.4 Inbox

**[ref2 board, ref1 row dropdown.]** Header: "Inbox", the phone's line as subtitle, or "**1** to sort · **2** planned" once there is something. Three columns, span 4 each, each a pane, all as tall as the tallest, so the board reads as one:

- **To sort**: the labelled composer at the top ("Add to inbox", the add disc at its end), then the rows.
- **Planned**: grouped by day ("Today", "Tomorrow", "Saturday 7 November").
- **Done this week**: receded rows.

Each row: the 24 dp check box, the title, the meta, a 36 dp "Plan" menu button (Today, Tomorrow, Pick a day..., Back to the inbox) and "more" (Rename, Delete). Empty columns say what they are for; with nothing anywhere, the phone's "Nothing to sort" pane takes the board's place.

### 9.5 Gym

**[ref2 item hero.]** Header: "Gym". Subtitle: "**Push day** today · **1 of 9** sets · 2 sessions a week". Action: "Add session".

Span 8: **Today**, the hero, and under it **History** (the last five workouts), so the two columns end close together: the session's name, "Today · 1 of 9 sets", the bar, the hint, then each exercise on one row (name and plan line, the weight stepper, the set bubbles; at this width they share the row), "New best" pills where they belong. Rest day: "Rest day", "Next: Pull day on Wednesday", and "Do a session anyway" (pick one). Span 4, stacked: **Weekly plan** (seven 44 dp rows, rest days in muted), **Personal records** (`personalRecords`, top five). No plan: one pane with the starter plans, as on the phone.

### 9.6 Language

Header: the language's title ("Chinese"), subtitle "**2** words · **5 of 15** min today · **1 day** in a row", action "Add a word". With several languages a segmented switch under the header picks one (a menu past four) **[ref1 sub-view tabs as our Segmented]**.

Span 8: **Today's practice** (the minutes, the bar, +5 / +10 / +15, the daily target switch), then **Review**: the flashcard at desktop size (the word in `fonts.word`), Space or Enter turns it, 1, 2 and 3 grade Again, Good and Easy while the card has focus, and the three buttons say so, then **Your languages**. Span 4: **Focus** (the timer: 15 / 25, the clock, Start), **My words** (searchable list with a count). No language yet: the phone's chooser, at page width.

### 9.7 Library (routines)

**[ref1 transactions table.]** On desktop the Library is the routines shelf; the groceries shelf is the Groceries page. Header: "Library", subtitle "**5** routines · **1 of 4** done today", action "New routine". A toolbar: the labelled search field (360 dp), the When chips and the Repeat chips on one line (wrapping when narrow). One pane, span 12, as a table: group headers "Today · 1 of 4 done", "Not today", "Ideas" (Ideas hide while searching or filtering, as on the phone). Each 64 dp row: the pebble, the name (16 body medium) with its schedule under it ("Every day · 21:00 · 10 min"), the streak pill, a bell glyph when a reminder is set, the tick ring and "more". No match: the phone's "No match" with "Clear search".

### 9.8 Groceries

Header: "Groceries", subtitle "**4** to buy today · **0** bought", actions "Share list" and "Add an item". Span 8: **To buy**, one pane per aisle (the aisle tile, the name, its count, CheckRows) in two columns. Span 4: **Bought today**, **Coming up** (`nextDue`). Empty: "All bought", as on the phone.

### 9.9 Music

Now Playing as a page. Header: "Music", subtitle "**Soft Rain** is playing · **3** songs · **2** playlists" (or "Focus sounds, your own songs and playlist links."), actions "Import songs" and "Add a link". Span 5: the player, hero tier: the art square (up to 360), the title and line, the seek bar, the transport (shuffle, previous, the play disc, next, repeat), the sleep timer. Span 7: **Focus sounds** (three tiles with their scenes), **Your music** (rows: title, length, added, more), **Playlists** (rows with "Opens in Spotify" in words, no logos). In the desktop build imported songs last for this visit only (`KEEPS_IMPORTS` is false on the web); the existing "for this visit" note stays until a later step keeps files on the computer.

### 9.10 Settings (a page)

Header: "Settings", subtitle "Your name, your look and your data." Span 8: **Your name** (the labelled field), **Look** (the four swatch cards in one row), **Phone calendar** ("Available in the Android app."), **Backup and restore**. Span 4, beside them: **This computer**: "Your things are saved on this computer. The phone app keeps its own copy; use Backup and restore to move everything across." (until there is sync, this sentence must be on screen), **Keyboard shortcuts** (the list in section 13, each key over what it does). A browser keeps Ctrl+N and Ctrl+1 to 9 for itself, so those two lines show only in the Windows app.

### 9.11 Your week (a page)

Breadcrumbs "Symphony OS > Overview > Your week". Header: "Your week", subtitle: the phone's sentence. Span 8: the week chart (as on Overview, larger). Span 4: **Best streaks** as a ranked list with bars **[ref3 "where they watch from"]**. Span 6: **Personal records**. Span 6: **When things get done** **[ref3 heatmap]**: weekdays by morning, afternoon and evening, each cell the share of routines done there over the last four weeks, in the routines kind colour on `track`, each cell focusable with its sentence ("Mondays, mornings: 9 of 12 done"). This needs one more pure function in `src/lib/stats.ts` with tests; it can follow in a later step.

---

## 10. Surfaces, tiers and tokens

Every surface below draws from the look's `colors.material`; none invents a fill, border or shadow.

| Surface                                             | Tier                                                                                                     | Tokens                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sidebar (expanded and rail)                         | chrome: the only lens-free live blur, because it floats over the world and, in the overlay, over content | `material.live` (web blur and saturate), `chromeTint`, the rim set, `shadowFloat`; radius 30 (`BAR.radius`) |
| Sidebar overlay dim (compact)                       | none                                                                                                     | `backdrop`                                                                                                  |
| Current nav item                                    | the tab bar's drop                                                                                       | `material.drop` (fill, rim, side rim, shadow, ink)                                                          |
| Nav count, progress card, user card                 | inset                                                                                                    | `material.inset`, `type.badge` 13, `text`, `accent` on `track`                                              |
| Group labels, Needs you rows in the sidebar         | text on chrome                                                                                           | `label`, `text`, `muted`, `kinds.<kind>.text`                                                               |
| Breadcrumbs, page title, subtitle                   | bare world                                                                                               | `type.title` face, `muted` and `text`; `onSlabMuted` on Pine's slab                                         |
| Search pill, look and bell buttons, collapse button | control                                                                                                  | `material.control`; on Pine's slab, the slab trough (`canopy.inset`)                                        |
| "New"                                               | primary button                                                                                           | `primaryGradient`, `onPrimary`, `actionGlow`                                                                |
| Bell badge, user letter, today's date disc          | node                                                                                                     | `node`, `onNode`                                                                                            |
| Panels                                              | pane                                                                                                     | the pane layer stack; `radii.pane`                                                                          |
| Overview hero, Gym today, the Music player          | hero                                                                                                     | `shadowHero`, `bloom` (Lavender, Pine), `radii.hero`                                                        |
| Rows, fields, chips, wells inside panels            | inset (automatic inside glass)                                                                           | `material.inset`                                                                                            |
| Calendar blocks                                     | inset with a tint                                                                                        | `kinds.<kind>.soft` as the tint, `kinds.<kind>.color` dot, `text`, `muted`                                  |
| Chart bars, heatmap cells                           | fills on a track                                                                                         | `kinds.<kind>.color` on `track`; today's disc `primary`                                                     |
| Now line                                            | mark                                                                                                     | `accent`                                                                                                    |
| Popovers, menus, tooltips, the palette, side panels | sheet glass, all corners                                                                                 | `material.sheet` (body, top rim, band), `shadowFloat`; the palette and side panels over `backdrop`          |
| Focus ring                                          | web `:focus-visible`                                                                                     | the existing global ring (2 px white, 5 px dark halo)                                                       |

How each look reads at 1440 **[ours]**:

- **Lavender.** The azure side of the world sits behind the sidebar, the rose pool behind the right-hand column; the two orbs circle the content's centre. White type throughout; the violet "New" bead with its rose glow is the one saturated object in the top bar; the Overview hero gets the bloom and the rose underglow.
- **Stone.** The window is top left, so the brightest light lands on the sidebar and the beams cross the content down to the right; every shadow falls down and right, so the sidebar throws its shadow onto the content. Thin Light titles at 38; champagne only on "New", the drop, ticks, the trail and the progress bar.
- **Paper.** A light page: ink type, milk glass, colour only for kinds, the streak and errors. The mountains (the phone's header art) sit at the top right behind the Overview and Today headers, 600 dp wide (520 compact, at most 45% of the window), their peak 24 dp under the window's top, fading out over the last 96 dp above the header's foot so no panel sits on them; they drift up at half the scroll speed and fade as the header leaves. The "New" pill and ticks are ink.
- **Pine.** The canopy slab is drawn behind every page header, from the sidebar's right gap to the window's right edge, flush with the top, so the top bar sits on the slab: breadcrumbs in `onSlabMuted`, the search pill and buttons as slab troughs, the moon glow behind the bell and "New" (as it sits behind the phone's top-right buttons). Its rounded 28 dp foot with the mint rim ends 16 dp under the subtitle; the pines stand at the bottom right, at most 180 dp tall. As the page scrolls the slab follows the header up, then stays as a band behind the top bar. The moon glow drifts with the look's moon light.

---

## 11. The world on a wide window

The worlds are drawn for a 400 x 860 phone frame: the backdrop is 1080 x 2340, the lens is that backdrop blurred at 540 x 1170, and each light's box is measured in frame widths.

What happens today in a wide window (`/tmp/sym/wide-now`): the portrait backdrop is cover-scaled to the window, so a 1440 wide window shows a 900 dp slice from the middle of a 3120 dp tall picture; Lavender's orbs become 1728 dp across; and there is a hard vertical seam at about x = 1080 (Lavender's luminance jumps from 83 to 91 across it, Paper's from 244 to 242), where a layer stops at its source width. The phone layout also stretches every trail card to 1350 dp.

The three ways to fill a wide window with portrait art, and why two are rejected:

- **Cover** (crop the portrait art): rejected. It shows an arbitrary middle slice, loses each world's composition (Stone's window, Paper's crag, Pine's moon all sit in the top third of the portrait), upscales the art, and the lights, sized by frame width, blow up.
- **Tile**: rejected. Repetition shows at once in soft light, and every seam passes behind glass, where the lens would show it again.
- **Blur and stretch**: rejected. The world would become its own lens, so glass would stop reading as glass, and Stone's crisp window light and Paper's ink-wash ridge, which are what those worlds are, would be gone.

**Chosen: render each world again, wide, from the same script.** `scripts/render-art.py` already draws every backdrop procedurally (Stone's gravel photograph is used for its scenes, not its room). Add a wide target per look:

- `<look>-bg-wide.jpg`, 2880 x 1800 (16:10, twice a 1440 x 900 window), composed for landscape: Lavender with azure on the left and the rose pool right of centre; Stone with the window top left and diagonal beams crossing to the lower right, the floor bounce along the bottom; Paper with the dawn glow top right, the sage bounce bottom left and the mist band across the upper third; Pine with the moon glow top right and the aurora band low across, the pines kept to the canopy slab so none stand behind panels.
- `<look>-bg-wide-blur.jpg`, the lens, 1920 x 1200 with sigma 24: 1.33 px per dp, the same blur in dp as the phone's lens (540 px for 400 dp).
- A `wide` block per look in `assets/art/looks.json`: its frame (1440 x 900 dp), its scrim and veil, and its light layers with boxes measured in frame **heights** (so a light keeps its size as the window widens), anchors and motion amplitudes for the landscape frame. The light clock and the periods do not change.
- Header art: no separate wide pictures were needed. Paper's mountains use the phone's header art, anchored top right and masked to fade above the header's foot; Pine's slab is drawn (its gradient, rim, moon glow) with the phone's pines art at the bottom right. Glass does not show the mountains through it: the lens is the world's.
- Other window shapes cover-crop the 16:10 master with an anchor per look, chosen so the world's signature stays in frame: Lavender centre, Stone top left (the window), Paper top right (the sun), Pine top right (the moon).

`Ambience`, `GlassLens` and the light field pick the wide set whenever the shell is wide; the phone keeps its portrait set, untouched. Each wide master is about 0.6 MB and its lens about 0.15 MB.

---

## 12. New tokens and contrast checks

Everything below exists in all four looks or not at all; no screen file holds a literal.

**Colour and material** (`src/theme.ts`):

- `material.hover: { fill, rim }`: the desktop hover light, quieter than the press light (start from the press fill at half its alpha and tune per look). Fades in 120 ms, out 160 ms.
- `scrollThumb`: the thin web scrollbar's thumb on each look's glass and world.
- No new colour for the now line, the date disc or chart marks: `accent`, `node` / `onNode` and the kinds already cover them, and the gate checks them where they now sit.

**Type** (`makeType`): `pageTitle` (the look's title face, 38/44 and 34/40, the look's title tracking), `heroTitle` (display face 32/38 for the Overview hero), `figure` (body medium 16 in `text`, tabular, for the facts inside subtitles), `kbd` (13 in the label face on an inset pill; never mono). Everything else uses the existing roles. Reading text stays 16; nothing goes below 12.

**Layout constants** (one shared object, not per look): rail 72, sidebar 264, shell inset 16 / 12, top bar band 64 with 40 dp controls, page padding 32 / 24, gutter 20 / 16, panel padding 20 / 16, content cap 1440, desktop control height 40, chip and segment 36, coarse-pointer target 44, rows 44 and 56.

**Art**: the wide masters, lenses, light layouts and header art in section 11.

**`scripts/check-contrast.py`, a desktop frame** (it must stay all-pass, and the phone checks stay as they are). Rebuild the 1440 x 900 frame from the wide lens and backdrop at 1.33 px per dp, and the 1280 x 800 and 1024 x 768 crops of it, then check:

- Text on pane, hero, inset, control and receded glass at every pixel of the wide lens, as the phone gate does for its frame (panels can sit anywhere across the width now).
- The sidebar as chrome: the lens under the sidebar's area plus `chromeTint` (and, for the compact overlay, a pane passing under it at its worst), against `text`, `muted`, `label`, every kind's text, the count pill's text on inset, and the drop's ink on the drop. The phone's tab bar labels can take the same check, which the gate does not have yet.
- Bare-world zones: breadcrumbs, the page title and subtitle (x from the content's left edge to the window's right, y 16 to 200 dp), under the moving light at its brightest point on its path, the same way as the phone's title zone; on Pine, on the wide slab instead.
- Sheet glass over the dim (palette, side panels) and over the bare world (popovers, tooltips): `text`, `muted`, `label`.
- Text over the hover light on pane and chrome, still 4.5:1.
- The `kbd` hint on inset inside control glass.
- Marks at 3:1: the now line (`accent`) on pane and on the inset blocks, chart bars and heatmap cells on `track`, the day line's nodes on the hero, the rail's count dots on chrome.
- The focus ring's dark halo at 3:1 against Paper's light world and the white ring against the three darker worlds.

---

## 13. Keyboard, focus, pointer and motion

**Focus.** Never removed. The global web rule in `_layout.tsx` draws the ring for `button`, `checkbox`, `tab`, `link`, `input` and `textarea`; the shell adds `menuitem`, `menuitemradio`, `option`, `switch`, `radio` and `combobox` to it, and every new pressable carries one of those roles. Hover styles are always also focus styles; nothing appears on hover alone.

**Order.** A "Skip to content" link first, then the sidebar (brand, collapse, items, Needs you, progress, user), the top bar (breadcrumbs, search, look, bell, New), the page header's actions, then the panels in reading order (row by row, left to right). Landmarks: the sidebar is `nav` "Sections", the top bar is `banner`, the page is `main` with the title as its `h1`, panel titles are `h2`, Needs you is `complementary`. The sidebar's current item has `aria-current="page"`. Up and Down also move between sidebar items.

**Shortcuts** (Cmd instead of Ctrl in a Mac browser). No single-letter shortcut acts unless the focus is inside the thing it belongs to (a menu, the review card), so nothing fires while typing (WCAG 2.1.4).

| Keys                         | Does                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| Ctrl+K                       | Search or jump to (the palette)                                            |
| Ctrl+N                       | The New menu (then R, T, G or W)                                           |
| Ctrl+B                       | Collapse or expand the sidebar                                             |
| Ctrl+1 to Ctrl+9             | Overview, Today, Calendar, Inbox, Gym, Language, Groceries, Library, Music |
| Ctrl+,                       | Settings                                                                   |
| Alt+Left, Alt+Right          | Back, forward                                                              |
| Ctrl+[ , Ctrl+]              | Previous, next day (Today) or week (Calendar)                              |
| Space or Enter, then 1, 2, 3 | Turn the card, then Again, Good, Easy (review card focused)                |
| Esc                          | Close the palette, a menu, a popover or the side panel                     |

**Pointer.** Desktop targets are 40 dp (chips and segments 36) with hover and focus states and the pointer cursor; under `(pointer: coarse)` everything goes back to 44 with 8 dp between targets. Rows keep their visible "more" button; right-click menus can come later and never hold the only way to do something. Text in content can be selected; button labels cannot.

**Motion.** The phone's grammar unchanged: one ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`); press 120 in and 160 out; selection and crossfades 150; hover 120 and 160; page content 180 ms crossfade with the 10 dp rise and 40 ms stagger; sidebar 260 ms; popovers 160 and 120; palette 180; side panels 320 in and 220 out; bars 600 ms. Reduced motion drops travel and keeps fades; nothing ever changes in 0 ms.

---

## 14. Platform notes that shape the design

- **One shell switch.** `src/app/_layout.tsx` draws the desktop shell when wide and the current `Tabs` when not. New routes (`overview`, `calendar`, `groceries`, `music`, `settings`, `stats`) are registered with `href: null`, and `GlassTabBar` draws only the five phone tabs (it sizes its slots from `state.routes.length`, so it must filter to them, or the phone bar would grow). On the phone a link to a desktop-only route lands on its phone equivalent: Overview and Calendar on Today, Groceries on the Library's groceries shelf, Music on Now Playing, Settings and Your week on their sheets.
- **Shared logic.** Today's sums live inline in `src/app/index.tsx`. Overview, Today, the sidebar counts and the bell need the same numbers, so they move into a hook (`useDay(date)`) and pure functions (`needsYou`, `dueNow`, `navCounts`, `weekSeries`) in `src/lib`, each with tests in `tests/`, without changing a pixel of the phone (section 15).
- **Electron.** The window opens at 1440 x 900, minimum 1024 x 680, with a background of the last look's world colour so it never flashes white. The export is served from a fixed custom origin (for example `app://symphony`) with every unknown path falling back to `index.html`. On the web, AsyncStorage is `localStorage`, which belongs to the origin, and Electron keeps it under the app's user data folder: so the origin and the user data folder (pinned with `app.setPath('userData', ...)` to a fixed folder name) must never change, or a later rename would leave the person's data behind. Context isolation on, Node off in the page; playlist links open in the default browser. The native Windows title bar stays for the first build; a frameless title bar (with the top bar as its drag region, clear of the window buttons) can come later.
- **What the desktop cannot do yet, said plainly on screen.** Phone calendar events (Android only), system reminders (the bell only, while the app is open), keeping imported songs past this visit, haptics, and sync between the phone and the computer (Backup and restore moves everything across).

---

## 15. The phone stays exactly as it is

- No change to any phone screen, sheet, component output, token value used by the phone, art used by the phone, or saved key or shape (`routine.*.v1`, the backup id `routine`, the package `com.reikenz7.routine`). The one new key is `routine.desktop.v1`.
- Desktop code is reached only through the shell switch. Shared components grow desktop variants through props or the shell context, never through a changed default.
- Proof, on every desktop step: build the web export, run `/tmp/sym/tools/all-still.js` into a new folder and `python3 -I /tmp/sym/tools/diff.py /tmp/sym/baseline-still <new> <heatmaps>`: all 52 frames at or under 0.01%. Also run `/tmp/rt/all.js` and compare its contact sheets with `/tmp/sym/baseline/sheets` by eye (live light and clock differ there by design).
- Checks stay green: `npx tsc --noEmit`, the unit tests, `python3 -B scripts/check-contrast.py` (phone checks plus the new desktop frame).

---

## 16. Suggested order of work

1. The wide worlds: render the four landscape masters, lenses, light layouts and header art; add the desktop frame to the contrast gate; all pass.
2. The shell switch, the hidden routes, the tab bar filter, `useDay` and the new pure functions with tests; the phone diff is zero.
3. The sidebar, the top bar, the palette, popovers, the side-panel presentation of `Sheet`, the hover tokens.
4. Overview.
5. Today and Calendar.
6. Inbox, Gym, Language, Library, Groceries, Music, Settings, Your week.
7. Captures at 1440 x 900, 1280 x 800 and 1024 x 768 in all four looks (seeded as `/tmp/rt/all.js` seeds), set side by side with the reference frames; the gate; the phone diff; then the Windows installer.
