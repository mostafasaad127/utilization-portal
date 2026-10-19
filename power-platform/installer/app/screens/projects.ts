import { button, gallery, hbox, input, label, type Screen, spacer, str } from "../dsl.ts";
import { ICONS } from "../icons.ts";
import { caption, card, cell, type Col, emptyState, namer, page, ragPill, segmented, statusPill, strong, tableHeader, tableRow } from "../ui.ts";
import { openProject } from "./shared.ts";

const n = namer("Projects");
const SEARCH = n("txtSearch");

export const PROJECT_ITEMS = `With({q: Lower(Trim(${SEARCH}.Text))},
    Sort(
        Filter(colProjects,
            (locScope = "All projects" || ID in colMyProjectIds) &&
            Switch(locStatus,
                "Open", ProjectStatus.Value <> "Closed",
                "All", true,
                ProjectStatus.Value = locStatus) &&
            (Len(q) = 0 || q in Lower(Title) || q in Lower(Client.Value) || q in Lower(EngagementLeads))
        ),
        StartDate, SortOrder.Descending
    )
)`;

const cols: Col[] = [
  { title: "Project", fill: 3 },
  { title: "Status", width: 84 },
  { title: "RAG", width: 84 },
  { title: "Start", width: 96 },
  { title: "End", width: 96 },
  { title: "Your allocation", width: 110, align: "Right" },
];

export default function projects(): Screen {
  const gal = n("galProjects");
  return page({
    key: "Projects",
    screen: "scrProjects",
    nav: "projects",
    title: str("Projects"),
    subtitle: `If(locScope = "All projects", "Every project in the portal", "Projects you're assigned to")`,
    onVisible: `If(IsBlank(locScope), UpdateContext({locScope: If(gIsAdmin, "All projects", "My projects"), locStatus: "Open"}))`,
    actions: [
      button(n("btnJoin"), str("Join a project"), "secondary", { Width: 140, OnSelect: "Navigate(scrJoin, ScreenTransition.None)" }),
      button(n("btnLog"), str("+  Log a project"), "primary", { Width: 150, OnSelect: "Set(gEditProjectId, 0); Navigate(scrLog, ScreenTransition.None)" }),
    ],
    content: [
      // Filter bar
      hbox(n("conFilters"), { card: true, Height: 72, FillPortions: 0, LayoutMinHeight: 0, pad: [0, 20], gap: 16, wrap: false }, [
        input(SEARCH, { HintText: str("Search by project, client or lead"), Width: 300, FillPortions: 0, DelayOutput: true }),
        segmented(n, "Scope", ["My projects", "All projects"], "locScope", { FillPortions: 0, Width: 236 }),
        spacer(n("spcFilters")),
        label(n("lblStatusFilter"), str("Status"), { size: 9.5, color: "gMuted", Width: 44 }),
        segmented(n, "Status", ["Open", "Active", "Pipeline", "On hold", "Closed", "All"], "locStatus", { FillPortions: 0, Width: 440 }),
      ]),
      // Table
      card(n("conTable"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height)`, [
        hbox(n("conTableHead"), { Height: 52, FillPortions: 0, LayoutMinHeight: 0, pad: [0, 20], gap: 8 }, [
          strong(n("lblCount"), `CountRows(${gal}.AllItems) & If(CountRows(${gal}.AllItems) = 1, " project", " projects")`, { FillPortions: 1, LayoutMinWidth: 0 }),
          caption(n("lblHint"), str("Select a row to open the project"), { Width: 220, Align: "Align.Right" }),
        ]),
        ...tableHeader(n, "Proj", cols),
        gallery(
          gal,
          PROJECT_ITEMS,
          60,
          tableRow(
            n,
            "Proj",
            [
              cell(n("celProj0"), cols[0], [
                strong(n("lblProjTitle"), "ThisItem.Title"),
                caption(n("lblProjSub"), `ThisItem.Client.Value & " · " & ThisItem.Territory.Value & If(IsBlank(ThisItem.EngagementLeads), "", " · " & ThisItem.EngagementLeads)`),
              ]),
              cell(n("celProj1"), cols[1], [statusPill(n("pilProjStatus"), "ThisItem.ProjectStatus.Value")]),
              cell(n("celProj2"), cols[2], [ragPill(n("pilProjRag"), "ThisItem.RAG.Value")]),
              cell(n("celProj3"), cols[3], [label(n("lblProjStart"), `Text(ThisItem.StartDate, "dd mmm yyyy")`)]),
              cell(n("celProj4"), cols[4], [label(n("lblProjEnd"), `If(IsBlank(ThisItem.EndDate), "—", Text(ThisItem.EndDate, "dd mmm yyyy"))`)]),
              cell(n("celProj5"), cols[5], [
                strong(n("lblProjAlloc"), `With({a: Sum(Filter(colMine, Project.Id = ThisItem.ID && EffEnd >= Today()), Allocation)}, If(a = 0, "—", a & "%"))`, {
                  Align: "Align.Right",
                }),
              ]),
            ],
            { height: 60, onSelect: openProject("ThisItem.ID") },
          ),
          { Height: "Self.AllItemsCount * 60", FillPortions: 0 },
        ),
        emptyState(
          n,
          "Proj",
          `CountRows(${gal}.AllItems) = 0`,
          `=If(locScope = "My projects", "You're not on any projects yet", "No projects match")`,
          `=If(locScope = "My projects", "Join an existing project or log a new one.", "Try another status or search.")`,
          ICONS.projects,
          160,
        ),
      ]),
    ],
  });
}
