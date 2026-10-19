# 3. Power BI team dashboard (admins)

This report recreates the portal's admin dashboard and capacity heatmap. Employees don't need it, because they see their own figures in the Power App. That also means only admins need a Power BI Pro licence.

> **You need Power BI Desktop, which is Windows only** (PwC laptop, VM or Azure Virtual Desktop).

## 3.1 Connect to the Team's data

1. Find the Team's environment URL: in Teams, go to **Power Apps → Build → [your Team] → About** (or **Session details**). It looks like `https://orgxxxxxxxx.crm4.dynamics.com`.
2. In Power BI Desktop, choose **Get data → Dataverse**, enter that URL, and sign in with your PwC account. You must be a Team **owner**, so the report sees every row.
3. Select these tables: **Project, Assignment, Person, Client, Line of service, Territory, Capability, Risk, Status update**.
4. Click **Transform data**. In each table, keep the columns you need and rename them:
   - IDs: the table's own id → `ProjectId`, `AssignmentId`, `PersonId`, and so on.
   - Lookups arrive as `_xxx_project_value` → `ProjectId`, and the same pattern for `PersonId`, `ClientId`, `CapabilityId`, `TerritoryId`, `LineOfServiceId`.
   - Choices arrive as a number plus a *…name* column. Keep the name column and call it `Status`, `RAG`, `Severity`, `Risk status`.
   - Remove the prefix from the rest (for example `cr8a1_startdate` → `Start date`).

## 3.2 Model

**Relationships** (all single-direction, one → many):

```
Person ──< Assignment >── Project >── Client
   │                        │──── Line of service, Territory
   └──────< AssignmentDay >─┘
Date ──< AssignmentDay
Project ──< Risk,  Project ──< Status update
```

**Date table** (Modeling → New table), then **Mark as date table**:

```dax
Date =
VAR FirstDay = DATE ( 2024, 7, 1 )
VAR LastDay  = DATE ( 2028, 6, 30 )
RETURN
    ADDCOLUMNS (
        CALENDAR ( FirstDay, LastDay ),
        "IsWorkday", WEEKDAY ( [Date], 2 ) <= 5,
        "MonthStart", DATE ( YEAR ( [Date] ), MONTH ( [Date] ), 1 ),
        "Month", FORMAT ( [Date], "mmm yyyy" ),
        "FiscalYear", "FY" & RIGHT ( YEAR ( [Date] ) + IF ( MONTH ( [Date] ) >= 7, 1, 0 ), 2 ),
        "FiscalMonthNo", MOD ( MONTH ( [Date] ) - 7, 12 ) + 1     // Jul = 1 … Jun = 12
    )
```

Sort `Date[Month]` by `Date[MonthStart]`.

**Calculated columns on Assignment:**

```dax
EffectiveEnd =
COALESCE ( Assignment[End date], RELATED ( Project[End date] ), DATE ( 2099, 12, 31 ) )

Tentative = RELATED ( Project[Status] ) = "Pipeline"

// A closed project with no end date must not book anyone forever.
Bookable =
NOT (
    RELATED ( Project[Status] ) = "Closed"
        && ISBLANK ( Assignment[End date] )
        && ISBLANK ( RELATED ( Project[End date] ) )
)
```

**AssignmentDay** (calculated table): one row per assignment per working day. This is what makes the utilization figures match the portal exactly.

```dax
AssignmentDay =
GENERATE (
    SELECTCOLUMNS (
        FILTER ( Assignment, Assignment[Bookable] ),
        "AssignmentId", Assignment[AssignmentId],
        "PersonId",     Assignment[PersonId],
        "ProjectId",    Assignment[ProjectId],
        "Allocation",   Assignment[Allocation],
        "Tentative",    Assignment[Tentative],
        "From",         Assignment[Start date],
        "To",           Assignment[EffectiveEnd]
    ),
    FILTER (
        SELECTCOLUMNS ( 'Date', "Day", 'Date'[Date], "Workday", 'Date'[IsWorkday] ),
        [Workday] && [Day] >= [From] && [Day] <= [To]
    )
)
```

Then relate `AssignmentDay[Day]` → `Date[Date]`, `AssignmentDay[PersonId]` → `Person[PersonId]`, and `AssignmentDay[ProjectId]` → `Project[ProjectId]`.

## 3.3 Measures

Create a measures table (Enter data → one empty table called `_Measures`) and add:

```dax
Working days =
CALCULATE ( COUNTROWS ( 'Date' ), 'Date'[IsWorkday] )

// One person's confirmed allocation over the period, weighted by working days.
Booked % =
DIVIDE (
    CALCULATE ( SUM ( AssignmentDay[Allocation] ), AssignmentDay[Tentative] = FALSE () ),
    [Working days]
) / 100

Pipeline % =
DIVIDE (
    CALCULATE ( SUM ( AssignmentDay[Allocation] ), AssignmentDay[Tentative] = TRUE () ),
    [Working days]
) / 100

// Average across active people; people with nothing booked count as 0%.
Utilization % =
AVERAGEX (
    FILTER ( VALUES ( Person[PersonId] ), CALCULATE ( MAX ( Person[Active] ) ) = TRUE () ),
    COALESCE ( [Booked %], 0 )
)

Last workday =
MAXX ( FILTER ( ALL ( 'Date' ), 'Date'[Date] <= TODAY () && 'Date'[IsWorkday] ), 'Date'[Date] )

Utilization today =
VAR d = [Last workday]
RETURN CALCULATE ( [Utilization %], REMOVEFILTERS ( 'Date' ), 'Date'[Date] = d )

On bench today =
VAR d = [Last workday]
RETURN
    COUNTROWS (
        FILTER (
            FILTER ( VALUES ( Person[PersonId] ), CALCULATE ( MAX ( Person[Active] ) ) = TRUE () ),
            COALESCE ( CALCULATE ( [Booked %], REMOVEFILTERS ( 'Date' ), 'Date'[Date] = d ), 0 ) = 0
        )
    )

Over-allocated today =
VAR d = [Last workday]
RETURN
    COUNTROWS (
        FILTER (
            VALUES ( Person[PersonId] ),
            CALCULATE ( [Booked %], REMOVEFILTERS ( 'Date' ), 'Date'[Date] = d ) > 1
        )
    )

Active projects =
CALCULATE ( COUNTROWS ( Project ), Project[Status] IN { "Active", "On hold" } )

High & critical risks =
CALCULATE (
    COUNTROWS ( Risk ),
    Risk[Severity] IN { "High", "Critical" },
    Risk[Risk status] <> "Closed"
)

Utilization band =
VAR p = [Booked %]
RETURN
    SWITCH ( TRUE (),
        ISBLANK ( p ) || p <= 0, "Bench",
        p < 0.7, "Under-utilized",
        p < 1, "Healthy",
        p = 1, "Full",
        "Over-allocated"
    )
```

Format the `%` measures as **Percentage, 0 decimals**.

## 3.4 Report pages

Use a white canvas, page background `#F3F3F3`, accent `#D04A02`, and text `#252525` / `#474747`. Turn off chart borders and keep gridlines light.

**1. Overview**
- **Cards:** Utilization today · Active projects · On bench today · High & critical risks.
- **Monthly team utilization:** a stacked column chart with axis `Date[Month]` (filter `Date[FiscalYear]` = current FY), values *Utilization %* (orange) and *Pipeline %* (light orange hatch). Add a constant line at 100%.
- **Needs attention:** a table of Project Name, Client, Status and RAG, filtered to RAG ∈ {Amber, Red} and Status ≠ Closed.
- **Rolling off in the next 30 days:** a table of Person, Project and `Assignment[EffectiveEnd]`, with a filter on EffectiveEnd of **in the next 30 days**.

**2. Capacity (the heatmap)**
- **Matrix:** rows `Person[Name]`, columns `Date[Month]`, values **Booked %**.
- **Slicer** `Date[FiscalYear]` (single select, default the current FY), plus slicers for Territory and Primary capability.
- **Cell colours:** Conditional formatting → Background colour → Rules on *Booked %*: `= 0` → `#E8E8E8`, `< 0.7` → `#FBD5C2`, `< 1` → `#F39B6D`, `= 1` → `#D04A02`, `> 1` → `#8A2A00`. Set the font colour to white for ≥ 1 and keep **values shown**, so colour is never the only signal.

**3. Projects:** a table of every project with its team (Person names concatenated) and allocation, with slicers for status, RAG, territory and line of service.

**4. Risks:** the open risks across projects, highest severity first.

## 3.5 Publish and add to Teams

1. **Publish** to a workspace only admins can access, for example "Tech Catalyst – Utilization".
2. In the semantic model's settings, set **scheduled refresh** (for example every 2 hours in working hours) with the credentials of a Team owner.
3. In the Team, click **+ (Add a tab) → Power BI**, pick the report, and name the tab **Team dashboard**. Members who open it without access see a "no access" message. That's expected, because their stats are in the Power App.

## 3.6 Optional: employees in Power BI too

If you later want employees to see their own figures in Power BI as well, add a role under **Modeling → Manage roles**:

- **Role** "Employee", table **Person**, filter `[Email] = USERPRINCIPALNAME()`

Because Person filters AssignmentDay, each employee sees only their own utilization. Assign the role in the service under semantic model → Security. They'd each need Power BI Pro, which is included in E5.
