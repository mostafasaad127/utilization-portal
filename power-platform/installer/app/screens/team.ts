import { button, gallery, hbox, input, label, type Screen, spacer, str } from "../dsl.ts";
import { ICONS } from "../icons.ts";
import { caption, card, cell, type Col, emptyState, meter, namer, page, panelHeader, ragPill, segmented, statTile, statusPill, strong, tableHeader, tableRow } from "../ui.ts";
import { openProject } from "./shared.ts";

const n = namer("Team");
const SEARCH = n("txtSearch");

// Per-person utilization today, active projects and next roll-off.
const BUILD = `ClearCollect(colAsgX,
    AddColumns(colAssignments,
        PStatus, LookUp(colProjects As p, p.ID = Project.Id).ProjectStatus.Value,
        PEnd, Coalesce(EndDate, LookUp(colProjects As p, p.ID = Project.Id).EndDate, gFarFuture)
    )
);
ClearCollect(colTeam,
    AddColumns(Filter(colPeople, IsActive <> false),
        Util, Sum(Filter(colAsgX As a, a.Person.Id = ID && a.PStatus <> "Pipeline" && a.PStatus <> "Closed" && a.StartDate <= Today() && a.PEnd >= Today()), Allocation),
        Active, CountRows(Filter(colAsgX As a, a.Person.Id = ID && a.PStatus = "Active" && a.StartDate <= Today() && a.PEnd >= Today())),
        NextOff, First(Sort(Filter(colAsgX As a, a.Person.Id = ID && a.StartDate <= Today() && a.PEnd >= Today() && a.PEnd < gFarFuture), PEnd, SortOrder.Ascending)).PEnd
    )
);
If(IsBlank(locFilter), UpdateContext({locFilter: "Everyone"}))`;

const PEOPLE = `With({q: Lower(Trim(${SEARCH}.Text))},
    Sort(
        Filter(colTeam,
            Switch(locFilter,
                "On the bench", Util = 0,
                "Under-utilized", Util > 0 && Util < 70,
                "Over-allocated", Util > 100,
                true) &&
            (Len(q) = 0 || q in Lower(Title) || q in Lower(PrimaryCapability.Value) || q in Lower(Email))
        ),
        Util, SortOrder.Descending
    )
)`;

const ATTENTION = `Sort(Filter(colProjects, ProjectStatus.Value = "Active" && (RAG.Value <> "Green" || IsBlank(LastUpdateOn) || DateDiff(LastUpdateOn, Today(), TimeUnit.Days) > 14)), RAG.Value, SortOrder.Descending)`;

const cols: Col[] = [
  { title: "Person", fill: 3 },
  { title: "Territory", width: 80 },
  { title: "Utilization today", width: 180 },
  { title: "Active projects", width: 110, align: "Right" },
  { title: "Next roll-off", width: 110 },
];

const pcols: Col[] = [
  { title: "Project", fill: 3 },
  { title: "RAG", width: 84 },
  { title: "Last update", width: 110 },
];

export default function team(): Screen {
  const gal = n("galPeople");
  const pgal = n("galAttention");
  return page({
    key: "Team",
    screen: "scrTeam",
    nav: "team",
    title: str("Team overview"),
    subtitle: `"Everyone's utilization today · " & CountRows(colTeam) & " people"`,
    onVisible: BUILD,
    actions: [
      button(n("btnPBI"), str("Open Power BI report"), "secondary", { Width: 190, Visible: "!IsBlank(gPowerBIUrl)", OnSelect: "Launch(gPowerBIUrl)" }),
      button(n("btnAllProjects"), str("All projects"), "primary", { Width: 130, OnSelect: `Navigate(scrProjects, ScreenTransition.None)` }),
    ],
    content: [
      card(n("conNoAccess"), 200, [emptyState(n, "NoAccess", "true", "Admins only", "Ask an admin to add you to the UP Admins list.", ICONS.lock, 198)], { Visible: "!gIsAdmin" }),
      hbox(n("conTiles"), { Visible: "gIsAdmin", Height: 124, FillPortions: 0, LayoutMinHeight: 0, gap: 16, align: "Stretch" }, [
        statTile(n, "Util", {
          label: "Team utilization today",
          value: "Text(Round(Average(colTeam, Util), 0))",
          unit: str("%"),
          detail: str("Average across active people"),
          icon: ICONS.gauge,
        }),
        statTile(n, "Bench", {
          label: "On the bench",
          value: "Text(CountRows(Filter(colTeam, Util = 0)))",
          detail: str("No current billable work"),
          icon: ICONS.bench,
          attention: "CountRows(Filter(colTeam, Util = 0)) > 0",
        }),
        statTile(n, "Over", {
          label: "Over-allocated",
          value: "Text(CountRows(Filter(colTeam, Util > 100)))",
          detail: str("Booked above 100% today"),
          icon: ICONS.risk,
          attention: "CountRows(Filter(colTeam, Util > 100)) > 0",
        }),
        statTile(n, "Red", {
          label: "Projects needing attention",
          value: `Text(CountRows(${ATTENTION}))`,
          detail: str("Amber/red, or no update in 14 days"),
          icon: ICONS.bell,
          attention: `CountRows(Filter(colProjects, ProjectStatus.Value = "Active" && RAG.Value = "Red")) > 0`,
        }),
      ]),
      hbox(n("conFilters"), { Visible: "gIsAdmin", card: true, Height: 72, FillPortions: 0, LayoutMinHeight: 0, pad: [0, 20], gap: 16 }, [
        input(SEARCH, { HintText: str("Search people or capabilities"), Width: 300, FillPortions: 0, DelayOutput: true }),
        spacer(n("spcFilters")),
        segmented(n, "Filter", ["Everyone", "On the bench", "Under-utilized", "Over-allocated"], "locFilter", { FillPortions: 0, Width: 470 }),
      ]),
      card(n("conPeople"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height)`, [
        panelHeader(n, "People", "People", undefined, [caption(n("lblPeopleCount"), `CountRows(${gal}.AllItems) & " shown"`, { Width: 120, Align: "Align.Right" })]),
        ...tableHeader(n, "People", cols),
        gallery(gal, PEOPLE, 60, tableRow(n, "People", [
          cell(n("celPeople0"), cols[0], [
            strong(n("lblPersonName"), "ThisItem.Title"),
            caption(n("lblPersonSub"), `Coalesce(ThisItem.Grade.Value, "No grade") & " · " & Coalesce(ThisItem.PrimaryCapability.Value, "No capability")`),
          ]),
          cell(n("celPeople1"), cols[1], [label(n("lblPersonTerr"), `Coalesce(ThisItem.Territory.Value, "—")`)]),
          cell(n("celPeople2"), cols[2], [
            hbox(n("conPersonUtil"), { gap: 10, Height: 20, FillPortions: 0, LayoutMinHeight: 0 }, [
              meter(n("imgPersonUtil"), "ThisItem.Util"),
              strong(n("lblPersonUtil"), `ThisItem.Util & "%"`, { Width: 60, Color: "If(ThisItem.Util > 100, gRed, gHeading)" }),
            ]),
          ]),
          cell(n("celPeople3"), cols[3], [strong(n("lblPersonActive"), "Text(ThisItem.Active)")]),
          cell(n("celPeople4"), cols[4], [label(n("lblPersonOff"), `If(IsBlank(ThisItem.NextOff), "—", Text(ThisItem.NextOff, "dd mmm yyyy"))`)]),
        ], { height: 60 }), { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
        emptyState(n, "People", `CountRows(${gal}.AllItems) = 0`, "Nobody matches", "Try another filter or search.", ICONS.people, 160),
      ], { Visible: "gIsAdmin" }),
      card(n("conAttention"), `74 + 37 + If(CountRows(${pgal}.AllItems) = 0, 160, ${pgal}.Height)`, [
        panelHeader(n, "Att", "Projects needing attention", "Active projects that are amber or red, or have no update in 14 days"),
        ...tableHeader(n, "Att", pcols),
        gallery(pgal, ATTENTION, 60, tableRow(n, "Att", [
          cell(n("celAtt0"), pcols[0], [strong(n("lblAttTitle"), "ThisItem.Title"), caption(n("lblAttSub"), `ThisItem.Client.Value & " · " & ThisItem.Territory.Value`)]),
          cell(n("celAtt1"), pcols[1], [ragPill(n("pilAttRag"), "ThisItem.RAG.Value")]),
          cell(n("celAtt2"), pcols[2], [label(n("lblAttUpd"), `If(IsBlank(ThisItem.LastUpdateOn), "Never", Text(ThisItem.LastUpdateOn, "dd mmm yyyy"))`, { Color: "If(IsBlank(ThisItem.LastUpdateOn), gRed, gBody)" })]),
        ], { height: 60, onSelect: openProject("ThisItem.ID") }), { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
        emptyState(n, "Att", `CountRows(${pgal}.AllItems) = 0`, "All clear", "Every active project is green and up to date.", ICONS.check, 160),
      ], { Visible: "gIsAdmin" }),
    ],
  });
}
