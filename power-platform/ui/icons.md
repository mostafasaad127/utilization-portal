# Icon pack (the portal's icons, for Power Apps)

These are the exact icons the portal uses (Lucide, ISC licence), as SVG fragments. Paste this block at the **end of App.OnStart**:

```powerfx
// ── Icons (Lucide) ── each is the inside of a 24×24 SVG; render with the pattern below
Set(icoDashboard, "<rect width='7' height='9' x='3' y='3' rx='1'/><rect width='7' height='5' x='14' y='3' rx='1'/><rect width='7' height='9' x='14' y='12' rx='1'/><rect width='7' height='5' x='3' y='16' rx='1'/>"); // Nav: dashboard
Set(icoProjects, "<path d='M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z'/><path d='M8 10v4'/><path d='M12 10v2'/><path d='M16 10v6'/>"); // Nav: projects
Set(icoJoin, "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><line x1='19' x2='19' y1='8' y2='14'/><line x1='22' x2='16' y1='11' y2='11'/>"); // Nav: join a project · button
Set(icoRisk, "<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/>"); // Nav: risks · risk tile
Set(icoProfile, "<circle cx='12' cy='12' r='10'/><circle cx='12' cy='10' r='3'/><path d='M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662'/>"); // Nav: my profile
Set(icoPeople, "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><path d='M16 3.128a4 4 0 0 1 0 7.744'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><circle cx='9' cy='7' r='4'/>"); // Nav: people (admin)
Set(icoUtilization, "<path d='M3 3v16a2 2 0 0 0 2 2h16'/><path d='M18 17V9'/><path d='M13 17V5'/><path d='M8 17v-3'/>"); // Nav: utilization (admin)
Set(icoShield, "<path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/><path d='m9 12 2 2 4-4'/>"); // Nav: users & roles (admin)
Set(icoDatabase, "<ellipse cx='12' cy='5' rx='9' ry='3'/><path d='M3 5V19A9 3 0 0 0 21 19V5'/><path d='M3 12A9 3 0 0 0 21 12'/>"); // Nav: reference data (admin)
Set(icoImport, "<path d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/><path d='M14 2v5a1 1 0 0 0 1 1h5'/><path d='M8 13h2'/><path d='M14 13h2'/><path d='M8 17h2'/><path d='M14 17h2'/>"); // Nav: migration (admin)
Set(icoPlus, "<path d='M5 12h14'/><path d='M12 5v14'/>"); // Log a project · add buttons
Set(icoSearch, "<path d='m21 21-4.34-4.34'/><circle cx='11' cy='11' r='8'/>"); // Search boxes
Set(icoGauge, "<path d='m12 14 4-4'/><path d='M3.34 19a10 10 0 1 1 17.32 0'/>"); // Tile: utilization today
Set(icoCalendar, "<path d='M16 14v2.2l1.6 1'/><path d='M16 2v3'/><path d='M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338'/><path d='M3 9h5.859'/><path d='M8 2v3'/><circle cx='16' cy='16' r='6'/>"); // Tile: next roll-off
Set(icoBell, "<path d='M10.268 21a2 2 0 0 0 3.464 0'/><path d='M22 8c0-2.3-.8-4.3-2-6'/><path d='M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'/><path d='M4 2C2.8 3.7 2 5.7 2 8'/>"); // Panel: waiting for your update
Set(icoBriefcase, "<path d='M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'/><rect width='20' height='14' x='2' y='6' rx='2'/>"); // Tile: active projects
Set(icoBench, "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><line x1='22' x2='16' y1='11' y2='11'/>"); // Tile: on the bench
Set(icoEdit, "<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/>"); // Edit buttons
Set(icoDelete, "<path d='M10 11v6'/><path d='M14 11v6'/><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'/><path d='M3 6h18'/><path d='M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>"); // Delete buttons
Set(icoClose, "<path d='M18 6 6 18'/><path d='m6 6 12 12'/>"); // Close dialog
Set(icoChevron, "<path d='m9 18 6-6-6-6'/>"); // Breadcrumbs · row arrows
Set(icoArrow, "<path d='M5 12h14'/><path d='m12 5 7 7-7 7'/>"); // Links: View all
Set(icoDownload, "<path d='M12 15V3'/><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><path d='m7 10 5 5 5-5'/>"); // Export
Set(icoLayers, "<path d='M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z'/><path d='M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12'/><path d='M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'/>"); // Multi-tower pill
Set(icoCheck, "<circle cx='12' cy='12' r='10'/><path d='m16 9-5.5 5.5L8 12'/>"); // Success states
Set(icoLock, "<rect width='18' height='11' x='3' y='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>"); // Notices
```

## How to show an icon

Add an **Image** control (for example 20 × 20) and set its **Image** property:

```powerfx
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#D04A02' " &
    "stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" & icoGauge & "</svg>")
```

Change the stroke colour for state: `#D04A02` (active/primary), `#474747` (default), `#696969` (muted), `#C52A1A` (attention).
In the navigation gallery, use `If(App.ActiveScreen = ThisItem.Screen, "#D04A02", "#474747")` for the stroke.

The **cmpIcon** component in [../02b-ui-design.md](../02b-ui-design.md) wraps this pattern so you only set *IconSvg* and *IconColor*.

| Variable | Lucide icon | Used for |
|---|---|---|
| `icoDashboard` | layout-dashboard | Nav: dashboard |
| `icoProjects` | folder-kanban | Nav: projects |
| `icoJoin` | user-plus | Nav: join a project · button |
| `icoRisk` | triangle-alert | Nav: risks · risk tile |
| `icoProfile` | circle-user | Nav: my profile |
| `icoPeople` | users | Nav: people (admin) |
| `icoUtilization` | chart-column | Nav: utilization (admin) |
| `icoShield` | shield-check | Nav: users & roles (admin) |
| `icoDatabase` | database | Nav: reference data (admin) |
| `icoImport` | file-spreadsheet | Nav: migration (admin) |
| `icoPlus` | plus | Log a project · add buttons |
| `icoSearch` | search | Search boxes |
| `icoGauge` | gauge | Tile: utilization today |
| `icoCalendar` | calendar-clock | Tile: next roll-off |
| `icoBell` | bell-ring | Panel: waiting for your update |
| `icoBriefcase` | briefcase | Tile: active projects |
| `icoBench` | user-minus | Tile: on the bench |
| `icoEdit` | pencil | Edit buttons |
| `icoDelete` | trash-2 | Delete buttons |
| `icoClose` | x | Close dialog |
| `icoChevron` | chevron-right | Breadcrumbs · row arrows |
| `icoArrow` | arrow-right | Links: View all |
| `icoDownload` | download | Export |
| `icoLayers` | layers | Multi-tower pill |
| `icoCheck` | circle-check | Success states |
| `icoLock` | lock | Notices |
