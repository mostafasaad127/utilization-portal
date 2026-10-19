# 5. Moving your existing spreadsheet in

This is a one-off job. The export script does the hard part (merging rows, splitting team members and risks) using the portal's tested importer. A Migration screen in the app then creates the real rows with their lookups.

## 5.1 Generate the load workbook

Run this from `pwc-utilization-portal`:

```bash
npm run dataverse:export -- "/path/to/Utilization Tracker.xlsx"
```

It writes `dataverse-import.xlsx` next to your file:

| Sheet | Goes into | How |
|---|---|---|
| 1 Territories | Territory | Paste |
| 2 Capabilities | Capability | Paste |
| 3 Industries | Industry | Paste |
| 4 Lines of service | *(created by the Migration screen)* | Reference only |
| 5 Clients | *(created by the Migration screen)* | Reference only |
| 6 People | Person | Paste **Name** and **Email** |
| 7 Import Projects | Import project | Paste |
| 8 Import Assignments | Import assignment | Paste |
| 9 Import Risks | Import risk | Paste |
| Issues | — | Read it first: rows with errors were skipped |

**Before loading:** fill in everyone's **PwC email** on sheet 6. Without it, people can't be linked to their Teams account, and they won't see their own assignments.

## 5.2 Paste the simple tables

In **Power Apps → Build → [your Team] → See all → Tables**, open a table and click **Edit data**. Copy the rows from Excel (without the header row) and paste them into the grid's first empty row. Do this in order:

1. Territories (skip any you already added)
2. Capabilities
3. Industries
4. People: only the **Name** and **Email** columns. Everyone can complete grade, territory and capability later in **My profile**, or admins can on the People screen.
5. Import project, Import assignment, Import risk: paste sheets 7, 8 and 9 into the matching staging tables.

## 5.3 The Migration screen (admins)

Add a screen `scrMigration` with **OnVisible** `If(!gIsAdmin, Navigate(scrHome))`, plus five buttons, each with a label explaining what it does. Run them **top to bottom, once**. Every step skips rows that already exist, so running one twice is safe.

**① Create lines of service and clients**

```powerfx
ForAll(Distinct('Import projects', 'Line of service') As l,
    If(!IsBlank(l.Value) && IsBlank(LookUp('Lines of service', Name = l.Value)),
        Patch('Lines of service', Defaults('Lines of service'), {
            Name: l.Value,
            Territory: LookUp(Territories, Name = LookUp('Import projects', 'Line of service' = l.Value).Territory)
        })
    )
);
ForAll(Distinct('Import projects', Client) As c,
    If(IsBlank(LookUp(Clients, Name = c.Value)),
        Patch(Clients, Defaults(Clients), {
            Name: c.Value,
            Industry: LookUp(Industries, Name = LookUp('Import projects', Client = c.Value).Industry)
        })
    )
);
Notify("Lines of service and clients are ready.", NotificationType.Success)
```

**② Create projects**

```powerfx
ForAll('Import projects' As r,
    With({start: DateValue(r.'Start date', "en-GB")},
        If(IsBlank(LookUp(Projects, Name = r.'Project name' && Client.Name = r.Client && 'Start date' = start)),
            Patch(Projects, Defaults(Projects), {
                Name: r.'Project name',
                Client: LookUp(Clients, Name = r.Client),
                Industry: LookUp(Industries, Name = r.Industry),
                'Line of service': LookUp('Lines of service', Name = r.'Line of service'),
                Territory: LookUp(Territories, Name = r.Territory),
                Status: Switch(r.Status,
                    "Pipeline", 'Status (Projects)'.Pipeline,
                    "Active",   'Status (Projects)'.Active,
                    "On hold",  'Status (Projects)'.'On hold',
                                'Status (Projects)'.Closed),
                RAG: Switch(r.RAG, "Amber", 'RAG (Projects)'.Amber, "Red", 'RAG (Projects)'.Red, 'RAG (Projects)'.Green),
                'Start date': start,
                'End date': If(IsBlank(r.'End date'), Blank(), DateValue(r.'End date', "en-GB")),
                'Multi-tower': r.'Multi-tower' = "Yes",
                'Engagement leads': r.'Engagement leads',
                Scope: r.Scope
            })
        )
    )
);
Notify("Projects created.", NotificationType.Success)
```

**③ Create assignments** (each person owns their own row, so they can see it)

```powerfx
ForAll('Import assignments' As r,
    With({
        proj: LookUp(Projects, Name = r.'Project name' && Client.Name = r.Client && 'Start date' = DateValue(r.'Project start', "en-GB")),
        who:  LookUp(People, Name = r.Person)
    },
        If(!IsBlank(proj) && !IsBlank(who) &&
           IsBlank(LookUp(Assignments, Project.Project = proj.Project && Person.Person = who.Person)),
            With({u: LookUp(Users, 'Primary Email' = who.Email)},
                Patch(Assignments, Defaults(Assignments), {
                    Name: who.Name & " – " & proj.Name,
                    Project: proj,
                    Person: who,
                    Capability: LookUp(Capabilities, Name = r.Capability),
                    Allocation: Value(r.Allocation),
                    'Start date': DateValue(r.'Start date', "en-GB"),
                    'End date': If(IsBlank(r.'End date'), Blank(), DateValue(r.'End date', "en-GB"))
                },
                If(!IsBlank(u), {Owner: u}, {}))
            )
        )
    )
);
Notify("Assignments created.", NotificationType.Success)
```

**④ Create risks**

```powerfx
ForAll('Import risks' As r,
    With({proj: LookUp(Projects, Name = r.'Project name' && Client.Name = r.Client && 'Start date' = DateValue(r.'Project start', "en-GB"))},
        If(!IsBlank(proj) && IsBlank(LookUp(Risks, Name = r.Risk && Project.Project = proj.Project)),
            Patch(Risks, Defaults(Risks), {
                Name: r.Risk,
                Project: proj,
                Severity: Switch(r.Severity, "Low", 'Severity (Risks)'.Low, "High", 'Severity (Risks)'.High,
                                             "Critical", 'Severity (Risks)'.Critical, 'Severity (Risks)'.Medium),
                'Risk status': If(r.Status = "Closed", 'Risk status (Risks)'.Closed, 'Risk status (Risks)'.Open)
            })
        )
    )
);
Notify("Risks created.", NotificationType.Success)
```

**⑤ Fix ownership.** Run this now, and again whenever new people join the Team. It hands each assignment to the person it belongs to, so they can see it.

```powerfx
ForAll(Assignments As a,
    With({u: LookUp(Users, 'Primary Email' = a.Person.Email)},
        If(!IsBlank(u) && AsType(a.Owner, Users).'Primary Email' <> u.'Primary Email',
            Patch(Assignments, a, {Owner: u})
        )
    )
);
Notify("Ownership updated.", NotificationType.Success)
```

## 5.4 Check, then tidy up

1. Compare counts with the export's summary: projects, assignments and risks on the Projects screen and in Power BI.
2. Sign in as one employee (or ask one) and check they see exactly their own projects and allocation.
3. Delete the three **Import …** tables and remove buttons ①–④, keeping ⑤ for new joiners.
