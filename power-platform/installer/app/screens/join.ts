import { button, datePicker, gallery, hbox, icon, iconImg, input, rect, type Screen, str, vbox } from "../dsl.ts";
import { ICONS } from "../icons.ts";
import { C, REBUILD_MINE } from "../theme.ts";
import { caption, card, cell, type Col, emptyState, field, fieldError, namer, page, panelHeader, ragPill, segmentedFrom, statusPill, strong, tableHeader, tableRow } from "../ui.ts";
import { allocOk, lookupRef } from "./shared.ts";

const n = namer("Join");
const SEARCH = n("txtSearch");
const J = "LookUp(colProjects, ID = locJoinId)";
const alloc = n("txtAlloc");
const ds = n("dteStart");
const de = n("dteEnd");

const ITEMS = `With({q: Lower(Trim(${SEARCH}.Text))},
    Sort(
        Filter(colProjects,
            ProjectStatus.Value <> "Closed" && !(ID in colMyProjectIds) &&
            (Len(q) = 0 || q in Lower(Title) || q in Lower(Client.Value) || q in Lower(EngagementLeads))
        ),
        Title, SortOrder.Ascending
    )
)`;

const cols: Col[] = [
  { title: "Project", fill: 3 },
  { title: "Status", width: 84 },
  { title: "RAG", width: 84 },
  { title: "Dates", width: 170 },
];

const VALID = `locJoinId > 0 && ${allocOk(alloc)} && !IsBlank(${ds}.SelectedDate) && (IsBlank(${de}.SelectedDate) || ${de}.SelectedDate >= ${ds}.SelectedDate)`;

const JOIN = `Set(varBusy, true);
IfError(
    Collect(colAssignments, Patch('UP Assignments', Defaults('UP Assignments'), {
        Title: User().FullName & " · " & ${J}.Title,
        Project: {Id: locJoinId, Value: ${J}.Title},
        Person: {Id: gMe.ID, Value: gMe.Title},
        PersonEmail: gMeEmail,
        Capability: ${lookupRef("locCap", "colCapabilities")},
        Allocation: Value(${alloc}.Text),
        StartDate: ${ds}.SelectedDate,
        EndDate: ${de}.SelectedDate
    }));
    ${REBUILD_MINE};
    Set(varBusy, false);
    Notify("You've joined " & ${J}.Title, NotificationType.Success, 3000);
    Set(gProjectId, locJoinId);
    Set(gProjectTab, "Overview");
    UpdateContext({locJoinId: 0});
    Navigate(scrProject, ScreenTransition.None),
    Set(varBusy, false);
    Notify("Couldn't join: " & FirstError.Message, NotificationType.Error)
)`;

export default function joinScreen(): Screen {
  const gal = n("galProjects");
  const list = card(n("conList"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height)`, [
    hbox(n("conListHead"), { Height: 52, FillPortions: 0, LayoutMinHeight: 0, pad: [8, 20, 0, 20], gap: 12 }, [
      input(SEARCH, { HintText: str("Search projects, clients or leads"), FillPortions: 1, LayoutMinWidth: 0, DelayOutput: true }),
      caption(n("lblListCount"), `CountRows(${gal}.AllItems) & " open projects you're not on"`, { Width: 220, Align: "Align.Right" }),
    ]),
    ...tableHeader(n, "Join", cols),
    gallery(gal, ITEMS, 60, tableRow(n, "Join", [
      cell(n("celJoin0"), cols[0], [
        strong(n("lblJoinTitle"), "ThisItem.Title", { Color: "If(ThisItem.ID = locJoinId, gPrimary, gHeading)" }),
        caption(n("lblJoinSub"), `ThisItem.Client.Value & " · " & ThisItem.Territory.Value & If(IsBlank(ThisItem.EngagementLeads), "", " · " & ThisItem.EngagementLeads)`),
      ]),
      cell(n("celJoin1"), cols[1], [statusPill(n("pilJoinStatus"), "ThisItem.ProjectStatus.Value")]),
      cell(n("celJoin2"), cols[2], [ragPill(n("pilJoinRag"), "ThisItem.RAG.Value")]),
      cell(n("celJoin3"), cols[3], [
        caption(n("lblJoinDates"), `Text(ThisItem.StartDate, "dd mmm yyyy") & " – " & If(IsBlank(ThisItem.EndDate), "open", Text(ThisItem.EndDate, "dd mmm yyyy"))`, { size: 10 }),
      ]),
    ], {
      height: 60,
      onSelect: `UpdateContext({locJoinId: ThisItem.ID, locAllocDefault: 100}); Reset(${alloc}); Reset(${ds}); Reset(${de})`,
      after: [rect(n("rectJoinSel"), "gPrimary", { X: 0, Y: 8, Width: 3, Height: 43, Visible: "ThisItem.ID = locJoinId" })],
    }), { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
    emptyState(n, "Join", `CountRows(${gal}.AllItems) = 0`, "No projects to join", "Can't find it? Log it as a new project instead.", ICONS.search, 160),
  ]);

  const formH = `52 + 1 + 20 + 52 + 20 + 18 + 6 + RoundUp(Max(1, CountRows(colCapabilities)) / 3, 0) * 42 + 20 + 84 + 20 + 84 + 20 + 40 + 24`;
  const form = card(n("conForm"), `If(locJoinId > 0, ${formH}, 260)`, [
    panelHeader(n, "Form", "Your role", "How much of your week goes to it"),
    rect(n("rectForm"), "gLine", { Height: 1, FillPortions: 0 }),
    emptyState(n, "Form", "locJoinId = 0", "Pick a project", "Select a project on the left to join it.", ICONS.join, 180),
    vbox(n("conFormBody"), { Visible: "locJoinId > 0", pad: 20, gap: 20, FillPortions: 1 }, [
      vbox(n("conFormProj"), { Height: 52, FillPortions: 0, LayoutMinHeight: 0, Fill: "gPage", radius: 6, pad: [8, 12], gap: 2 }, [
        strong(n("lblFormProj"), `${J}.Title`),
        caption(n("lblFormProjSub"), `${J}.Client.Value & " · " & ${J}.Territory.Value`),
      ]),
      field(n, "Cap", "Capability", [segmentedFrom(n, "Cap", "colCapabilities", "Title", "locCap", { perRow: 3, itemWidth: 100 })], {
        height: `18 + 6 + RoundUp(Max(1, CountRows(colCapabilities)) / 3, 0) * 42`,
        props: { FillPortions: 0 },
      }),
      field(n, "Alloc", "Allocation %", [input(alloc, { Default: "Text(locAllocDefault)", Format: "TextFormat.Number" }), fieldError(n, "AllocE", "Enter a number from 0 to 200", `!${allocOk(alloc)}`)], {
        required: true,
        height: 84,
        props: { FillPortions: 0 },
      }),
      hbox(n("conFormDates"), { gap: 12, Height: 84, FillPortions: 0, LayoutMinHeight: 0, align: "Start" }, [
        field(n, "Start", "From", [datePicker(ds, { DefaultDate: `If(${J}.StartDate > Today(), ${J}.StartDate, Today())` })], { required: true, height: 64 }),
        field(n, "End", "To", [datePicker(de, { DefaultDate: `${J}.EndDate` }), fieldError(n, "EndE", "Before the start", `!IsBlank(${de}.SelectedDate) && ${de}.SelectedDate < ${ds}.SelectedDate`)], { height: 84 }),
      ]),
      button(n("btnJoinNow"), `If(varBusy, "Joining…", "Join project")`, "primary", {
        DisplayMode: `If(varBusy || !(${VALID}), DisplayMode.Disabled, DisplayMode.Edit)`,
        OnSelect: JOIN,
        Height: 40,
      }),
    ]),
  ]);

  return page({
    key: "Join",
    screen: "scrJoin",
    nav: "join",
    title: str("Join a project"),
    subtitle: str("Add yourself to a project that's already in the portal"),
    onVisible: `UpdateContext({locJoinId: Coalesce(gJoinProjectId, 0), locCap: Coalesce(gMe.PrimaryCapability.Id, 0), locAllocDefault: 100});
Set(gJoinProjectId, 0); Reset(${alloc}); Reset(${ds}); Reset(${de})`,
    actions: [button(n("btnLog"), str("Can't find it? Log a project"), "secondary", { Width: 220, OnSelect: "Set(gEditProjectId, 0); Navigate(scrLog, ScreenTransition.None)" })],
    content: [
      hbox(n("conSplit"), { gap: 20, align: "Start", FillPortions: 0, LayoutMinHeight: 0, Height: `Max(${n("conList")}.Height, ${n("conForm")}.Height)` }, [
        vbox(n("conListWrap"), { FillPortions: 1, LayoutMinWidth: 0, Height: `${n("conList")}.Height` }, [list]),
        vbox(n("conFormWrap"), { Width: 360, FillPortions: 0, Height: `${n("conForm")}.Height` }, [form]),
      ]),
      hbox(n("conTip"), { Height: 44, FillPortions: 0, LayoutMinHeight: 0, gap: 10, pad: [0, 4] }, [
        iconImg(n("imgTip"), icon(ICONS.lock, C.muted), 16),
        caption(n("lblTip"), str("Your allocation is private: only you and admins can see it."), { FillPortions: 1, LayoutMinWidth: 0 }),
      ]),
    ],
  });
}
