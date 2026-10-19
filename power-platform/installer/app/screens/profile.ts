import { button, gallery, hbox, icon, iconImg, label, rect, type Screen, str, vbox } from "../dsl.ts";
import { GRADES } from "../../src/schema.ts";
import { ICONS } from "../icons.ts";
import { C } from "../theme.ts";
import { body, caption, card, cell, type Col, emptyState, field, meter, namer, page, panelHeader, ragPill, segmented, segmentedFrom, statusPill, strong, tableHeader, tableRow } from "../ui.ts";
import { assignmentDialog, guarded, lookupRef, openAssignment, openProject } from "./shared.ts";

const n = namer("Profile");
const MINE = `Sort(colMine, StartDate, SortOrder.Descending)`;
const UTIL = `Sum(Filter(colMine, ProjStatus <> "Pipeline" && StartDate <= Today() && EffEnd >= Today()), Allocation)`;

const cols: Col[] = [
  { title: "Project", fill: 3 },
  { title: "Allocation", width: 90, align: "Right" },
  { title: "From", width: 100 },
  { title: "To", width: 100 },
  { title: "Status", width: 160 },
  { title: "", width: 32 },
];

const SAVE = guarded(
  `With({r: Patch('UP People', LookUp('UP People', ID = gMe.ID), {
        Title: User().FullName,
        Email: gMeEmail,
        Grade: If(IsBlank(locGrade), Blank(), {Value: locGrade}),
        Territory: ${lookupRef("locTerritory", "colTerritories")},
        PrimaryCapability: ${lookupRef("locCap", "colCapabilities")}
    })},
        Set(gMe, r);
        Patch(colPeople, LookUp(colPeople, ID = r.ID), r))`,
  "Profile saved",
);

function readOnly(id: string, title: string, value: string) {
  return field(n, id, title, [
    hbox(n(`con${id}Val`), { Height: 40, FillPortions: 0, LayoutMinHeight: 0, Fill: "gPage", radius: 6, pad: [0, 12] }, [body(n(`lbl${id}Val`), value, { FillPortions: 1, LayoutMinWidth: 0 })]),
  ]);
}

export default function profile(): Screen {
  const gal = n("galMine");
  const capRows = `RoundUp(Max(1, CountRows(colCapabilities)) / 6, 0)`;
  const details = card(n("conDetails"), `52 + 1 + 20 + 64 + 20 + 92 + 20 + 18 + 6 + 42 + 20 + 18 + 6 + ${capRows} * 42 + 20 + 40 + 24`, [
    panelHeader(n, "Det", "Your details"),
    rect(n("rectDet"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conDetBody"), { pad: 20, gap: 20, FillPortions: 1 }, [
      hbox(n("conDetIds"), { gap: 24, Height: 64, FillPortions: 0, LayoutMinHeight: 0, align: "Start" }, [readOnly("Name", "Name", "User().FullName"), readOnly("Email", "Email", "User().Email")]),
      field(n, "Grade", "Grade", [segmented(n, "Grade", GRADES, "locGrade", { wrap: true, Height: 92 })], { height: 18 + 6 + 92, props: { FillPortions: 0 } }),
      field(n, "Territory", "Territory", [segmentedFrom(n, "Territory", "colTerritories", "Title", "locTerritory", { perRow: 6, itemWidth: 96 })], {
        height: 18 + 6 + 42,
        props: { FillPortions: 0 },
      }),
      field(n, "Cap", "Primary capability", [segmentedFrom(n, "Cap", "colCapabilities", "Title", "locCap", { perRow: 6, itemWidth: 96 })], {
        height: `18 + 6 + ${capRows} * 42`,
        props: { FillPortions: 0 },
      }),
      hbox(n("conDetSave"), { Height: 40, FillPortions: 0, LayoutMinHeight: 0, gap: 12 }, [
        button(n("btnSave"), `If(varBusy, "Saving…", "Save profile")`, "primary", { Width: 140, DisplayMode: "If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)", OnSelect: SAVE }),
        caption(n("lblSaveHint"), str("Used to pre-fill your capability when you join or log a project."), { FillPortions: 1, LayoutMinWidth: 0 }),
      ]),
    ]),
  ]);

  const side = card(n("conSide"), 300, [
    panelHeader(n, "Side", "At a glance"),
    rect(n("rectSide"), "gLine", { Height: 1, FillPortions: 0 }),
    vbox(n("conSideBody"), { pad: 20, gap: 12, FillPortions: 1 }, [
      caption(n("lblSideUtil"), str("Utilization today")),
      hbox(n("conSideUtil"), { gap: 12, Height: 32, FillPortions: 0, LayoutMinHeight: 0 }, [
        label(n("lblSideUtilVal"), `${UTIL} & "%"`, { size: 20, weight: "Semibold", color: `If(${UTIL} > 100, gRed, gHeading)`, Width: 90, Height: 32 }),
        meter(n("imgSideUtil"), UTIL, { Width: 160, Height: 8 }),
      ]),
      rect(n("rectSideSep"), "gLine", { Height: 1, FillPortions: 0 }),
      hbox(n("conSideRole"), { gap: 10, Height: 24, FillPortions: 0, LayoutMinHeight: 0 }, [
        iconImg(n("imgSideRole"), icon(ICONS.shield, C.primary), 18),
        strong(n("lblSideRole"), `If(gIsAdmin, "Admin", "Employee")`, { FillPortions: 1, LayoutMinWidth: 0 }),
      ]),
      body(n("lblSideRoleHint"), `If(gIsAdmin, "You can see every project, assignment and person.", "You see all projects, but only your own allocations. Admins see everyone's.")`, {
        Wrap: true,
        Height: 60,
        size: 10,
        VerticalAlign: "VerticalAlign.Top",
      }),
    ]),
  ]);

  return page({
    key: "Profile",
    screen: "scrProfile",
    nav: "profile",
    title: str("My profile"),
    subtitle: str("Your details and everything you're assigned to"),
    onVisible: `UpdateContext({locGrade: gMe.Grade.Value, locTerritory: Coalesce(gMe.Territory.Id, 0), locCap: Coalesce(gMe.PrimaryCapability.Id, 0), locAsgId: 0})`,
    content: [
      hbox(n("conTop"), { gap: 20, align: "Start", FillPortions: 0, LayoutMinHeight: 0, Height: `Max(${n("conDetails")}.Height, ${n("conSide")}.Height)` }, [
        vbox(n("conDetWrap"), { FillPortions: 1, LayoutMinWidth: 0, Height: `${n("conDetails")}.Height` }, [details]),
        vbox(n("conSideWrap"), { Width: 320, FillPortions: 0, Height: `${n("conSide")}.Height` }, [side]),
      ]),
      card(n("conMine"), `52 + 37 + If(CountRows(${gal}.AllItems) = 0, 160, ${gal}.Height)`, [
        panelHeader(n, "Mine", "Your assignments", "Select one to change your allocation or dates"),
        ...tableHeader(n, "Mine", cols),
        gallery(gal, MINE, 60, tableRow(n, "Mine", [
          cell(n("celMine0"), cols[0], [
            strong(n("lblMineTitle"), "ThisItem.Project.Value"),
            caption(n("lblMineSub"), `ThisItem.ProjClient & " · " & Coalesce(ThisItem.Capability.Value, "—")`),
          ]),
          cell(n("celMine1"), cols[1], [strong(n("lblMineAlloc"), `ThisItem.Allocation & "%"`)]),
          cell(n("celMine2"), cols[2], [label(n("lblMineFrom"), `Text(ThisItem.StartDate, "dd mmm yyyy")`)]),
          cell(n("celMine3"), cols[3], [label(n("lblMineTo"), `If(ThisItem.EffEnd = gFarFuture, "Open-ended", Text(ThisItem.EffEnd, "dd mmm yyyy"))`)]),
          cell(n("celMine4"), cols[4], [
            hbox(n("conMinePills"), { gap: 6, Height: 24, FillPortions: 0, LayoutMinHeight: 0 }, [statusPill(n("pilMineStatus"), "ThisItem.ProjStatus"), ragPill(n("pilMineRag"), "ThisItem.ProjRAG")]),
          ]),
          cell(n("celMine5"), cols[5], [label(n("lblMineGap"), '""')]),
        ], {
          height: 60,
          onSelect: openAssignment("ThisItem"),
          overlayWidth: "Parent.TemplateWidth - 60",
          after: [
            button(n("btnMineOpen"), str("›"), "tertiary", {
              X: "Parent.TemplateWidth - 52",
              Y: 14,
              Width: 32,
              Height: 32,
              Size: 16,
              PaddingLeft: 0,
              PaddingRight: 0,
              Tooltip: str("Open project"),
              OnSelect: openProject("ThisItem.Project.Id"),
            }),
          ],
        }), { Height: "Self.AllItemsCount * 60", FillPortions: 0 }),
        emptyState(n, "Mine", `CountRows(${gal}.AllItems) = 0`, "No assignments yet", "Join a project or log a new one.", ICONS.briefcase, 160),
      ]),
    ],
    overlays: [assignmentDialog(n)],
  });
}
