import { button, ctl, gallery, group, hbox, hit, icon, iconImg, input, label, pill, rect, type Ctl, type Screen, str, T, vbox } from "../dsl.ts";
import { ICONS } from "../icons.ts";
import { C, REBUILD_MINE } from "../theme.ts";
import {
  body,
  caption,
  card,
  cell,
  type Col,
  dialog,
  emptyState,
  field,
  link,
  meter,
  namer,
  page,
  panelHeader,
  ragColor,
  ragPill,
  segmented,
  sevPill,
  statusPill,
  strong,
  tableHeader,
  tableRow,
} from "../ui.ts";
import { assignmentDialog, guarded, openAssignment } from "./shared.ts";

const n = namer("Project");
const P = "LookUp(colProjects, ID = gProjectId)";
const MY_ASG = "LookUp(colMine, Project.Id = gProjectId)";
const UPDATES = "Sort(Filter(colUpdates, Project.Id = gProjectId), Created, SortOrder.Descending)";
const RISKS = "Sort(Filter(colRisks, Project.Id = gProjectId), Modified, SortOrder.Descending)";
const OPEN_RISKS = `Filter(colRisks, Project.Id = gProjectId && RiskStatus.Value <> "Closed")`;
const TEAM = "Sort(Filter(colAssignments, Project.Id = gProjectId), Person.Value, SortOrder.Ascending)";
const R = "LookUp(colRisks, ID = locRiskId)";
const canEditRisk = `(locRiskId = -1 || gIsAdmin || Lower(${R}.Author.Email) = gMeEmail)`;

const TABS = [
  { key: "Overview", label: `"Overview"` },
  { key: "Updates", label: `"Status updates  " & CountRows(Filter(colUpdates, Project.Id = gProjectId))` },
  { key: "Risks", label: `"Risks  " & CountRows(${OPEN_RISKS})` },
  { key: "Team", label: `"Team  " & CountRows(Filter(colAssignments, Project.Id = gProjectId))`, admin: true },
];

function tabs(): Ctl {
  return hbox(n("conTabs"), { Height: 44, FillPortions: 0, LayoutMinHeight: 0, gap: 24, align: "End" }, TABS.map((t) =>
    vbox(n(`conTab${t.key}`), { Width: t.key === "Overview" ? 76 : 128, Height: 44, gap: 0, Visible: t.admin ? "gIsAdmin" : undefined, justify: "End" }, [
      button(n(`btnTab${t.key}`), t.label, "tertiary", {
        Height: 40,
        PaddingLeft: 0,
        PaddingRight: 0,
        Align: "Align.Left",
        Size: 10.5,
        Color: `If(locTab = "${t.key}", gHeading, gMuted)`,
        HoverColor: "gHeading",
        HoverFill: "Color.Transparent",
        PressedFill: "Color.Transparent",
        FontWeight: `If(locTab = "${t.key}", FontWeight.Semibold, FontWeight.Normal)`,
        OnSelect: `UpdateContext({locTab: "${t.key}"})`,
      }),
      rect(n(`rectTab${t.key}`), `If(locTab = "${t.key}", gPrimary, Color.Transparent)`, { Height: 2 }),
    ]),
  ));
}

function overview(): Ctl {
  const details = card(n("conDetails"), 52 + 1 + 3 * 60 + 16, [
    panelHeader(n, "Det", "Details"),
    rect(n("rectDet"), "gLine", { Height: 1, FillPortions: 0 }),
    gallery(
      n("galDetails"),
      `Table(
    {L: "Client", V: ${P}.Client.Value},
    {L: "Industry", V: Coalesce(${P}.Industry.Value, "—")},
    {L: "Territory", V: LookUp(colTerritories, ID = ${P}.Territory.Id).FullName},
    {L: "Line of service", V: Coalesce(${P}.LineOfService.Value, "—")},
    {L: "Start date", V: Text(${P}.StartDate, "dd mmm yyyy")},
    {L: "End date", V: If(IsBlank(${P}.EndDate), "Open-ended", Text(${P}.EndDate, "dd mmm yyyy") & " · " & RoundDown(DateDiff(${P}.StartDate, ${P}.EndDate, TimeUnit.Days) / 7, 0) & " weeks")},
    {L: "Engagement leads", V: Coalesce(${P}.EngagementLeads, "—")},
    {L: "Multi-tower", V: If(${P}.MultiTower, "Yes", "No")},
    {L: "Last update", V: If(IsBlank(${P}.LastUpdateOn), "No updates yet", Text(${P}.LastUpdateOn, "dd mmm yyyy"))}
)`,
      60,
      [
        caption(n("lblDetLabel"), "ThisItem.L", { X: 20, Y: 10, Width: "Parent.TemplateWidth - 28" }),
        strong(n("lblDetValue"), "ThisItem.V", { X: 20, Y: 30, Width: "Parent.TemplateWidth - 28" }),
      ],
      { WrapCount: 3, Height: 3 * 60 + 8, FillPortions: 0 },
    ),
  ]);
  const scope = card(n("conScope"), `52 + 1 + 16 + ${n("lblScope")}.Height + 20`, [
    panelHeader(n, "Scope", "Scope"),
    rect(n("rectScope"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conScopeBody"), { pad: [16, 20, 20, 20], FillPortions: 1 }, [
      body(n("lblScope"), `Coalesce(${P}.Scope, "No scope written yet. Edit the project to add one.")`, { AutoHeight: true, Wrap: true, LineHeight: 1.4, VerticalAlign: "VerticalAlign.Top" }),
    ]),
  ]);
  const left = vbox(n("conOvLeft"), { FillPortions: 1, LayoutMinWidth: 0, gap: 20, Height: `${n("conDetails")}.Height + 20 + ${n("conScope")}.Height` }, [details, scope]);

  // Right column
  const role = card(n("conRole"), 196, [
    panelHeader(n, "Role", "Your role"),
    rect(n("rectRole"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conRoleMine"), { Visible: `!IsBlank(${MY_ASG})`, pad: [14, 20], gap: 10, FillPortions: 1 }, [
      hbox(n("conRoleRow1"), { Height: 40, FillPortions: 0, LayoutMinHeight: 0, gap: 12 }, [
        vbox(n("conRoleCap"), { FillPortions: 1, LayoutMinWidth: 0, gap: 2, Height: 40 }, [
          caption(n("lblRoleCap"), str("Capability")),
          strong(n("lblRoleCapVal"), `Coalesce(${MY_ASG}.Capability.Value, "—")`),
        ]),
        vbox(n("conRoleAlloc"), { Width: 110, gap: 2, Height: 40, align: "End" }, [
          caption(n("lblRoleAlloc"), str("Allocation"), { Align: "Align.Right" }),
          strong(n("lblRoleAllocVal"), `${MY_ASG}.Allocation & "%"`, { Align: "Align.Right", size: 14 }),
        ]),
      ]),
      caption(n("lblRoleDates"), `Text(${MY_ASG}.StartDate, "dd mmm yyyy") & " – " & If(${MY_ASG}.EffEnd = gFarFuture, "open-ended", Text(${MY_ASG}.EffEnd, "dd mmm yyyy"))`),
      button(n("btnRoleEdit"), str("Edit my assignment"), "secondary", {
        Height: 32,
        Width: 170,
        OnSelect: openAssignment(`LookUp(colAssignments, ID = ${MY_ASG}.ID)`),
      }),
    ]),
    vbox(n("conRoleNone"), { Visible: `IsBlank(${MY_ASG})`, pad: [14, 20], gap: 10, FillPortions: 1 }, [
      body(n("lblRoleNone"), str("You're not on this project."), { Height: 20 }),
      caption(n("lblRoleNoneHint"), str("Join it to log your allocation and see it on your dashboard.")),
      button(n("btnRoleJoin"), str("Join this project"), "primary", {
        Height: 32,
        Width: 160,
        Visible: `${P}.ProjectStatus.Value <> "Closed"`,
        OnSelect: "Set(gJoinProjectId, gProjectId); Navigate(scrJoin, ScreenTransition.None)",
      }),
    ]),
  ]);
  const risksH = `52 + 1 + If(CountRows(${OPEN_RISKS}) = 0, 90, Min(3, CountRows(${OPEN_RISKS})) * 60)`;
  const risks = card(n("conOvRisks"), risksH, [
    panelHeader(n, "OvRisk", "Open risks", undefined, [link(n("lnkOvRisks"), str("View all"), `UpdateContext({locTab: "Risks"})`)]),
    rect(n("rectOvRisk"), "gLine", { Height: 1, FillPortions: 0 }),
    gallery(n("galOvRisks"), `FirstN(Sort(${OPEN_RISKS}, Modified, SortOrder.Descending), 3)`, 60, [
      label(n("lblOvRiskTitle"), "ThisItem.Title", { X: 20, Y: 10, Width: "Parent.TemplateWidth - 120", Height: 40, Wrap: true, color: "gHeading", size: 10, VerticalAlign: "VerticalAlign.Top" }),
      sevPill(n("pilOvRiskSev"), "ThisItem.Severity.Value", { X: "Parent.TemplateWidth - 20 - Self.Width", Y: 12 }),
      rect(n("rectOvRiskSep"), "gLine", { X: 20, Y: 59, Width: "Parent.TemplateWidth - 40", Height: 1 }),
    ], { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
    caption(n("lblOvRiskNone"), str("No open risks. Nice."), { Visible: `CountRows(${OPEN_RISKS}) = 0`, Height: 60, PaddingLeft: 20 }),
  ]);
  const latest = card(n("conLatest"), 172, [
    panelHeader(n, "Latest", "Latest update", undefined, [link(n("lnkLatest"), str("All updates"), `UpdateContext({locTab: "Updates"})`)]),
    rect(n("rectLatest"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conLatestBody"), { pad: [12, 20], gap: 6, FillPortions: 1, Visible: `!IsEmpty(${UPDATES})` }, [
      caption(n("lblLatestWho"), `First(${UPDATES}).Author.DisplayName & " · " & Text(First(${UPDATES}).Created, "dd mmm yyyy")`),
      strong(n("lblLatestTitle"), `First(${UPDATES}).Title`),
      body(n("lblLatestText"), `First(${UPDATES}).UpdateText`, { Height: 36, Wrap: true, size: 10, VerticalAlign: "VerticalAlign.Top" }),
    ]),
    caption(n("lblLatestNone"), str("No status updates yet."), { Visible: `IsEmpty(${UPDATES})`, Height: 60, PaddingLeft: 20 }),
  ]);
  const right = vbox(n("conOvRight"), { Width: 360, FillPortions: 0, gap: 20, Height: `${n("conRole")}.Height + ${n("conOvRisks")}.Height + ${n("conLatest")}.Height + 40` }, [role, risks, latest]);

  return hbox(n("conOverview"), {
    Visible: `locTab = "Overview"`,
    gap: 20,
    align: "Start",
    FillPortions: 0,
    LayoutMinHeight: 0,
    Height: `Max(${n("conOvLeft")}.Height, ${n("conOvRight")}.Height)`,
  }, [left, right]);
}

function updatesTab(): Ctl {
  const gal = n("galUpdates");
  const sum = n("txtUpdSummary");
  const txt = n("txtUpdText");
  const post = guarded(
    `Collect(colUpdates, Patch('UP Status updates', Defaults('UP Status updates'), {
        Title: Trim(${sum}.Text),
        Project: {Id: gProjectId, Value: ${P}.Title},
        UpdateRAG: {Value: locUpdRag},
        UpdateText: ${txt}.Text
    }));
    With({r: Patch('UP Projects', LookUp('UP Projects', ID = gProjectId), {RAG: {Value: locUpdRag}, LastUpdateOn: Today()})},
        Patch(colProjects, LookUp(colProjects, ID = gProjectId), r));
    ${REBUILD_MINE};
    Reset(${sum}); Reset(${txt})`,
    "Update posted",
  );
  const timeline = card(n("conTimeline"), `52 + 1 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height + 12)`, [
    panelHeader(n, "Tl", "Status updates"),
    rect(n("rectTl"), "gLine", { Height: 1, FillPortions: 0 }),
    gallery(gal, UPDATES, 116, [
      rect(n("rectTlLine"), "gLine", { X: 31, Y: 0, Width: 2, Height: "Parent.TemplateHeight" }),
      ctl(T.button, n("btnTlDot"), {
        Text: '""',
        DisplayMode: "DisplayMode.View",
        X: 26,
        Y: 18,
        Width: 12,
        Height: 12,
        Fill: ragColor("ThisItem.UpdateRAG.Value"),
        HoverFill: ragColor("ThisItem.UpdateRAG.Value"),
        BorderColor: "gCard",
        BorderThickness: 2,
        RadiusTopLeft: 6,
        RadiusTopRight: 6,
        RadiusBottomLeft: 6,
        RadiusBottomRight: 6,
      }),
      strong(n("lblTlTitle"), "ThisItem.Title", { X: 52, Y: 12, Width: "Parent.TemplateWidth - 180", Height: 24 }),
      ragPill(n("pilTlRag"), "ThisItem.UpdateRAG.Value", { X: "Parent.TemplateWidth - 20 - Self.Width", Y: 13 }),
      caption(n("lblTlWho"), `ThisItem.Author.DisplayName & " · " & Text(ThisItem.Created, "dd mmm yyyy")`, { X: 52, Y: 36, Width: "Parent.TemplateWidth - 72" }),
      body(n("lblTlText"), "ThisItem.UpdateText", { X: 52, Y: 58, Width: "Parent.TemplateWidth - 72", Height: 48, Wrap: true, size: 10, VerticalAlign: "VerticalAlign.Top" }),
    ], { Height: "Self.AllItemsCount * 116", FillPortions: 0 }),
    emptyState(n, "Tl", `CountRows(${gal}.AllItems) = 0`, "No status updates yet", "Post the first update. It sets the project's RAG.", ICONS.message, 160),
  ]);
  const form = card(n("conPost"), 52 + 1 + 20 + 64 + 16 + 64 + 16 + 18 + 6 + 120 + 16 + 40 + 20, [
    panelHeader(n, "Post", "Post an update"),
    rect(n("rectPost"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conPostBody"), { pad: 20, gap: 16, FillPortions: 1 }, [
      field(n, "UpdRag", "RAG", [segmented(n, "UpdRag", ["Green", "Amber", "Red"], "locUpdRag", { FillPortions: 0 })], { required: true, props: { FillPortions: 0 } }),
      field(n, "UpdSummary", "Summary", [input(sum, { HintText: str("One line, e.g. UAT signed off") })], { required: true, props: { FillPortions: 0 } }),
      field(n, "UpdText", "Details", [input(txt, { Mode: "TextMode.MultiLine", Height: 120, HintText: str("What happened, what's next, anything blocked?") })], {
        height: 18 + 6 + 120,
        props: { FillPortions: 0 },
      }),
      button(n("btnPost"), `If(varBusy, "Posting…", "Post update")`, "primary", {
        Width: 140,
        DisplayMode: `If(varBusy || Len(Trim(${sum}.Text)) = 0, DisplayMode.Disabled, DisplayMode.Edit)`,
        OnSelect: post,
      }),
    ]),
  ]);
  return hbox(n("conUpdates"), {
    Visible: `locTab = "Updates"`,
    gap: 20,
    align: "Start",
    FillPortions: 0,
    LayoutMinHeight: 0,
    Height: `Max(${n("conTimeline")}.Height, ${n("conPost")}.Height)`,
  }, [vbox(n("conTlWrap"), { FillPortions: 1, LayoutMinWidth: 0, Height: `${n("conTimeline")}.Height` }, [timeline]), vbox(n("conPostWrap"), { Width: 380, FillPortions: 0, Height: `${n("conPost")}.Height` }, [form])]);
}

const riskCols: Col[] = [
  { title: "Risk", fill: 3 },
  { title: "Severity", width: 90 },
  { title: "Status", width: 100 },
  { title: "Owner", width: 150 },
  { title: "Raised", width: 100 },
];

function risksTab(): Ctl {
  const gal = n("galRisks");
  return card(n("conRisksTab"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height)`, [
    panelHeader(n, "RiskTab", "Risks and challenges", undefined, [
      button(n("btnAddRisk"), str("+  Add risk"), "primary", {
        Width: 120,
        Height: 34,
        OnSelect: `UpdateContext({locRiskId: -1, locRiskSev: "Medium", locRiskStatus: "Open", locRiskConfirm: false})`,
      }),
    ]),
    ...tableHeader(n, "Risk", riskCols),
    gallery(gal, RISKS, 64, tableRow(n, "Risk", [
      cell(n("celRisk0"), riskCols[0], [
        strong(n("lblRiskTitle"), "ThisItem.Title"),
        caption(n("lblRiskMit"), `If(IsBlank(ThisItem.Mitigation), "No mitigation yet", "Mitigation: " & ThisItem.Mitigation)`),
      ]),
      cell(n("celRisk1"), riskCols[1], [sevPill(n("pilRiskSev"), "ThisItem.Severity.Value")]),
      cell(n("celRisk2"), riskCols[2], [pill(n("pilRiskStatus"), "ThisItem.RiskStatus.Value", `If(ThisItem.RiskStatus.Value = "Closed", gPage, gInfoTint)`, `If(ThisItem.RiskStatus.Value = "Closed", gBody, gInfo)`)]),
      cell(n("celRisk3"), riskCols[3], [label(n("lblRiskOwner"), `Coalesce(ThisItem.RiskOwner, "—")`)]),
      cell(n("celRisk4"), riskCols[4], [label(n("lblRiskDate"), `Text(ThisItem.Created, "dd mmm yyyy")`)]),
    ], {
      height: 64,
      onSelect: `UpdateContext({locRiskId: ThisItem.ID, locRiskSev: ThisItem.Severity.Value, locRiskStatus: ThisItem.RiskStatus.Value, locRiskConfirm: false})`,
    }), { Height: "Self.AllItemsCount * 64", FillPortions: 0 }),
    emptyState(n, "Risk", `CountRows(${gal}.AllItems) = 0`, "No risks logged", "Add risks and challenges so the team can track mitigation.", ICONS.risk, 160),
  ], { Visible: `locTab = "Risks"` });
}

const teamCols: Col[] = [
  { title: "Person", fill: 3 },
  { title: "Allocation", width: 170 },
  { title: "From", width: 100 },
  { title: "To", width: 100 },
];

function teamTab(): Ctl {
  const gal = n("galTeam");
  return card(n("conTeamTab"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height) + 44`, [
    panelHeader(n, "TeamTab", "Team", undefined, [caption(n("lblTeamTotal"), `"Total " & Sum(Filter(colAssignments, Project.Id = gProjectId), Allocation) & "% allocated"`, { Width: 200, Align: "Align.Right" })]),
    ...tableHeader(n, "Team", teamCols),
    gallery(gal, TEAM, 60, tableRow(n, "Team", [
      cell(n("celTeam0"), teamCols[0], [
        strong(n("lblTeamName"), `ThisItem.Person.Value & If(Lower(ThisItem.PersonEmail) = gMeEmail, "  (you)", "")`),
        caption(n("lblTeamCap"), `Coalesce(ThisItem.Capability.Value, "—")`),
      ]),
      cell(n("celTeam1"), teamCols[1], [
        hbox(n("conTeamMeter"), { gap: 10, Height: 20, FillPortions: 0, LayoutMinHeight: 0 }, [
          meter(n("imgTeamMeter"), "ThisItem.Allocation"),
          strong(n("lblTeamAlloc"), `ThisItem.Allocation & "%"`, { Width: 50, Color: "If(ThisItem.Allocation > 100, gRed, gHeading)" }),
        ]),
      ]),
      cell(n("celTeam2"), teamCols[2], [label(n("lblTeamFrom"), `Text(ThisItem.StartDate, "dd mmm yyyy")`)]),
      cell(n("celTeam3"), teamCols[3], [label(n("lblTeamTo"), `If(IsBlank(ThisItem.EndDate), "—", Text(ThisItem.EndDate, "dd mmm yyyy"))`)]),
    ], { height: 60, onSelect: openAssignment("ThisItem") }), { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
    emptyState(n, "Team", `CountRows(${gal}.AllItems) = 0`, "Nobody on this project yet", "People join from the Join a project screen.", ICONS.people, 160),
    caption(n("lblTeamNote"), str("Select a person to change their allocation or dates. People add themselves with Join a project, so they own their row."), {
      Height: 44,
      PaddingLeft: 20,
      PaddingRight: 20,
      Wrap: true,
    }),
  ], { Visible: `locTab = "Team" && gIsAdmin` });
}

function riskDialog(): Ctl {
  const title = n("txtRiskTitle");
  const owner = n("txtRiskOwner");
  const mit = n("txtRiskMit");
  const save = guarded(
    `With({rec: {
        Title: Trim(${title}.Text),
        Project: {Id: gProjectId, Value: ${P}.Title},
        Severity: {Value: locRiskSev},
        RiskStatus: {Value: locRiskStatus},
        RiskOwner: Trim(${owner}.Text),
        Mitigation: ${mit}.Text
    }},
        If(locRiskId = -1,
            Patch('UP Risks', Defaults('UP Risks'), rec),
            Patch('UP Risks', LookUp('UP Risks', ID = locRiskId), rec)));
    ClearCollect(colRisks, 'UP Risks');
    UpdateContext({locRiskId: 0})`,
    "Risk saved",
  );
  const remove = `If(!locRiskConfirm, UpdateContext({locRiskConfirm: true}),
    ${guarded(`Remove('UP Risks', LookUp('UP Risks', ID = locRiskId));
    RemoveIf(colRisks, ID = locRiskId);
    UpdateContext({locRiskId: 0, locRiskConfirm: false})`, "Risk deleted")})`;
  const editable = `If(${canEditRisk}, DisplayMode.Edit, DisplayMode.View)`;
  return dialog(
    n,
    "Risk",
    "locRiskId <> 0",
    `If(locRiskId = -1, "Add a risk", "Risk")`,
    "UpdateContext({locRiskId: 0, locRiskConfirm: false})",
    [
      caption(n("lblRiskReadOnly"), `"Raised by " & ${R}.Author.DisplayName & ". Only they or an admin can change it."`, { Visible: `!${canEditRisk}` }),
      field(n, "RiskTitle", "Risk or challenge", [input(title, { Default: `If(locRiskId = -1, "", ${R}.Title)`, DisplayMode: editable, HintText: str("e.g. Client data access delayed") })], { required: true, props: { FillPortions: 0 } }),
      hbox(n("conRiskRow"), { gap: 24, Height: 64, FillPortions: 0, LayoutMinHeight: 0, align: "Start" }, [
        field(n, "RiskSev", "Severity", [segmented(n, "RiskSev", ["Low", "Medium", "High", "Critical"], "locRiskSev")], { props: { Width: 340, FillPortions: 0 } }),
        field(n, "RiskStatus", "Status", [segmented(n, "RiskStatus", ["Open", "Mitigating", "Closed"], "locRiskStatus")]),
      ]),
      field(n, "RiskOwner", "Owner", [input(owner, { Default: `If(locRiskId = -1, User().FullName, ${R}.RiskOwner)`, DisplayMode: editable })], { props: { FillPortions: 0 } }),
      field(n, "RiskMit", "Mitigation", [input(mit, { Mode: "TextMode.MultiLine", Height: 96, Default: `If(locRiskId = -1, "", ${R}.Mitigation)`, DisplayMode: editable })], {
        height: 18 + 6 + 96,
        props: { FillPortions: 0 },
      }),
    ],
    [
      button(n("btnRiskDelete"), `If(locRiskConfirm, "Click again to delete", "Delete")`, "danger", { Width: 170, Visible: `locRiskId > 0 && ${canEditRisk}`, OnSelect: remove }),
      label(n("lblRiskSpacer"), '""', { FillPortions: 1, LayoutMinWidth: 0 }),
      button(n("btnRiskCancel"), str("Cancel"), "ghost", { Width: 96, OnSelect: "UpdateContext({locRiskId: 0, locRiskConfirm: false})" }),
      button(n("btnRiskSave"), `If(varBusy, "Saving…", "Save risk")`, "primary", {
        Width: 120,
        Visible: canEditRisk,
        DisplayMode: `If(varBusy || Len(Trim(${title}.Text)) = 0, DisplayMode.Disabled, DisplayMode.Edit)`,
        OnSelect: save,
      }),
    ],
    { width: 680, height: 540 },
  );
}

export default function project(): Screen {
  return page({
    key: "Project",
    screen: "scrProject",
    nav: "projects",
    breadcrumb: { text: str("Projects"), onSelect: "Navigate(scrProjects, ScreenTransition.None)" },
    title: `${P}.Title`,
    subtitle: `${P}.Client.Value & If(IsBlank(${P}.LineOfService.Value), "", " · " & ${P}.LineOfService.Value) & " · " & LookUp(colTerritories, ID = ${P}.Territory.Id).FullName`,
    belowTitle: [
      hbox(n("conPills"), { gap: 8, Height: 26, FillPortions: 0, LayoutMinHeight: 0 }, [
        statusPill(n("pilStatus"), `${P}.ProjectStatus.Value`),
        ragPill(n("pilRag"), `${P}.RAG.Value`),
        pill(n("pilMulti"), str("Multi-tower"), "gInfoTint", "gInfo", { Visible: `${P}.MultiTower` }),
      ]),
    ],
    headerHeight: 172,
    headerExtra: [tabs()],
    onVisible: `UpdateContext({locTab: Coalesce(gProjectTab, "Overview"), locUpdRag: Coalesce(${P}.RAG.Value, "Green"), locRiskId: 0, locAsgId: 0});
Set(gProjectTab, Blank())`,
    actions: [
      button(n("btnEdit"), str("Edit project"), "secondary", { Width: 130, OnSelect: "Set(gEditProjectId, gProjectId); Navigate(scrLog, ScreenTransition.None)" }),
    ],
    content: [overview(), updatesTab(), risksTab(), teamTab()],
    overlays: [riskDialog(), assignmentDialog(n)],
  });
}
