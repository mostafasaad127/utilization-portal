# Utilization Portal: Microsoft Teams edition

A build pack for recreating the Utilization Portal entirely on tools PwC already has in Microsoft 365. There's no custom hosting, no new licences for employees, and sign-in is your normal PwC account.

The web portal in `../pwc-utilization-portal` is the **working prototype**. Show it to stakeholders to agree what the Teams app should do, then build that here.

## What gets built

```
Microsoft Teams  (one Team = the portal; Team owners = admins, members = employees)
│
├── Power Apps tab ─ "Utilization"      employees: my dashboard, log / join a project,
│                                       my allocation, risks, status updates
│                                       admins: all projects, staffing, people, migration
│
├── Power BI tab ─ "Team dashboard"     admins: utilization, capacity heatmap, bench,
│                                       roll-offs, Amber/Red projects, risk register
│
├── Dataverse for Teams                 the database: projects, assignments, people, risks…
│
└── Power Automate                      weekly "update your project" nudges, roll-off alerts,
                                        status update → project RAG sync
```

| Portal feature | Teams edition |
|---|---|
| PwC sign-in, roles | Teams membership: **owners = Admin**, **members = Employee** |
| Employees see only their own figures | Dataverse table permission **Private** on Assignments: members only ever load their own rows |
| Log a project / join a project | Power Apps screens |
| Team dashboard, heatmap, bench, roll-offs | Power BI report pinned as a Teams tab (admins only) |
| Risks, status updates, RAG | Power Apps screens; a flow keeps project RAG in sync |
| Reminders | Power Automate posts in Teams chat |
| Spreadsheet import | One-off migration: `npm run dataverse:export` plus an admin Migration screen |
| Audit log | Built-in *Created by / Modified by / on* on every row (no full field history; see [limits](#known-limits)) |

## Build order

| Step | Guide | Who | Rough effort |
|---|---|---|---|
| 1 | Create the Team and the Dataverse tables | [01-data-model.md](01-data-model.md) | you | ½ day |
| 2 | Build the Power App (logic) to the UI spec (look and feel) | [02-power-apps.md](02-power-apps.md) · [02b-ui-design.md](02b-ui-design.md) | you | 3–4 days |
| 3 | Load your existing data | [05-migration.md](05-migration.md) | you | ½ day |
| 4 | Build the Power BI report | [03-power-bi.md](03-power-bi.md) | you, on a **Windows** PC | 1 day |
| 5 | Add the flows | [04-power-automate.md](04-power-automate.md) | you | ½ day |
| 6 | Pilot with 3–5 people, then roll out | — | team | 1–2 weeks |

[proposal.md](proposal.md) is a one-page summary for your manager or IT.

**UI target:** [ui-reference/](ui-reference/) holds screenshots of every portal screen to match, and [ui/icons.md](ui/icons.md) has the portal's icons ready to paste into Power Apps.

## Before you start

- **Power Apps in Teams:** you confirmed you can create apps.
- **Ownership:** you need to be an **owner** of the Team you build in. Create a new private Team, e.g. "Tech Catalyst – Utilization".
- **Power BI Desktop runs on Windows only.** Use your PwC laptop, a Windows VM, or Azure Virtual Desktop. Everything else works in Teams on a Mac.
- **Power BI licence:** viewing a shared report needs Power BI Pro, which is included in Microsoft 365 E5. Only **admins** need it, because employees get their own stats inside the Power App.

## Known limits

Be upfront about these when you pitch it. They're the trade-off for zero approvals.

- **Who can use it:** members of the Team only. Bringing people in means adding them to the Team.
- **Storage:** Dataverse for Teams holds up to 2 GB per Team, far more than this needs. Upgrading the Team's environment to full Dataverse later lifts every limit without rebuilding.
- **Audit trail:** every row records who created and last changed it, and when. A full field-by-field history (the portal's audit log) needs full Dataverse.
- **Data-level privacy is strongest for allocation:** members can only read their *own* assignments, enforced by Dataverse. Projects, risks and the people list are visible to all members at data level, and the app shows each employee only their own. That matches the portal's rule that employees can see project names but not anyone else's figures.
- **Look:** with [02b-ui-design.md](02b-ui-design.md) the app closely follows the portal: Appkit colours and type, the same icons, SVG visuals, and dark mode. Pixel-perfect layout and animation are harder in Power Apps than in the custom portal.

## Re-generating the migration workbook

Run this from `../pwc-utilization-portal`:

```bash
npm run dataverse:export -- "/path/to/Utilization Tracker.xlsx"
```

It writes `dataverse-import.xlsx` next to your workbook. It uses the same tested importer as the portal: rows for the same project are merged, team members become assignments, risks are split one per line, and problems are listed on an *Issues* sheet.
