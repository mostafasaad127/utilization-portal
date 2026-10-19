/**
 * Design tokens (Appkit 4, as in the web portal) and the app-level formulas.
 *
 *  - APP_FORMULAS goes into App → Formulas (named formulas: theme, dates).
 *  - APP_ONSTART goes into App → OnStart (loads data, works out who you are).
 *
 * The App object can't be pasted as code, so these two are copied into the
 * formula bar by hand (the installer gives you Copy buttons for both).
 */

export const C = {
  primary: "#D04A02",
  primaryHover: "#E45C2B",
  primaryPressed: "#A43E03",
  primaryDisabled: "#F3C9B3",
  primaryTint: "#FDEEE7",
  page: "#F3F3F3",
  card: "#FFFFFF",
  heading: "#252525",
  body: "#474747",
  muted: "#696969",
  line: "#E8E8E8",
  inputBorder: "#D1D1D1",
  inputHover: "#8E95A2",
  focus: "#1060CF",
  green: "#21812D",
  greenTint: "#E6F2E7",
  amber: "#8A5A00",
  amberDot: "#FFBF1F",
  amberTint: "#FFF5DC",
  red: "#C52A1A",
  redTint: "#F9E6E4",
  info: "#415385",
  infoTint: "#E7EAF2",
};

// Heat colours (same scale as the portal's capacity views).
export const HEAT = { bench: "#E8E8E8", under: "#FBD5C2", healthy: "#F39B6D", full: "#D04A02", over: "#8A2A00" };

const color = (hex: string) => `ColorValue("${hex}")`;

export const APP_FORMULAS = `// ── Utilization Portal · App.Formulas ─────────────────────────────
// Theme (PwC Appkit 4). Change a colour here and the whole app follows.
gPrimary = ${color(C.primary)};
gPrimaryHover = ${color(C.primaryHover)};
gPrimaryPressed = ${color(C.primaryPressed)};
gPrimaryDisabled = ${color(C.primaryDisabled)};
gPrimaryTint = ${color(C.primaryTint)};
gPage = ${color(C.page)};
gCard = ${color(C.card)};
gHeading = ${color(C.heading)};
gBody = ${color(C.body)};
gMuted = ${color(C.muted)};
gLine = ${color(C.line)};
gInputBorder = ${color(C.inputBorder)};
gInputHover = ${color(C.inputHover)};
gFocus = ${color(C.focus)};
gGreen = ${color(C.green)};
gGreenTint = ${color(C.greenTint)};
gAmber = ${color(C.amber)};
gAmberTint = ${color(C.amberTint)};
gRed = ${color(C.red)};
gRedTint = ${color(C.redTint)};
gInfo = ${color(C.info)};
gInfoTint = ${color(C.infoTint)};
gHoverTint = RGBA(208, 74, 2, 0.04);
gPressTint = RGBA(208, 74, 2, 0.08);
gScrim = RGBA(0, 0, 0, 0.45);
gFont = Font.Arial;

// PwC financial year: 1 July – 30 June.
gFYStart = Date(If(Month(Today()) >= 7, Year(Today()), Year(Today()) - 1), 7, 1);
gFYEnd = DateAdd(DateAdd(gFYStart, 1, TimeUnit.Years), -1, TimeUnit.Days);
gFYLabel = "FY" & Right(Text(Year(gFYEnd)), 2);
gFarFuture = Date(2099, 12, 31);

// Who you are (from Microsoft 365).
gMeEmail = Lower(User().Email);
gMeInitials = Upper(Left(First(Split(User().FullName, " ")).Value, 1) & Left(Last(Split(User().FullName, " ")).Value, 1));
gFirstName = First(Split(User().FullName, " ")).Value;

// Optional: paste your Power BI report link here to show the "Open in Power BI" button.
gPowerBIUrl = "";
`;

/**
 * Loads every list into a collection. Admins (site owners) get all
 * assignments; everyone else gets only their own, because SharePoint
 * item-level permissions filter them on the server.
 */
export const APP_ONSTART = `// ── Utilization Portal · App.OnStart ──────────────────────────────
Set(varLoading, true);
Concurrent(
    ClearCollect(colProjects, 'UP Projects'),
    ClearCollect(colAssignments, 'UP Assignments'),
    ClearCollect(colPeople, 'UP People'),
    ClearCollect(colClients, 'UP Clients'),
    ClearCollect(colIndustries, 'UP Industries'),
    ClearCollect(colLoS, 'UP Lines of service'),
    ClearCollect(colTerritories, 'UP Territories'),
    ClearCollect(colCapabilities, 'UP Capabilities'),
    ClearCollect(colRisks, 'UP Risks'),
    ClearCollect(colUpdates, 'UP Status updates'),
    ClearCollect(colAdmins, 'UP Admins')
);
Set(gIsAdmin, CountRows(Filter(colAdmins, Lower(Email) = gMeEmail)) > 0);

// Your person record; created on first use so you can start logging straight away.
Set(gMe, LookUp(colPeople, Lower(Email) = gMeEmail));
If(IsBlank(gMe),
    Set(gMe, Patch('UP People', Defaults('UP People'), {Title: User().FullName, Email: gMeEmail, IsActive: true}));
    Collect(colPeople, gMe)
);

// Your assignments, with the project's status and an effective end date.
ClearCollect(colMine,
    AddColumns(
        Filter(colAssignments, Lower(PersonEmail) = gMeEmail || Person.Id = gMe.ID),
        ProjStatus, LookUp(colProjects As p, p.ID = Project.Id).ProjectStatus.Value,
        ProjRAG, LookUp(colProjects As p, p.ID = Project.Id).RAG.Value,
        ProjClient, LookUp(colProjects As p, p.ID = Project.Id).Client.Value,
        ProjTerritory, LookUp(colProjects As p, p.ID = Project.Id).Territory.Value,
        ProjLastUpdate, LookUp(colProjects As p, p.ID = Project.Id).LastUpdateOn,
        EffEnd, Coalesce(EndDate, LookUp(colProjects As p, p.ID = Project.Id).EndDate, gFarFuture)
    )
);
ClearCollect(colMyProjectIds, Distinct(colMine, Project.Id));
Set(varLoading, false);
`;

/**
 * Rebuilds colMine after any change to assignments or projects. Pasted into
 * the screens wherever data changes (Power Fx has no shared procedures yet).
 */
export const REBUILD_MINE = `ClearCollect(colMine,
    AddColumns(
        Filter(colAssignments, Lower(PersonEmail) = gMeEmail || Person.Id = gMe.ID),
        ProjStatus, LookUp(colProjects As p, p.ID = Project.Id).ProjectStatus.Value,
        ProjRAG, LookUp(colProjects As p, p.ID = Project.Id).RAG.Value,
        ProjClient, LookUp(colProjects As p, p.ID = Project.Id).Client.Value,
        ProjTerritory, LookUp(colProjects As p, p.ID = Project.Id).Territory.Value,
        ProjLastUpdate, LookUp(colProjects As p, p.ID = Project.Id).LastUpdateOn,
        EffEnd, Coalesce(EndDate, LookUp(colProjects As p, p.ID = Project.Id).EndDate, gFarFuture)
    )
);
ClearCollect(colMyProjectIds, Distinct(colMine, Project.Id))`;

/** Full refresh from SharePoint (the header's refresh button). */
export const REFRESH_ALL = `Set(varLoading, true);
Concurrent(
    ClearCollect(colProjects, 'UP Projects'),
    ClearCollect(colAssignments, 'UP Assignments'),
    ClearCollect(colPeople, 'UP People'),
    ClearCollect(colClients, 'UP Clients'),
    ClearCollect(colRisks, 'UP Risks'),
    ClearCollect(colUpdates, 'UP Status updates')
);
Set(gMe, LookUp(colPeople, Lower(Email) = gMeEmail));
${REBUILD_MINE};
Set(varLoading, false)`;
