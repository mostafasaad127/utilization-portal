import { button, gallery, hit, hbox, icon, iconImg, image, label, rect, type Screen, str, vbox } from "../dsl.ts";
import { ICONS } from "../icons.ts";
import { C } from "../theme.ts";
import { caption, card, cell, type Col, emptyState, link, namer, page, panelHeader, ragPill, sevPill, statTile, statusPill, strong, tableHeader, tableRow } from "../ui.ts";
import { openProject } from "./shared.ts";

const n = namer("Home");

// Allocation-weighted share of working days per month of the FY (same maths as the portal).
const BUILD_MONTHS = `ClearCollect(colMonths,
    ForAll(Sequence(12, 0) As m,
        With({ms: DateAdd(gFYStart, m.Value, TimeUnit.Months)},
        With({me: DateAdd(DateAdd(ms, 1, TimeUnit.Months), -1, TimeUnit.Days)},
        With({wd: CountRows(Filter(Sequence(DateDiff(ms, me, TimeUnit.Days) + 1, 0) As d,
                                   Weekday(DateAdd(ms, d.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5))},
        {
            Idx: m.Value,
            MonthStart: ms,
            Pct: Round(Sum(
                ForAll(Filter(colMine, ProjStatus <> "Pipeline" && StartDate <= me && EffEnd >= ms) As a,
                    With({s: If(a.StartDate > ms, a.StartDate, ms), e: If(a.EffEnd < me, a.EffEnd, me)},
                        {v: a.Allocation * CountRows(Filter(Sequence(DateDiff(s, e, TimeUnit.Days) + 1, 0) As d2,
                            Weekday(DateAdd(s, d2.Value, TimeUnit.Days), StartOfWeek.Monday) <= 5)) / wd})),
                v), 0),
            Pipeline: CountRows(Filter(colMine, ProjStatus = "Pipeline" && StartDate <= me && EffEnd >= ms)) > 0
        }))))
)`;

const HEAT_SVG = `"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 76' font-family='Helvetica Neue, Arial, sans-serif'>" &
    Concat(colMonths,
        With({
            x: Idx * 100,
            cur: Month(MonthStart) = Month(Today()) && Year(MonthStart) = Year(Today()),
            fill: Switch(true, Pct <= 0, "#E8E8E8", Pct < 70, "#FBD5C2", Pct < 100, "#F39B6D", Pct = 100, "#D04A02", "#8A2A00")
        },
            "<text x='" & (x + 49) & "' y='14' text-anchor='middle' font-size='12' fill='" & If(cur, "#D04A02", "#696969") & "'" &
                If(cur, " font-weight='700'", "") & ">" & Text(MonthStart, "mmm") & "</text>" &
            "<rect x='" & (x + 2) & "' y='22' width='94' height='44' rx='3' fill='" & fill & "'" &
                If(cur, " stroke='#252525' stroke-width='2'", "") & "/>" &
            "<text x='" & (x + 49) & "' y='49' text-anchor='middle' font-size='14' fill='" &
                If(Pct >= 100, "#FFFFFF", If(Pct <= 0, "#696969", "#252525")) & "'>" & Pct & "%</text>" &
            If(Pipeline, "<circle cx='" & (x + 88) & "' cy='30' r='3' fill='#415385'/>", "")
        )
    ) & "</svg>")`;

const LEGEND_SVG = (() => {
  const items = [
    ["#E8E8E8", "On bench", 0],
    ["#FBD5C2", "Under-utilized", 76],
    ["#F39B6D", "Healthy", 180],
    ["#D04A02", "Fully booked", 250],
    ["#8A2A00", "Over-allocated", 348],
  ] as const;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 560 16' font-family='Helvetica Neue, Arial' font-size='11' fill='#696969'>` +
    items.map(([c, t, x]) => `<rect x='${x}' y='3' width='10' height='10' rx='2' fill='${c}'/><text x='${x + 14}' y='12'>${t}</text>`).join("") +
    `<circle cx='460' cy='8' r='3' fill='#415385'/><text x='468' y='12'>Pipeline work</text></svg>`;
  return str("data:image/svg+xml;utf8," + encodeURIComponent(svg));
})();

const UTIL_TODAY = `Sum(Filter(colMine, ProjStatus <> "Pipeline" && StartDate <= Today() && EffEnd >= Today()), Allocation)`;
const CURRENT = `Filter(colMine, ProjStatus <> "Pipeline" && ProjStatus <> "Closed" && StartDate <= Today() && EffEnd >= Today())`;
const WAITING = `Filter(${CURRENT}, ProjStatus = "Active" && (IsBlank(ProjLastUpdate) || DateDiff(ProjLastUpdate, Today(), TimeUnit.Days) > 14))`;
const WORK = `Sort(Filter(colMine, EffEnd >= Today() && ProjStatus <> "Closed"), StartDate, SortOrder.Ascending)`;
const RISKS = `Filter(colRisks, RiskStatus.Value <> "Closed" && Project.Id in colMyProjectIds)`;

const workCols: Col[] = [
  { title: "Project", fill: 3 },
  { title: "Allocation", width: 80, align: "Right" },
  { title: "From", width: 96 },
  { title: "To", width: 96 },
  { title: "Status", width: 150 },
];

export default function home(): Screen {
  return page({
    key: "Home",
    screen: "scrHome",
    nav: "home",
    title: `If(Hour(Now()) < 12, "Good morning", Hour(Now()) < 18, "Good afternoon", "Good evening") & ", " & gFirstName`,
    subtitle: `"Your work in " & gFYLabel & " (" & Text(gFYStart, "dd mmm yyyy") & " – " & Text(gFYEnd, "dd mmm yyyy") & ")"`,
    onVisible: BUILD_MONTHS,
    actions: [
      button(n("btnJoin"), str("Join a project"), "secondary", { Width: 140, OnSelect: "Navigate(scrJoin, ScreenTransition.None)" }),
      button(n("btnLog"), str("+  Log a project"), "primary", { Width: 150, OnSelect: "Set(gEditProjectId, 0); Navigate(scrLog, ScreenTransition.None)" }),
    ],
    content: [
      // First-run welcome
      hbox(n("conWelcome"), { Visible: "IsBlank(gMe.PrimaryCapability.Value)", Height: 64, FillPortions: 0, LayoutMinHeight: 0, Fill: "gPrimaryTint", radius: 8, pad: [0, 20, 0, 0], gap: 16 }, [
        rect(n("rectWelcome"), "gPrimary", { Width: 4, Height: 64 }),
        iconImg(n("imgWelcome"), icon(ICONS.profile, C.primary), 22),
        vbox(n("conWelcomeTxt"), { FillPortions: 1, LayoutMinWidth: 0, Height: 44, gap: 2, justify: "Center" }, [
          strong(n("lblWelcome"), `"Welcome, " & gFirstName & "!"`),
          caption(n("lblWelcomeHint"), str("Set your grade, territory and capability so new projects are pre-filled for you.")),
        ]),
        button(n("btnWelcome"), str("Complete profile"), "primary", { Width: 150, OnSelect: "Navigate(scrProfile, ScreenTransition.None)" }),
      ]),
      // Tiles
      hbox(n("conTiles"), { Height: 124, FillPortions: 0, LayoutMinHeight: 0, gap: 16, align: "Stretch" }, [
        statTile(n, "Util", {
          label: "Your utilization today",
          value: `Text(${UTIL_TODAY})`,
          unit: str("%"),
          detail: `With({u: ${UTIL_TODAY}}, Switch(true, u = 0, "On the bench", u < 70, "Under-utilized", u < 100, "Healthy", u = 100, "Fully booked", "Over-allocated"))`,
          icon: ICONS.gauge,
          attention: `${UTIL_TODAY} > 100 || ${UTIL_TODAY} = 0`,
        }),
        statTile(n, "FY", {
          label: `=gFYLabel & " average"`,
          value: "Text(Round(Average(colMonths, Pct), 0))",
          unit: str("%"),
          detail: str("Weighted by working days, Jul – Jun"),
          icon: ICONS.chart,
        }),
        statTile(n, "Cur", {
          label: "Current projects",
          value: `Text(CountRows(${CURRENT}))`,
          detail: `With({c: CountRows(Filter(colMine, StartDate > Today() && ProjStatus <> "Closed"))}, If(c = 0, "Nothing upcoming yet", c & " upcoming"))`,
          icon: ICONS.briefcase,
        }),
        statTile(n, "Roll", {
          label: "Next roll-off",
          value: `With({d: First(Sort(Filter(${CURRENT}, EffEnd < gFarFuture), EffEnd, SortOrder.Ascending)).EffEnd}, If(IsBlank(d), "—", Text(d, "dd mmm yyyy")))`,
          detail: str("Earliest end of a current assignment"),
          icon: ICONS.calendar,
        }),
      ]),
      // Waiting for your update
      vbox(n("conWaiting"), {
        Visible: `CountRows(${WAITING}) > 0`,
        card: true,
        FillPortions: 0,
        LayoutMinHeight: 0,
        Height: `74 + 1 + CountRows(${WAITING}) * 60`,
      }, [
        panelHeader(n, "Wait", "Waiting for your update", "No status update in the last 14 days", [iconImg(n("imgWait"), icon(ICONS.bell, C.primary), 20)]),
        rect(n("rectWait"), "gLine", { Height: 1, FillPortions: 0 }),
        gallery(n("galWaiting"), WAITING, 60, [
          vbox(n("conWaitTxt"), { X: 20, Y: 0, Width: "Parent.TemplateWidth - 300", Height: 59, gap: 2, justify: "Center" }, [
            strong(n("lblWaitTitle"), "ThisItem.Project.Value"),
            caption(n("lblWaitSub"), `ThisItem.ProjClient & " · " & If(IsBlank(ThisItem.ProjLastUpdate), "no updates yet", "last update " & Text(ThisItem.ProjLastUpdate, "dd mmm"))`),
          ]),
          ragPill(n("pilWaitRag"), "ThisItem.ProjRAG", { X: "Parent.TemplateWidth - 250", Y: 19 }),
          button(n("btnWaitPost"), str("Post update"), "secondary", {
            X: "Parent.TemplateWidth - 140",
            Y: 13,
            Width: 120,
            Height: 34,
            OnSelect: openProject("ThisItem.Project.Id", "Updates"),
          }),
          rect(n("rectWaitSep"), "gLine", { X: 20, Y: 59, Width: "Parent.TemplateWidth - 40", Height: 1 }),
        ], { Height: `CountRows(${WAITING}) * 60`, FillPortions: 0 }),
      ]),
      // FY heat strip
      card(n("conHeat"), "74 + 1 + 20 + (Self.Width - 40) * 76 / 1200 + 20", [
        panelHeader(n, "Heat", `="Your " & gFYLabel & " by month"`, "Share of your working days booked, by month", [
          image(n("imgLegend"), LEGEND_SVG, { Width: 420, Height: 12, AccessibleLabel: str("Legend") }),
        ]),
        rect(n("rectHeat"), "gLine", { Height: 1, FillPortions: 0 }),
        rect(n("rectHeatPad"), "Color.Transparent", { Height: 20, FillPortions: 0 }),
        image(n("imgHeat"), HEAT_SVG, {
          Height: "(Parent.Width - 40) * 76 / 1200",
          FillPortions: 0,
          AlignInContainer: "AlignInContainer.Stretch",
          PaddingLeft: 20,
          PaddingRight: 20,
          AccessibleLabel: str("Utilization by month"),
        }),
      ]),
      // Work + risks
      hbox(n("conBottom"), {
        Height: `52 + 37 + Max(${n("galWork")}.Height, ${n("galRisks")}.Height, 150)`,
        FillPortions: 0,
        LayoutMinHeight: 0,
        gap: 20,
        align: "Stretch",
      }, [
        vbox(n("conWork"), { card: true, FillPortions: 2, LayoutMinWidth: 0 }, [
          panelHeader(n, "Work", "Your current & upcoming work", undefined, [link(n("lnkWork"), str("All my projects"), "Navigate(scrProjects, ScreenTransition.None)")]),
          ...tableHeader(n, "Work", workCols),
          gallery(n("galWork"), WORK, 56, tableRow(n, "Work", [
            cell(n("celWork0"), workCols[0], [
              strong(n("lblWorkTitle"), "ThisItem.Project.Value"),
              caption(n("lblWorkSub"), `ThisItem.ProjClient & " · " & Coalesce(ThisItem.Capability.Value, "—")`),
            ]),
            cell(n("celWork1"), workCols[1], [strong(n("lblWorkAlloc"), `ThisItem.Allocation & "%"`, { Align: "Align.Right", Color: "If(ThisItem.Allocation > 100, gRed, gHeading)" })]),
            cell(n("celWork2"), workCols[2], [label(n("lblWorkFrom"), `Text(ThisItem.StartDate, "dd mmm yyyy")`)]),
            cell(n("celWork3"), workCols[3], [label(n("lblWorkTo"), `If(ThisItem.EffEnd = gFarFuture, "Open-ended", Text(ThisItem.EffEnd, "dd mmm yyyy"))`)]),
            cell(n("celWork4"), workCols[4], [
              hbox(n("conWorkPills"), { gap: 6, Height: 24, FillPortions: 0, LayoutMinHeight: 0 }, [statusPill(n("pilWorkStatus"), "ThisItem.ProjStatus"), ragPill(n("pilWorkRag"), "ThisItem.ProjRAG")]),
            ]),
          ], { height: 56, onSelect: openProject("ThisItem.Project.Id") }), { Height: "Self.AllItemsCount * 56", FillPortions: 0 }),
          emptyState(n, "Work", `CountRows(${WORK}) = 0`, "No current or upcoming work", "Join a project or log a new one to see it here.", ICONS.briefcase),
        ]),
        vbox(n("conRisks"), { card: true, FillPortions: 1, LayoutMinWidth: 0 }, [
          panelHeader(n, "Risks", "Open risks on your projects"),
          rect(n("rectRisks"), "gLine", { Height: 1, FillPortions: 0 }),
          rect(n("rectRisksPad"), "Color.Transparent", { Height: 36, FillPortions: 0 }),
          gallery(n("galRisks"), `Sort(${RISKS}, Modified, SortOrder.Descending)`, 64, [
            vbox(n("conRiskTxt"), { X: 20, Y: 0, Width: "Parent.TemplateWidth - 120", Height: 63, gap: 2, justify: "Center" }, [
              label(n("lblRiskTitle"), "ThisItem.Title", { color: "gHeading", Wrap: false }),
              caption(n("lblRiskSub"), "ThisItem.Project.Value"),
            ]),
            sevPill(n("pilRiskSev"), "ThisItem.Severity.Value", { X: "Parent.TemplateWidth - 20 - Self.Width", Y: 20 }),
            rect(n("rectRiskSep"), "gLine", { X: 20, Y: 63, Width: "Parent.TemplateWidth - 40", Height: 1 }),
            hit(n("btnRiskOpen"), openProject("ThisItem.Project.Id", "Risks"), { X: 0, Y: 0, Width: "Parent.TemplateWidth - 110", Height: 63 }),
          ], { Height: "Self.AllItemsCount * 64", FillPortions: 0 }),
          emptyState(n, "Risks", `CountRows(${RISKS}) = 0`, "No open risks", "Risks raised on your projects show up here.", ICONS.shield),
        ]),
      ]),
    ],
  });
}

