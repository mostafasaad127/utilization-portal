# 2. The Power App ("Utilization")

A canvas app in Teams, built with the tables from [01-data-model.md](01-data-model.md). Formulas are Power Fx; paste them into the property named in each step.

## 2.0 Names used in the formulas

Power Apps refers to tables by their **plural** display name. These are the names used below. Open the **Data** pane (cylinder icon) and check yours; if any differ, use Find & replace (Ctrl+H) in the app.

`Territories` · `Capabilities` · `Industries` · `'Lines of service'` · `Clients` · `People` · `Projects` · `Assignments` · `Risks` · `'Status updates'` · `'Portal admins'` · `Users` (built in)

**Choice values:** type the start of the choice name and pick IntelliSense's suggestion. For example, the Project **Status** choice usually appears as `'Status (Projects)'.Active`. Where these docs write `'Status (Projects)'.Active`, use whatever IntelliSense offers.

**Add the data sources:** Data pane → Add data → tick every table above, plus **Users**.

**Settings:** File → Settings → General → *Data row limit* = **2000**. The tables are small, so this keeps every filter accurate.

## 2.1 Theme (Appkit 4)

**App → OnStart:**

```powerfx
// ── Appkit 4 theme (follows the Teams light/dark theme) ─────────
Set(gDark, Param("theme") = "dark");
Set(gPrimary,     ColorValue("#D04A02"));                                        // PwC orange
Set(gPrimaryTint, If(gDark, ColorValue("#3A2216"), ColorValue("#FDEEE7")));
Set(gPage,        If(gDark, ColorValue("#191919"), ColorValue("#F3F3F3")));       // page background
Set(gCard,        If(gDark, ColorValue("#252525"), Color.White));                 // panels
Set(gHeading,     If(gDark, Color.White,           ColorValue("#252525")));
Set(gBody,        If(gDark, ColorValue("#D1D1D1"), ColorValue("#474747")));
Set(gMuted,       If(gDark, ColorValue("#979797"), ColorValue("#696969")));
Set(gLine,        If(gDark, ColorValue("#3B3B3B"), ColorValue("#E8E8E8")));
Set(gGreen, ColorValue("#21812D")); Set(gAmber, ColorValue("#FFBF1F")); Set(gRed, ColorValue("#C52A1A"));
Set(gFont, "'Helvetica Neue', Arial");

// ── Who is signed in ────────────────────────────────────────────
// Dataverse text comparisons ignore case, so these are delegable.
Set(gIsAdmin, !IsBlank(LookUp('Portal admins', Email = User().Email)));
Set(gMe, LookUp(People, Email = User().Email));
// First visit: create the employee's own resource record (they own it, so they can edit it).
If(IsBlank(gMe),
    Set(gMe, Patch(People, Defaults(People), {Name: User().FullName, Email: User().Email, Active: true}))
);

// ── Fiscal year: 1 July – 30 June, named after the year it ends ──
Set(gFYStart, If(Month(Today()) >= 7, Date(Year(Today()), 7, 1), Date(Year(Today()) - 1, 7, 1)));
Set(gFYLabel, "FY" & Right(Text(Year(gFYStart) + 1), 2));

// ── My assignments, with the project fields the screens need ────
Concurrent(
    ClearCollect(colMine,
        AddColumns(
            Filter(Assignments, Person.Person = gMe.Person),
            ProjName, Project.Name,
            ProjStatus, Text(Project.Status),
            ProjRAG, Text(Project.RAG),
            EffEnd, Coalesce('End date', Project.'End date', Date(2099, 12, 31)),
            Tentative, Text(Project.Status) = "Pipeline",
            // A closed project with no end date must not book anyone forever.
            Bookable, !(Text(Project.Status) = "Closed" && IsBlank('End date') && IsBlank(Project.'End date'))
        )
    ),
    ClearCollect(colCapabilities, Capabilities)
)
```

Then paste the **icon pack** from [ui/icons.md](ui/icons.md) at the end of OnStart.

Create a reusable **Refresh mine** pattern. Whenever an assignment changes, run the `ClearCollect(colMine, …)` block again. The simplest way is to copy it into a hidden button `btnRefreshMine` and call `Select(btnRefreshMine)` after each save.

> **Look and feel:** [02b-ui-design.md](02b-ui-design.md) has the full UI spec: page skeleton, components, control recipes, the SVG heat strip, and reference screenshots for every screen. Follow it while building the screens below. The notes here are the minimum.

**Layout used on every screen:**
- **Fill:** `gPage`
- **Header** (Rectangle, Height 64, Fill White, bottom border `gLine`). Upload the PwC logo image on the left, then a 1 px divider, then a label "Utilization Portal" (Size 16, Color `gHeading`, Font `gFont`).
- **Left navigation:** a vertical gallery of buttons. Items:

```powerfx
Table(
    {Label: If(gIsAdmin, "Dashboard", "My dashboard"), Screen: scrHome},
    {Label: If(gIsAdmin, "Projects", "My projects"), Screen: scrProjects},
    {Label: "Join a project", Screen: scrJoin, EmployeeOnly: true},
    {Label: "My profile", Screen: scrProfile, EmployeeOnly: true},
    {Label: "People", Screen: scrPeople, AdminOnly: true},
    {Label: "Migration", Screen: scrMigration, AdminOnly: true}
)
```

  Wrap it as `Filter(<that table>, If(gIsAdmin, !EmployeeOnly, !AdminOnly))`. Each button's **OnSelect** is `Navigate(ThisItem.Screen)`; its **Fill** is `If(App.ActiveScreen = ThisItem.Screen, gPrimaryTint, Color.Transparent)` and its **Color** is `If(App.ActiveScreen = ThisItem.Screen, gPrimary, gBody)`.
- **Panels:** white rectangles with **RadiusTopLeft/Right/BottomLeft/Right = 8** and a light drop shadow (DropShadow.Light).
- **Primary buttons:** Fill `gPrimary`, Color White, BorderRadius 4. **Secondary buttons:** Fill White, Color `gPrimary`, BorderColor `gPrimary`.

## 2.2 Screen: Home (`scrHome`)

**Employees** see their own figures. **Admins** see quick links, and their team-wide numbers live in the Power BI tab.

**Stat tiles** (labels inside panels):

| Tile | Text |
|---|---|
| Your utilization today | `Sum(Filter(colMine, Bookable && !Tentative && 'Start date' <= Today() && EffEnd >= Today()), Allocation) & "%"` |
| `gFYLabel & " average"` | `Text(Round(Average(galMonths.AllItems, Pct), 0)) & "%"` |
| Current projects | `CountRows(Distinct(Filter(colMine, 'Start date' <= Today() && EffEnd >= Today()), ProjName))` |
| Next roll-off | `With({d: Min(Filter(colMine, !Tentative && 'Start date' <= Today() && EffEnd >= Today() && EffEnd < Date(2099,1,1)), EffEnd)}, If(IsBlank(d), "—", Text(d, "dd mmm yyyy")))` |

**Bench banner:** a rectangle plus label, **Visible** `!gIsAdmin && Sum(Filter(colMine, Bookable && !Tentative && 'Start date' <= Today() && EffEnd >= Today()), Allocation) = 0`. The text reads: *"You're not booked on any project today. If you're working on something, log it or join it."*

**Month-by-month strip** (`galMonths`, a horizontal gallery with 12 items):

```powerfx
ForAll(Sequence(12, 0) As m,
    With({ms: DateAdd(gFYStart, m.Value, TimeUnit.Months)},
    With({me: DateAdd(DateAdd(ms, 1, TimeUnit.Months), -1, TimeUnit.Days)},
    With({wd: CountRows(Filter(Sequence(DateDiff(ms, me, TimeUnit.Days) + 1, 0) As d,
                               Weekday(DateAdd(ms, d.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5))},
    {
        MonthStart: ms,
        // Allocation weighted by working days, exactly like the portal:
        // a 100% assignment covering half the month counts as 50%.
        Pct: Round(Sum(
            ForAll(Filter(colMine, Bookable && !Tentative && 'Start date' <= me && EffEnd >= ms) As a,
                With({s: If(a.'Start date' > ms, a.'Start date', ms), e: If(a.EffEnd < me, a.EffEnd, me)},
                    a.Allocation *
                    CountRows(Filter(Sequence(DateDiff(s, e, TimeUnit.Days) + 1, 0) As d2,
                                     Weekday(DateAdd(s, d2.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5)) / wd
                )
            ),
            Value), 0)
    }))))
```

Inside the gallery:
- **Month label:** `Text(ThisItem.MonthStart, "mmm")`, Color `If(Month(ThisItem.MonthStart) = Month(Today()), gPrimary, gMuted)`
- **Cell** (rectangle, height 36, radius 2), Fill:

```powerfx
Switch(true,
    ThisItem.Pct <= 0,  ColorValue("#E8E8E8"),   // bench
    ThisItem.Pct < 70,  ColorValue("#FBD5C2"),   // under-utilized
    ThisItem.Pct < 100, ColorValue("#F39B6D"),   // healthy
    ThisItem.Pct = 100, ColorValue("#D04A02"),   // full
                        ColorValue("#8A2A00"))   // over-allocated
```

- **Value on the cell:** `ThisItem.Pct & "%"`, Color `If(ThisItem.Pct >= 100, Color.White, gHeading)`. The number is always printed, so colour is never the only signal.

**Waiting for your update** (gallery). Items:

```powerfx
Filter(Projects,
    // projects I'm currently on…
    !IsBlank(LookUp(colMine, Project.Project = ThisRecord.Project && 'Start date' <= Today() && EffEnd >= Today())),
    // …that are running…
    Status = 'Status (Projects)'.Active || Status = 'Status (Projects)'.'On hold',
    // …with no update in the last two weeks
    IsBlank('Last update on') || 'Last update on' < DateAdd(Today(), -14, TimeUnit.Days)
)
```

Each row shows `ThisItem.Name`, and a **Post update** button: `Set(varProject, ThisItem); Set(varTab, "Updates"); Navigate(scrProject)`.

**Buttons:** *Log a project* → `Set(varProject, Blank()); Navigate(scrLogProject)`; *Join a project* → `Navigate(scrJoin)`.

## 2.3 Screen: Projects (`scrProjects`)

Gallery `galProjects`. Items:

```powerfx
Sort(
    Filter(Projects,
        // admins: everything; employees: only projects they're on
        gIsAdmin || !IsBlank(LookUp(colMine, Project.Project = ThisRecord.Project)),
        IsBlank(txtSearch.Text) || txtSearch.Text in Name || txtSearch.Text in Client.Name,
        ddStatus.Selected.Value = "All" || Text(Status) = ddStatus.Selected.Value
    ),
    'Start date', SortOrder.Descending
)
```

`ddStatus` Items: `["All", "Pipeline", "Active", "On hold", "Closed"]`.

**Row template:**
- Project name (bold) with `ThisItem.Client.Name`
- `Text(ThisItem.'Start date', "dd mmm yyyy") & " – " & If(IsBlank(ThisItem.'End date'), "TBD", Text(ThisItem.'End date', "dd mmm yyyy"))`
- A Status pill: `Text(ThisItem.Status)`
- A RAG dot: Fill `Switch(Text(ThisItem.RAG), "Green", gGreen, "Amber", gAmber, gRed)` plus the RAG word, so colour is never the only signal
- For employees, **your allocation**: `Sum(Filter(colMine, Project.Project = ThisItem.Project), Allocation) & "%"`

**OnSelect:** `Set(varProject, ThisItem); Set(varTab, "Overview"); Navigate(scrProject)`

## 2.4 Screen: Project (`scrProject`)

**Tabs:** buttons that set `varTab`. Each section's **Visible** is `varTab = "<name>"`.

```powerfx
// Tab buttons' Items (horizontal gallery)
Filter(
    Table({T: "Overview"}, {T: "My assignment"}, {T: "Team"}, {T: "Risks"}, {T: "Updates"}),
    T <> "Team" || gIsAdmin,               // employees can't see teammates' allocation
    T <> "My assignment" || !gIsAdmin
)
```

**Overview:** a **Display form** bound to `Projects`, Item `varProject`, showing Client, Industry, Territory, Line of service, Start date, End date, Multi-tower, Engagement leads and Scope.

An **Edit project** button:
- **Visible:** `gIsAdmin || varProject.'Created By'.'Primary Email' = User().Email`. This matches the Collaborate permission: members edit projects they created.
- **OnSelect:** `Navigate(scrLogProject)`, with `varProject` set.

**My assignment** (employees): gallery `Filter(colMine, Project.Project = varProject.Project)` showing allocation, dates, capability and note, with an **Edit** button. Edit opens the same form as §2.6, in self-only mode. Employees always own their rows, so the edit is allowed.

**Team** (admins only): gallery `Filter(Assignments, Project.Project = varProject.Project)`, showing person, capability, allocation and dates. Add an **Add team member** button that opens §2.6.

**Risks:** gallery `Sort(Filter(Risks, Project.Project = varProject.Project), 'Created On', SortOrder.Descending)`.

To add or edit a risk, use an Edit form bound to `Risks`. Set the Project field's **Default** to `varProject` and hide that card. The **Delete** icon's Visible is `gIsAdmin || ThisItem.'Created By'.'Primary Email' = User().Email`.

**Updates:** a timeline gallery `Sort(Filter('Status updates', Project.Project = varProject.Project), 'Created On', SortOrder.Descending)`, showing `ThisItem.'Created By'.'Full Name'`, `Text(ThisItem.'Created On', "dd mmm yyyy")`, a RAG pill and `ThisItem.Update`.

The post box is a text input `txtUpdate` (multiline), a dropdown `ddUpdateRag` with Items `Choices('RAG (Status updates)')` and Default `varProject.RAG`, and a **Post update** button:

```powerfx
If(Len(Trim(txtUpdate.Text)) < 3,
    Notify("Write a short update first.", NotificationType.Warning),
    Patch('Status updates', Defaults('Status updates'), {
        Name: Left(Trim(txtUpdate.Text), 100),
        Project: varProject,
        RAG: ddUpdateRag.Selected.Value,
        Update: Trim(txtUpdate.Text)
    });
    // The "Status update → project" flow updates the project's RAG and Last update on.
    Reset(txtUpdate);
    Notify("Update posted.", NotificationType.Success)
)
```

## 2.5 Screen: Log a project (`scrLogProject`)

An **Edit form** `frmProject`, DataSource `Projects`, Item `varProject`, DefaultMode `If(IsBlank(varProject), FormMode.New, FormMode.Edit)`.

**Fields:** Name, Client, Industry, Territory, Line of service, Status, RAG, Start date, End date, Multi-tower, Engagement leads, Scope.

Filter the **Line of service** dropdown by territory. On that card's combo box, set Items:

`Filter('Lines of service', Territory.Territory = <TerritoryCardCombo>.Selected.Territory)`

**Your involvement** panel (employees, new projects only). Visible: `!gIsAdmin && frmProject.Mode = FormMode.New`.
- `cmbMyCap`: Items `colCapabilities`, DefaultSelectedItems `[gMe.'Primary capability']`
- `txtMyAlloc`: Format Number, Default `100`

**Save** button OnSelect:

```powerfx
With({
    nm: <NameCardInput>.Text,
    cl: <ClientCardCombo>.Selected,
    st: <StartCardDate>.SelectedDate,
    en: <EndCardDate>.SelectedDate,
    status: <StatusCardCombo>.Selected.Value
},
    Switch(true,
        !IsBlank(en) && en < st,
            Notify("End date must be on or after the start date.", NotificationType.Error),
        status = 'Status (Projects)'.Closed && IsBlank(en),
            Notify("A closed project needs an end date.", NotificationType.Error),
        frmProject.Mode = FormMode.New &&
        !IsBlank(LookUp(Projects, Name = nm && Client.Client = cl.Client && 'Start date' = st)),
            Notify("This project already exists. Use Join a project instead.", NotificationType.Warning),
        !gIsAdmin && frmProject.Mode = FormMode.New && (IsBlank(txtMyAlloc.Text) || Value(txtMyAlloc.Text) < 1 || Value(txtMyAlloc.Text) > 200),
            Notify("Enter your allocation (1–200%).", NotificationType.Error),
        SubmitForm(frmProject)
    )
)
```

**frmProject → OnSuccess:**

```powerfx
// Employees are added to the team of a project they log.
If(!gIsAdmin && frmProject.Mode = FormMode.New,
    Patch(Assignments, Defaults(Assignments), {
        Name: gMe.Name & " – " & frmProject.LastSubmit.Name,
        Project: frmProject.LastSubmit,
        Person: gMe,
        Capability: cmbMyCap.Selected,
        Allocation: Value(txtMyAlloc.Text),
        'Start date': frmProject.LastSubmit.'Start date',
        'End date': frmProject.LastSubmit.'End date'
    })
);
Select(btnRefreshMine);
Set(varProject, frmProject.LastSubmit);
Notify("Project saved.", NotificationType.Success);
Set(varTab, "Overview");
Navigate(scrProject)
```

**Adding a new client:** members have *Collaborate* on Clients, so add a small "+ New client" button that opens a text input. It runs `Patch(Clients, Defaults(Clients), {Name: txtNewClient.Text})`, then selects the new client in the combo.

## 2.6 Assignment form (shared by Join, My assignment and admin staffing)

Build this once as a pop-up group on `scrProject` and `scrJoin`, or as its own screen.

- **Admin mode** (`gIsAdmin`): a person picker `cmbPerson` with Items `Filter(People, Active)`
- **Self-only mode** (employees): no person picker; the person is always `gMe`
- `cmbCap` (Items `colCapabilities`), `txtAlloc` (Number, Default 100), `dpStart` and `dpEnd` (Defaults = the project's dates), `txtNote`

**Save** OnSelect:

```powerfx
With({
    who: If(gIsAdmin, cmbPerson.Selected, gMe),
    alloc: Value(txtAlloc.Text)
},
    Switch(true,
        IsBlank(who), Notify("Choose a person.", NotificationType.Error),
        IsBlank(alloc) || alloc < 1 || alloc > 200, Notify("Allocation must be 1–200%.", NotificationType.Error),
        !IsBlank(dpEnd.SelectedDate) && dpEnd.SelectedDate < dpStart.SelectedDate,
            Notify("End date must be on or after the start date.", NotificationType.Error),
        // Owner = the person, so they can see their own assignment (table permission: Private).
        With({u: LookUp(Users, 'Primary Email' = who.Email)},
            Patch(Assignments,
                If(IsBlank(varAssignment), Defaults(Assignments), varAssignment),
                {
                    Name: who.Name & " – " & varProject.Name,
                    Project: varProject,
                    Person: who,
                    Capability: cmbCap.Selected,
                    Allocation: alloc,
                    'Start date': dpStart.SelectedDate,
                    'End date': dpEnd.SelectedDate,
                    Note: txtNote.Text
                },
                If(gIsAdmin && !IsBlank(u), {Owner: u}, {})
            );
            Select(btnRefreshMine);
            Set(varShowAssignment, false);
            Notify("Saved.", NotificationType.Success)
        )
    )
)
```

> If an admin staffs someone who hasn't joined the Team yet, they won't be in `Users`, so the admin keeps ownership. Run the **Fix ownership** button on the Migration screen ([05-migration.md](05-migration.md)) once they've joined.

**Remove** (employees: their own rows only; admins: any row): `Remove(Assignments, ThisItem); Select(btnRefreshMine)`. Dataverse rejects it automatically for anyone without rights.

## 2.7 Screen: Join a project (`scrJoin`, employees)

Gallery Items: open projects the employee isn't on yet. Only names, clients and dates are shown, never who's on them.

```powerfx
Sort(
    Filter(Projects,
        Status <> 'Status (Projects)'.Closed,
        IsBlank(txtJoinSearch.Text) || txtJoinSearch.Text in Name || txtJoinSearch.Text in Client.Name,
        IsBlank(LookUp(colMine, Project.Project = ThisRecord.Project))
    ),
    'Start date', SortOrder.Descending
)
```

The **Join** button sets `varProject` to `ThisItem` and `varAssignment` to `Blank()`, prefills the dates, and opens the assignment form (§2.6) in self-only mode.

## 2.8 Screen: My profile (`scrProfile`, employees)

An Edit form bound to `People` with Item `gMe`, showing Primary capability, Grade and Territory. Name and Email are display-only. Members own their own Person row, so they can save it.

OnSuccess: `Set(gMe, frmProfile.LastSubmit); Notify("Profile saved.", NotificationType.Success)`.

## 2.9 Admin screens

Guard each admin screen. In **OnVisible**: `If(!gIsAdmin, Navigate(scrHome))`.

- **People (`scrPeople`):** a gallery of `People` with an Edit form for adding staff before they join, setting grade, capability and territory, and the Active flag.
- **Projects:** `scrProjects` already shows every project to admins; staffing happens on the project's **Team** tab.
- **Migration (`scrMigration`):** see [05-migration.md](05-migration.md).

## 2.10 Publish

1. Save, then **Publish to Teams** and add it as a tab, named **Utilization**, in the Team's General channel.
2. Test as a member. Add a colleague as a member, or use a second account, and check:
   - They see only their own assignments and figures.
   - They can't open People or Migration.
   - Logging a project adds them to its team.
3. Add the Power BI report as a second tab ([03-power-bi.md](03-power-bi.md)).
