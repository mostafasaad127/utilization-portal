/** Navigation helpers and pieces shared by several screens. */
import { button, datePicker, hbox, input, label, str, type Ctl } from "../dsl.ts";
import { REBUILD_MINE } from "../theme.ts";
import { dialog, field, type Namer, segmentedFrom } from "../ui.ts";

export const openProject = (idExpr: string, tab = "Overview") =>
  `Set(gProjectId, ${idExpr}); Set(gProjectTab, "${tab}"); Navigate(scrProject, ScreenTransition.None)`;

/** Lookup value for SharePoint: {Id, Value}, or blank when nothing is chosen. */
export const lookupRef = (idVar: string, coll: string) =>
  `If(${idVar} > 0, {Id: ${idVar}, Value: LookUp(${coll}, ID = ${idVar}).Title}, Blank())`;

/** Wraps a save in busy state + error toast. */
export const guarded = (body: string, success: string) => `Set(varBusy, true);
IfError(
    ${body};
    Set(varBusy, false);
    Notify(${str(success)}, NotificationType.Success, 2500),
    Set(varBusy, false);
    Notify("Couldn't save: " & FirstError.Message, NotificationType.Error)
)`;

/** Allocation 0–200 check for a text input. */
export const allocOk = (txt: string) => `(IsNumeric(${txt}.Text) && Value(${txt}.Text) >= 0 && Value(${txt}.Text) <= 200)`;

/**
 * Edit an assignment: capability, allocation, dates, or remove it.
 * Open it with UpdateContext({locAsgId: <ID>, locAsgCap: …, locAsgOpen: …, locAsgConfirm: false}).
 */
export function assignmentDialog(n: Namer): Ctl {
  const A = "LookUp(colAssignments, ID = locAsgId)";
  const alloc = n("txtAsgAlloc");
  const ds = n("dteAsgStart");
  const de = n("dteAsgEnd");
  const valid = `${allocOk(alloc)} && !IsBlank(${ds}.SelectedDate) && (locAsgOpen || IsBlank(${de}.SelectedDate) || ${de}.SelectedDate >= ${ds}.SelectedDate)`;
  const save = guarded(
    `With({r: Patch('UP Assignments', LookUp('UP Assignments', ID = locAsgId), {
        Allocation: Value(${alloc}.Text),
        StartDate: ${ds}.SelectedDate,
        EndDate: If(locAsgOpen, Blank(), ${de}.SelectedDate),
        Capability: ${lookupRef("locAsgCap", "colCapabilities")}
    })}, Patch(colAssignments, LookUp(colAssignments, ID = locAsgId), r));
    ${REBUILD_MINE};
    UpdateContext({locAsgId: 0})`,
    "Assignment updated",
  );
  const remove = `If(!locAsgConfirm, UpdateContext({locAsgConfirm: true}),
    ${guarded(
      `Remove('UP Assignments', LookUp('UP Assignments', ID = locAsgId));
    RemoveIf(colAssignments, ID = locAsgId);
    ${REBUILD_MINE};
    UpdateContext({locAsgId: 0, locAsgConfirm: false})`,
      "Assignment removed",
    )})`;
  return dialog(
    n,
    "Asg",
    "locAsgId > 0",
    `"Edit assignment · " & ${A}.Project.Value`,
    "UpdateContext({locAsgId: 0, locAsgConfirm: false})",
    [
      label(n("lblAsgWho"), `${A}.Person.Value & " · " & ${A}.Project.Value`, { size: 10, color: "gMuted", Height: 18 }),
      field(n, "AsgCap", "Capability", [segmentedFrom(n, "AsgCap", "colCapabilities", "Title", "locAsgCap", { perRow: 6, itemWidth: 84 })], { height: 18 + 6 + 42, props: { FillPortions: 0 } }),
      hbox(n("conAsgRow"), { gap: 16, Height: 18 + 6 + 40 + 20, FillPortions: 0, LayoutMinHeight: 0, align: "Start" }, [
        field(n, "AsgAlloc", "Allocation %", [input(alloc, { Default: `Text(${A}.Allocation)`, Format: "TextFormat.Number" })], {
          required: true,
          error: ["Enter 0–200", `!${allocOk(alloc)}`],
        }),
        field(n, "AsgStart", "Start date", [datePicker(ds, { DefaultDate: `${A}.StartDate` })], { required: true, height: 64 }),
        field(n, "AsgEnd", "End date", [datePicker(de, { DefaultDate: `${A}.EndDate`, DisplayMode: "If(locAsgOpen, DisplayMode.Disabled, DisplayMode.Edit)" })], {
          error: ["End date is before the start", `!locAsgOpen && !IsBlank(${de}.SelectedDate) && ${de}.SelectedDate < ${ds}.SelectedDate`],
        }),
      ]),
      button(n("btnAsgOpen"), `If(locAsgOpen, "☑  No end date (open-ended)", "☐  No end date (open-ended)")`, "tertiary", {
        Height: 30,
        Width: 240,
        Color: "gBody",
        FontWeight: "FontWeight.Normal",
        Align: "Align.Left",
        PaddingLeft: 0,
        FillPortions: 0,
        OnSelect: "UpdateContext({locAsgOpen: !locAsgOpen})",
      }),
    ],
    [
      button(n("btnAsgRemove"), `If(locAsgConfirm, "Click again to remove", "Remove from project")`, "danger", { Width: 190, OnSelect: remove }),
      label(n("lblAsgSpacer"), '""', { FillPortions: 1, LayoutMinWidth: 0 }),
      button(n("btnAsgCancel"), str("Cancel"), "ghost", { Width: 96, OnSelect: "UpdateContext({locAsgId: 0, locAsgConfirm: false})" }),
      button(n("btnAsgSave"), `If(varBusy, "Saving…", "Save")`, "primary", {
        Width: 110,
        DisplayMode: `If(varBusy || !(${valid}), DisplayMode.Disabled, DisplayMode.Edit)`,
        OnSelect: save,
      }),
    ],
    { width: 640, height: 460 },
  );
}

/** Opens the assignment dialog for a record (in a gallery: ThisItem). */
export const openAssignment = (rec: string) =>
  `UpdateContext({locAsgId: ${rec}.ID, locAsgCap: Coalesce(${rec}.Capability.Id, 0), locAsgOpen: IsBlank(${rec}.EndDate), locAsgConfirm: false})`;
