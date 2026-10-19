# 2b. UI design: making the Power App look like the portal

Stock Power Apps looks like a form builder. This guide gets the Teams app to the same standard as the web portal: Appkit 4 colours and type, generous white space, crisp icons, real data visuals, and empty and loading states everywhere.

**Your target, screen by screen.** These are screenshots of the portal; build each Power Apps screen to match:

| Power Apps screen | Reference |
|---|---|
| Home (employee) | [ui-reference/01-employee-dashboard.jpg](ui-reference/01-employee-dashboard.jpg) |
| Projects | [ui-reference/02-my-projects.jpg](ui-reference/02-my-projects.jpg) |
| Join a project | [ui-reference/03-join-a-project.jpg](ui-reference/03-join-a-project.jpg) |
| Log a project | [ui-reference/04-log-a-project.jpg](ui-reference/04-log-a-project.jpg) |
| Project – Overview | [ui-reference/05-project-overview.jpg](ui-reference/05-project-overview.jpg) |
| Project – Updates | [ui-reference/06-project-updates.jpg](ui-reference/06-project-updates.jpg) |
| Team dashboard (Power BI) | [ui-reference/07-admin-dashboard.jpg](ui-reference/07-admin-dashboard.jpg) |
| Capacity heatmap (Power BI) | [ui-reference/08-admin-capacity-heatmap.jpg](ui-reference/08-admin-capacity-heatmap.jpg) |
| Project – Team (admin) | [ui-reference/09-admin-project-team.jpg](ui-reference/09-admin-project-team.jpg) |

You can also keep the live prototype open next to Power Apps Studio while you build.

---

## 1. App settings

**File → Settings → Display:**
- **Scale to fit:** Off
- **Lock aspect ratio:** Off
- **Orientation:** Landscape

These let the app stretch to fill the Teams tab, like a real web page. Design at **1366 × 768**, Teams' typical tab size, and lay everything out with **containers** (Insert → Layout) so it reflows at other sizes.

On every screen:
- **Fill:** `gPage`
- **LoadingSpinner:** `LoadingSpinner.Data`
- **LoadingSpinnerColor:** `gPrimary`

## 2. Design tokens

Use the theme variables from [02-power-apps.md §2.1](02-power-apps.md#21-theme-appkit-4). Never type a raw colour on a control; always use a variable. That keeps it consistent and makes dark mode a one-line change.

**Dark mode follows Teams.** The theme block in §2.1 reads `Param("theme")`, the theme Teams passes to the app, and switches every token. Because every control uses the variables, the whole app turns dark with nothing else to do.

**Type scale.** Power Apps sizes are in points; these match the portal's pixel sizes.

| Use | Size | FontWeight | Color |
|---|---|---|---|
| Page title | **21** | Semibold | `gHeading` |
| Panel title | **13.5** | Semibold | `gHeading` |
| Stat value | **24** | Semibold | `gHeading` |
| Body / table cells | **10.5** | Normal | `gBody` |
| Labels, captions, table headers | **9** | Normal (headers: Semibold) | `gMuted` |
| Buttons | **10.5** | Normal | per button type |

Set **Font** to `gFont` everywhere. Select all the controls on a screen and set it once.

**Spacing.** Stick to multiples of 4: gaps of **8, 12, 16 or 24**, panel padding of **20–24**, and page padding of **24 (top/bottom) × 32 (left/right)**.

**Shape.** Panels use radius **8** and `DropShadow.Light`. Inputs use radius **8**. Buttons and pills use radius **4**.

## 3. Page skeleton (every screen)

```
┌──────────────────────────── conHeader (H 64, white) ───────────────────────────┐
│ [pwc logo] │ Utilization Portal                 [search]   [FY27 current]  (RZ) │
├──────────┬─────────────────────────────────────────────────────────────────────┤
│ conNav   │ conPageHeader (white): breadcrumb · Title · description   [actions] │
│ W 248    ├─────────────────────────────────────────────────────────────────────┤
│ white    │ conContent (scrolls): tiles, panels, tables…                        │
│          │                                                                     │
└──────────┴─────────────────────────────────────────────────────────────────────┘
```

Build it from containers:

| Control | Type | Key properties |
|---|---|---|
| `conRoot` | Vertical container | X 0, Y 0, Width `Parent.Width`, Height `Parent.Height`, Gap 0, Fill `gPage` |
| `conHeader` | Horizontal container (in conRoot) | Height **64**, Fill `gCard`, PaddingLeft/Right **24**, LayoutAlignItems Center, Gap **16** |
| `rectHeaderLine` | Rectangle (in conRoot, below header) | Height **1**, Fill `gLine` |
| `conBody` | Horizontal container (in conRoot) | FillPortions 1, Gap 0 |
| `conNav` | Vertical container (in conBody) | Width **248**, Fill `gCard`, PaddingTop **12**, PaddingLeft/Right **12** |
| `rectNavLine` | Rectangle (in conBody) | Width **1**, Fill `gLine` |
| `conMain` | Vertical container (in conBody) | FillPortions 1, Gap 0 |
| `conPageHeader` | Vertical container (in conMain) | Fill `gCard`, PaddingTop **20**, PaddingBottom **20**, PaddingLeft/Right **32**, Gap **4**, AutoHeight on |
| `conContent` | Vertical container (in conMain) | FillPortions 1, **LayoutOverflowY: Scroll**, PaddingTop/Bottom **24**, PaddingLeft/Right **32**, Gap **24** |

Build the skeleton once on `scrHome`, then **copy and paste the screen** (⋯ → Duplicate screen) for every other screen and change only the content.

## 4. Components

Create these under **Tree view → Components → New component**. Each one is set up once and reused, which is what makes every screen look consistent.

### cmpIcon
- **Custom properties (Input):** `IconSvg` (Text), `IconColor` (Text, default `"#474747"`)
- **Content:** one Image with `ImagePosition.Fit`, Image set to:

```powerfx
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='" & cmpIcon.IconColor &
    "' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" & cmpIcon.IconSvg & "</svg>")
```

The icons themselves are in [ui/icons.md](ui/icons.md); paste them into OnStart.

### cmpStatTile (portal: the four tiles at the top of a dashboard)
- **Inputs:** `Label`, `Value`, `Unit` (Text), `Detail`, `IconSvg` (Text), `Attention` (Boolean)
- **Size:** 300 × 132. The root is a **Vertical container** with Fill `gCard`, all four radii **8**, DropShadow.Light, Padding **20**, Gap **8**.
- **Row 1** (horizontal container, space-between): a Label (`Label`, 10.5, `gMuted`) and a **cmpIcon** 20 × 20 (`IconColor`: `If(Attention, "#C52A1A", "#696969")`).
- **Row 2:** a Label for `Value` (24, Semibold, `gHeading`), with `Unit` beside it (12, `gMuted`).
- **Row 3:** a Label for `Detail` (9, `gMuted`, Wrap on).
- **Attention accent:** a Rectangle 3 px wide at the left edge, Fill `ColorValue("#C52A1A")`, Visible `Attention`.

### cmpPill (status, severity, role badges)
A **classic Button** with **DisplayMode `DisplayMode.View`**, Height **24**, Size **9**, FontWeight Semibold, all radii **4**, PaddingLeft/Right **8**, BorderThickness 0, and AutoWidth (Width = `Len(Self.Text) * 7 + 18`).
- **Input:** `Tone` (Text: success, warning, error, info, primary, neutral)
- **Fill:**

  ```powerfx
  Switch(cmpPill.Tone,
      "success", ColorValue("#E6F2E7"), "warning", ColorValue("#FFF5DC"), "error", ColorValue("#F9E6E4"),
      "info", ColorValue("#E7EAF2"), "primary", ColorValue("#FDEEE7"), ColorValue("#F3F3F3"))
  ```

- **Color:**

  ```powerfx
  Switch(cmpPill.Tone,
      "success", ColorValue("#21812D"), "warning", ColorValue("#8A5A00"), "error", ColorValue("#C52A1A"),
      "info", ColorValue("#415385"), "primary", ColorValue("#D04A02"), ColorValue("#474747"))
  ```

Tone mapping: Active → primary, Pipeline → info, On hold → warning, Closed → neutral.

### cmpRag (RAG with a dot *and* the word, never colour alone)
A horizontal container holding a **Circle** 8 × 8 and a cmpPill:
- **Circle Fill:** `Switch(cmpRag.Rag, "Green", gGreen, "Amber", gAmber, gRed)`
- **Pill Tone:** `Switch(cmpRag.Rag, "Green", "success", "Amber", "warning", "error")`
- **Pill Text:** `cmpRag.Rag`

### cmpEmptyState
A vertical container, centred, Padding **40**, Gap **8**:
- a 48 × 48 circle (Button in View mode, radius 24, Fill `gPage`) with a cmpIcon on top
- a Title label (12, Semibold, `gHeading`)
- a Description label (10, `gMuted`, centred)
- an optional action button

Use it in **every** gallery: Visible `CountRows(<gallery>.AllItems) = 0`, with text like "No projects here yet" plus a hint. Empty states are what make an app feel finished.

### cmpPanelHeader
A horizontal container with PaddingLeft/Right **24**, PaddingTop **20**, PaddingBottom **12**:
- a Title (13.5, Semibold, `gHeading`)
- an optional Description (9, `gMuted`)
- a right-aligned link button ("View all", tertiary style)

## 5. Control recipes

Set these once and copy the styled control around, using **Copy formatting / Paste formatting**.

**Primary button**
| Property | Value |
|---|---|
| Fill / Color | `gPrimary` / White |
| HoverFill | `ColorValue("#E45C2B")` |
| PressedFill | `ColorValue("#A43E03")` |
| Height / radii | 40 / 4 (all corners) |
| BorderThickness | 0 |
| FocusedBorderThickness / Color | 2 / `ColorValue("#1060CF")` |
| DisabledFill | `ColorValue("#F3C9B3")` |

**Secondary button:** Fill `gCard`, Color `gPrimary`, BorderColor `gPrimary`, BorderThickness 1, HoverFill `gPrimaryTint`.

**Tertiary/link button:** Fill Transparent, Color `gPrimary`, HoverFill `gPrimaryTint`, BorderThickness 0.

**Icon buttons:** put a cmpIcon inside a small classic Button. Set the button's Text to "", Fill Transparent and HoverFill `gPage`, and set the icon's OnSelect to `Select(Parent)` so clicks pass through.

**Text input (classic)**
| Property | Value |
|---|---|
| Height | 40 (multiline: 96) |
| Radii | 8 |
| BorderColor / HoverBorderColor | `ColorValue("#D1D1D1")` / `ColorValue("#8E95A2")` |
| FocusedBorderColor / Thickness | `gPrimary` / 2 |
| Fill / Color | `gCard` / `gHeading` |
| PaddingLeft | 12 |
| HintText colour | Muted, set in Placeholder or HintText |

**Combo box / dropdown:** the same border and radius values, plus ChevronBackground `gCard`, ChevronFill `gMuted`, SelectionFill `gPrimaryTint`, SelectionColor `gHeading` and HoverFill `gPage`.

**Field labels:** a label above each input (10, `gBody`), with a red asterisk Label (`ColorValue("#C52A1A")`) for required fields. Hints and errors go below the input (9; errors in `#C52A1A`).

**Edit forms:** Columns **2**, Layout Vertical. On each card's **DataCardKey**, set Size 10, Color `gBody` and FontWeight Normal. Apply the text input recipe to each **DataCardValue**. Hide the default error label, and show your own error under the field.

**Galleries (tables)**
- **Header row:** labels outside the gallery (9, Semibold, `gMuted`), with a 1 px `gLine` rectangle below.
- **Template:** TemplateSize **56**, TemplatePadding 0. Each row has a **full-row classic Button behind everything** (Text "", Fill Transparent, HoverFill `gPage`, BorderThickness 0) with OnSelect set to the row action. This gives you the portal's hover highlight.
- **Separator:** a 1 px `gLine` rectangle at the bottom of the template.
- **Text:** primary text 10.5 Semibold `gHeading`, secondary line 9 `gMuted`, numbers right-aligned.
- **ShowScrollbar:** false, because the page itself scrolls.

**Tabs (project page):** a horizontal gallery of labels. Selected tab: Color `gHeading`, FontWeight Semibold, with a 2 px `gPrimary` rectangle under it. Other tabs: Color `gMuted`. Count badges use a cmpPill with Tone "neutral".

**Dialogs (confirm delete, assignment form):** a full-screen Rectangle with Fill `RGBA(0,0,0,0.45)` (OnSelect closes the dialog), and a centred Vertical container on top: Width 560, Fill `gCard`, radii 8, DropShadow.ExtraBold, Padding 24, Gap 16. Put the title (15, Semibold) and close icon in the first row, and right-align the buttons in the last row.

**Busy states:** on save buttons, set `DisplayMode: If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)` and `Text: If(varBusy, "Saving…", "Save")`. Wrap each save in `Set(varBusy, true); …; Set(varBusy, false)`.

## 6. Signature visuals (SVG)

These turn the app from a form into a dashboard. Each is an **Image** control fed by an SVG string, so it renders crisply like the portal.

### 6.1 "Your FY by month" heat strip (Home)

In **scrHome.OnVisible**, build the months. This is the same maths as [02-power-apps.md §2.2](02-power-apps.md#22-screen-home-scrhome), with an index added:

```powerfx
ClearCollect(colMonths,
    ForAll(Sequence(12, 0) As m,
        With({ms: DateAdd(gFYStart, m.Value, TimeUnit.Months)},
        With({me: DateAdd(DateAdd(ms, 1, TimeUnit.Months), -1, TimeUnit.Days)},
        With({wd: CountRows(Filter(Sequence(DateDiff(ms, me, TimeUnit.Days) + 1, 0) As d,
                                   Weekday(DateAdd(ms, d.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5))},
        {
            Idx: m.Value,
            MonthStart: ms,
            Pct: Round(Sum(
                ForAll(Filter(colMine, Bookable && !Tentative && 'Start date' <= me && EffEnd >= ms) As a,
                    With({s: If(a.'Start date' > ms, a.'Start date', ms), e: If(a.EffEnd < me, a.EffEnd, me)},
                        a.Allocation * CountRows(Filter(Sequence(DateDiff(s, e, TimeUnit.Days) + 1, 0) As d2,
                            Weekday(DateAdd(s, d2.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5)) / wd)),
                Value), 0)
        }))))
)
```

Image control `imgHeat`: Width `Parent.Width - 48`, Height `Self.Width * 72 / 1200`, ImagePosition Fit. Set its **Image** to:

```powerfx
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 72' font-family='Helvetica Neue, Arial, sans-serif'>" &
    Concat(colMonths,
        With({
            x: Idx * 100,
            cur: Month(MonthStart) = Month(Today()) && Year(MonthStart) = Year(Today()),
            fill: Switch(true, Pct <= 0, "#E8E8E8", Pct < 70, "#FBD5C2", Pct < 100, "#F39B6D", Pct = 100, "#D04A02", "#8A2A00")
        },
            "<text x='" & (x + 49) & "' y='14' text-anchor='middle' font-size='12' fill='" & If(cur, "#D04A02", "#696969") & "'" &
                If(cur, " font-weight='700'", "") & ">" & Text(MonthStart, "mmm") & "</text>" &
            "<rect x='" & (x + 2) & "' y='22' width='94' height='44' rx='3' fill='" & fill & "'" &
                If(cur, " stroke='#D04A02' stroke-width='2'", "") & "/>" &
            "<text x='" & (x + 49) & "' y='49' text-anchor='middle' font-size='14' fill='" &
                If(Pct >= 100, "#FFFFFF", If(Pct <= 0, "#696969", "#252525")) & "'>" & Pct & "%</text>"
        )
    ) & "</svg>")
```

**Legend** (a small Image above it, on the right):

```powerfx
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 16' font-family='Helvetica Neue, Arial' font-size='11' fill='#696969'>" &
    Concat(
        Table(
            {c: "#E8E8E8", t: "On bench",       x: 0},
            {c: "#FBD5C2", t: "Under-utilized", x: 82},
            {c: "#F39B6D", t: "Healthy",        x: 192},
            {c: "#D04A02", t: "Fully booked",   x: 268},
            {c: "#8A2A00", t: "Over-allocated", x: 372}
        ),
        "<rect x='" & x & "' y='3' width='10' height='10' rx='2' fill='" & c & "'/>" &
        "<text x='" & (x + 14) & "' y='12'>" & t & "</text>"
    ) &
    "</svg>")
```

Image size: 480 × 16 (ImagePosition Fit).

### 6.2 Utilization meter (any list of people or allocations)

```powerfx
With({p: <your percentage>},
With({fill: Switch(true, p <= 0, "#E8E8E8", p < 70, "#FBD5C2", p < 100, "#F39B6D", p = 100, "#D04A02", "#8A2A00")},
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 6'>" &
    "<rect width='100' height='6' rx='3' fill='#F3F3F3'/>" &
    "<rect width='" & Min(p, 100) & "' height='6' rx='3' fill='" & fill & "'/></svg>")))
```

Use an Image of 96 × 6, with the percentage label next to it (10.5, `gHeading`; red when over 100).

### 6.3 Avatar with initials (header and team lists)

Use a classic Button in View mode, 36 × 36, all radii 18, Fill `gPrimary`, Color White, Size 10, Semibold. Set its Text to:

```powerfx
Upper(Left(First(Split(User().FullName, " ")).Value, 1) & Left(Last(Split(User().FullName, " ")).Value, 1))
```

### 6.4 Timeline (status updates)

In the updates gallery template, add a 2 px vertical `gLine` rectangle on the left running the full height, and a 10 × 10 `gPrimary` circle at the top of each item. That recreates the portal's timeline.

## 7. Small touches that impress

- **Personal greeting:** `If(Hour(Now()) < 12, "Good morning", Hour(Now()) < 18, "Good afternoon", "Good evening") & ", " & First(Split(User().FullName, " ")).Value`
- **Bench banner:** amber background `ColorValue("#FFF5DC")`, a 4 px `gAmber` bar on the left, and text in `ColorValue("#8A5A00")`.
- **First-run welcome:** if `IsBlank(gMe.'Primary capability')`, show a panel on Home: "Welcome! Set your capability and territory so we can pre-fill your projects", with a **Complete profile** button.
- **"Waiting for your update" panel:** give it a 3 px orange left accent and a bell icon, as in the portal.
- **Formatting:**
  - Dates: always `Text(d, "dd mmm yyyy")`.
  - Text: sentence case everywhere.
  - Numbers: tabular and right-aligned.
- **Feedback:** `Notify("…", NotificationType.Success)` after every save, and a confirmation dialog before every delete.
- **No clutter:** no default blue, no grey title bars, no visible scrollbars inside panels.

## 8. Accessibility (also part of looking professional)

- Every Image and icon gets an **AccessibleLabel** (for example "Utilization by month").
- Set **TabIndex** so keyboard order follows the layout, top to bottom and left to right.
- Colour is never the only signal: RAG always shows the word, and heat cells always show the %.
- Check the focus ring (FocusedBorderThickness 2) on every input and button.

## 9. Polish checklist before the pilot

- [ ] Every screen uses the skeleton and the same header and navigation
- [ ] No raw colours: everything uses `g…` variables, and dark mode works in Teams dark theme
- [ ] Fonts are consistent (`gFont`), and sizes follow the type scale
- [ ] Every gallery has an empty state
- [ ] Every save has a busy state and a success toast; every delete asks to confirm
- [ ] Tiles, pills, RAG and icons match the reference screenshots
- [ ] It looks right at 1366 × 768 and at full-screen Teams
