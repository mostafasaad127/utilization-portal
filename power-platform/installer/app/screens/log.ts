import { button, datePicker, hbox, input, label, rect, type Screen, str, vbox } from "../dsl.ts";
import { STATUSES } from "../../src/schema.ts";
import { REBUILD_MINE } from "../theme.ts";
import { caption, card, field, fieldError, link, namer, page, panelHeader, picker, pickerHeight, segmented, segmentedFrom } from "../ui.ts";
import { allocOk, lookupRef } from "./shared.ts";

const n = namer("Log");
const P = "LookUp(colProjects, ID = gEditProjectId)";
const EDIT = "(gEditProjectId > 0)";

const name = n("txtName");
const leads = n("txtLeads");
const scope = n("txtScope");
const ds = n("dteStart");
const de = n("dteEnd");
const alloc = n("txtAlloc");

const LOS_ITEMS = "Filter(colLoS, IsBlank(Territory.Id) || Territory.Id = locTerritory)";

const V = {
  name: `Len(Trim(${name}.Text)) > 0`,
  client: "(locClient > 0 || !IsBlank(locClientNew))",
  territory: "locTerritory > 0",
  start: `!IsBlank(${ds}.SelectedDate)`,
  end: `(IsBlank(${de}.SelectedDate) || IsBlank(${ds}.SelectedDate) || ${de}.SelectedDate >= ${ds}.SelectedDate)`,
  alloc: `(${EDIT} || ${allocOk(alloc)})`,
};
const VALID = Object.values(V).join(" && ");
const DUPLICATE = `CountRows(Filter(colProjects, Lower(Title) = Lower(Trim(${name}.Text)) && Client.Id = locClient && ID <> gEditProjectId)) > 0`;

const SAVE = `UpdateContext({locTried: true});
If(${VALID},
    Set(varBusy, true);
    IfError(
        If(!IsBlank(locClientNew),
            With({c: Patch('UP Clients', Defaults('UP Clients'), {Title: locClientNew, Industry: ${lookupRef("locIndustry", "colIndustries")}})},
                Collect(colClients, c);
                UpdateContext({locClient: c.ID, locClientNew: Blank()})));
        With({rec: {
                Title: Trim(${name}.Text),
                Client: {Id: locClient, Value: LookUp(colClients, ID = locClient).Title},
                Territory: {Id: locTerritory, Value: LookUp(colTerritories, ID = locTerritory).Title},
                Industry: ${lookupRef("locIndustry", "colIndustries")},
                LineOfService: ${lookupRef("locLoS", "colLoS")},
                ProjectStatus: {Value: locStatus},
                RAG: {Value: locRag},
                StartDate: ${ds}.SelectedDate,
                EndDate: ${de}.SelectedDate,
                MultiTower: locMulti,
                EngagementLeads: Trim(${leads}.Text),
                Scope: ${scope}.Text
            }},
            If(${EDIT},
                With({r: Patch('UP Projects', LookUp('UP Projects', ID = gEditProjectId), rec)},
                    Patch(colProjects, LookUp(colProjects, ID = gEditProjectId), r);
                    Set(gProjectId, r.ID)),
                With({r: Patch('UP Projects', Defaults('UP Projects'), rec)},
                    Collect(colProjects, r);
                    Collect(colAssignments, Patch('UP Assignments', Defaults('UP Assignments'), {
                        Title: User().FullName & " · " & r.Title,
                        Project: {Id: r.ID, Value: r.Title},
                        Person: {Id: gMe.ID, Value: gMe.Title},
                        PersonEmail: gMeEmail,
                        Capability: ${lookupRef("locCap", "colCapabilities")},
                        Allocation: Value(${alloc}.Text),
                        StartDate: ${ds}.SelectedDate,
                        EndDate: ${de}.SelectedDate
                    }));
                    Set(gProjectId, r.ID))));
        ${REBUILD_MINE};
        Set(varBusy, false);
        Notify(If(${EDIT}, "Project saved", "Project logged. You're on the team."), NotificationType.Success, 3000);
        Set(gProjectTab, "Overview");
        Navigate(scrProject, ScreenTransition.None),
        Set(varBusy, false);
        Notify("Couldn't save: " & FirstError.Message, NotificationType.Error)
    ),
    Notify("Please fix the highlighted fields", NotificationType.Warning, 2500)
)`;

const ON_VISIBLE = `If(${EDIT},
    UpdateContext({
        locClient: ${P}.Client.Id, locClientNew: Blank(), locTerritory: ${P}.Territory.Id,
        locIndustry: Coalesce(${P}.Industry.Id, 0), locLoS: Coalesce(${P}.LineOfService.Id, 0),
        locStatus: ${P}.ProjectStatus.Value, locRag: ${P}.RAG.Value, locMulti: ${P}.MultiTower,
        locEndBlank: false, locTried: false
    }),
    UpdateContext({
        locClient: 0, locClientNew: Blank(), locTerritory: Coalesce(gMe.Territory.Id, First(colTerritories).ID),
        locIndustry: 0, locLoS: 0, locStatus: "Active", locRag: "Green", locMulti: false,
        locCap: Coalesce(gMe.PrimaryCapability.Id, 0), locAllocDefault: 100, locEndBlank: false, locTried: false
    })
);
Reset(${name}); Reset(${leads}); Reset(${scope}); Reset(${ds}); Reset(${de}); Reset(${alloc});
Reset(${n("txtPickClient")}); Reset(${n("txtPickIndustry")}); Reset(${n("txtPickLoS")})`;

const err = (cond: string) => `locTried && !(${cond})`;

const hClient = pickerHeight(n, "Client", "locClient", "colClients", "Title", true, "locClientNew") + ` + If(${err(V.client)}, 20, 0)`;
const hIndustry = pickerHeight(n, "Industry", "locIndustry", "colIndustries", "Title");
const hLoS = pickerHeight(n, "LoS", "locLoS", LOS_ITEMS, "Title");

export default function logProject(): Screen {
  const rowClient = `Max(${hClient}, 18 + 6 + RoundUp(Max(1, CountRows(colTerritories)) / 4, 0) * 42)`;
  const rowIndustry = `Max(${hIndustry}, ${hLoS})`;
  const details = card(
    n("conDetails"),
    `52 + 1 + 20 + 64 + If(${err(V.name)}, 20, 0) + 20 + ${n("conRowClient")}.Height + 20 + ${n("conRowIndustry")}.Height + 20 + 84 + 20 + 64 + 20 + 64 + 20 + 18 + 6 + 110 + 24`,
    [
      panelHeader(n, "Det", "Project details", "Everything the old spreadsheet captured, in one place"),
      rect(n("rectDet"), "gLine", { Height: 1, FillPortions: 0 }),
      vbox(n("conDetBody"), { pad: 20, gap: 20, FillPortions: 1 }, [
        field(
          n,
          "Name",
          "Project name",
          [input(name, { Default: `If(${EDIT}, ${P}.Title, "")`, HintText: str("e.g. Audit Analytics Program – Phase 3 Analytics") }), fieldError(n, "NameE", "Enter a project name", err(V.name))],
          { required: true, height: `64 + If(${err(V.name)}, 20, 0)`, props: { FillPortions: 0 } },
        ),
        hbox(n("conRowClient"), { gap: 24, align: "Start", Height: rowClient, FillPortions: 0, LayoutMinHeight: 0 }, [
          field(
            n,
            "Client",
            "Client",
            [
              ...picker(n, "Client", {
                items: "colClients",
                text: "Title",
                sub: `Coalesce(ThisItem.Industry.Value, "No industry set") & If(ThisItem.IsInternal, " · Internal", "")`,
                state: "locClient",
                hint: "Start typing a client name",
                allowNew: { state: "locClientNew", label: "client" },
                onPick: "UpdateContext({locIndustry: Coalesce(ThisItem.Industry.Id, locIndustry)})",
              }),
              fieldError(n, "ClientE", "Choose a client or add a new one", err(V.client)),
            ],
            { required: true, height: hClient },
          ),
          field(n, "Territory", "Territory", [segmentedFrom(n, "Territory", "colTerritories", "Title", "locTerritory", { perRow: 4, itemWidth: 96, onPick: "UpdateContext({locLoS: 0})" })], {
            required: true,
            height: `18 + 6 + RoundUp(Max(1, CountRows(colTerritories)) / 4, 0) * 42`,
          }),
        ]),
        hbox(n("conRowIndustry"), { gap: 24, align: "Start", Height: rowIndustry, FillPortions: 0, LayoutMinHeight: 0 }, [
          field(n, "Industry", "Industry", picker(n, "Industry", { items: "colIndustries", text: "Title", state: "locIndustry", hint: "Search industries" }), { height: hIndustry }),
          field(n, "LoS", "Line of service", picker(n, "LoS", { items: LOS_ITEMS, text: "Title", state: "locLoS", hint: "Search lines of service" }), { height: hLoS }),
        ]),
        hbox(n("conRowDates"), { gap: 24, align: "Start", Height: 84, FillPortions: 0, LayoutMinHeight: 0 }, [
          field(n, "Start", "Start date", [datePicker(ds, { DefaultDate: `If(${EDIT}, ${P}.StartDate, Today())` }), fieldError(n, "StartE", "Pick a start date", err(V.start))], {
            required: true,
            height: 84,
          }),
          field(
            n,
            "End",
            "End date",
            [
              hbox(n("conEndRow"), { gap: 8, Height: 40, FillPortions: 0, LayoutMinHeight: 0 }, [
                datePicker(de, { DefaultDate: `If(locEndBlank, Blank(), If(${EDIT}, ${P}.EndDate, Blank()))`, FillPortions: 1, LayoutMinWidth: 0 }),
                link(n("lnkEndClear"), str("Clear"), `UpdateContext({locEndBlank: true}); Reset(${de})`, { Visible: `!IsBlank(${de}.SelectedDate)` }),
              ]),
              fieldError(n, "EndE", "End date is before the start date", err(V.end)),
              label(n("lblEndHint"), str("Leave empty if it's open-ended"), { size: 9, color: "gMuted", Height: 16, Visible: `!(${err(V.end)})` }),
            ],
            { height: 84 },
          ),
        ]),
        hbox(n("conRowStatus"), { gap: 24, align: "Start", Height: 64, FillPortions: 0, LayoutMinHeight: 0 }, [
          field(n, "Status", "Status", [segmented(n, "Status", STATUSES, "locStatus")], { required: true }),
          field(n, "Rag", "RAG", [segmented(n, "Rag", ["Green", "Amber", "Red"], "locRag")], { required: true }),
        ]),
        hbox(n("conRowLeads"), { gap: 24, align: "Start", Height: 64, FillPortions: 0, LayoutMinHeight: 0 }, [
          field(n, "Leads", "Engagement lead / partner", [input(leads, { Default: `If(${EDIT}, ${P}.EngagementLeads, "")`, HintText: str("Names, separated by commas") })]),
          field(n, "Multi", "Multi-tower", [
            button(n("btnMulti"), `If(locMulti, "☑  Yes, this spans several towers", "☐  No, a single tower")`, "ghost", {
              Width: 280,
              Align: "Align.Left",
              Color: "If(locMulti, gPrimary, gBody)",
              BorderColor: "If(locMulti, gPrimary, gInputBorder)",
              Fill: "If(locMulti, gPrimaryTint, gCard)",
              OnSelect: "UpdateContext({locMulti: !locMulti})",
            }),
          ]),
        ]),
        field(n, "Scope", "Project scope", [input(scope, { Mode: "TextMode.MultiLine", Height: 110, Default: `If(${EDIT}, ${P}.Scope, "")`, HintText: str("What the team is delivering") })], {
          height: 18 + 6 + 110,
          props: { FillPortions: 0 },
        }),
      ]),
    ],
  );
  const role = card(
    n("conRole"),
    `52 + 1 + 20 + 18 + 6 + RoundUp(Max(1, CountRows(colCapabilities)) / 6, 0) * 42 + 20 + 64 + If(${err(V.alloc)}, 20, 0) + 24`,
    [
      panelHeader(n, "Role", "Your role on it", "You're added to the team automatically"),
      rect(n("rectRole"), "gLine", { Height: 1, FillPortions: 0 }),
      vbox(n("conRoleBody"), { pad: 20, gap: 20, FillPortions: 1 }, [
        field(n, "Cap", "Capability", [segmentedFrom(n, "Cap", "colCapabilities", "Title", "locCap", { perRow: 6, itemWidth: 96 })], {
          height: `18 + 6 + RoundUp(Max(1, CountRows(colCapabilities)) / 6, 0) * 42`,
          props: { FillPortions: 0 },
        }),
        field(
          n,
          "Alloc",
          "Allocation %",
          [
            hbox(n("conAllocRow"), { gap: 8, Height: 40, FillPortions: 0, LayoutMinHeight: 0 }, [
              input(alloc, { Default: "Text(locAllocDefault)", Format: "TextFormat.Number", Width: 110, FillPortions: 0 }),
              ...[25, 50, 75, 100].map((v) =>
                button(n(`btnAlloc${v}`), str(`${v}%`), "ghost", {
                  Width: 64,
                  Fill: `If(${alloc}.Text = "${v}", gPrimaryTint, gCard)`,
                  Color: `If(${alloc}.Text = "${v}", gPrimary, gBody)`,
                  BorderColor: `If(${alloc}.Text = "${v}", gPrimary, gInputBorder)`,
                  OnSelect: `UpdateContext({locAllocDefault: ${v}}); Reset(${alloc})`,
                }),
              ),
              caption(n("lblAllocHint"), str("Share of your working week, 0–200"), { Width: 220, PaddingLeft: 8 }),
            ]),
            fieldError(n, "AllocE", "Enter a number from 0 to 200", err(V.alloc)),
          ],
          { required: true, height: `64 + If(${err(V.alloc)}, 20, 0)`, props: { FillPortions: 0 } },
        ),
      ]),
    ],
    { Visible: `!${EDIT}` },
  );
  return page({
    key: "Log",
    screen: "scrLog",
    nav: "log",
    title: `If(${EDIT}, "Edit project", "Log a project")`,
    subtitle: `If(${EDIT}, ${P}.Title, "Add a project you're working on. You'll be added to its team.")`,
    breadcrumb: { text: `If(${EDIT}, "Project", "Projects")`, onSelect: `If(${EDIT}, Navigate(scrProject, ScreenTransition.None), Navigate(scrProjects, ScreenTransition.None))` },
    onVisible: ON_VISIBLE,
    actions: [
      button(n("btnCancel"), str("Cancel"), "ghost", { Width: 96, OnSelect: "Back()" }),
      button(n("btnSave"), `If(varBusy, "Saving…", If(${EDIT}, "Save changes", "Log project"))`, "primary", {
        Width: 140,
        DisplayMode: "If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)",
        OnSelect: SAVE,
      }),
    ],
    content: [
      vbox(n("conDup"), { Visible: DUPLICATE, Height: 52, FillPortions: 0, LayoutMinHeight: 0, Fill: "gAmberTint", radius: 8, pad: [0, 20], justify: "Center" }, [
        hbox(n("conDupRow"), { gap: 12, Height: 32, FillPortions: 0, LayoutMinHeight: 0 }, [
          label(n("lblDup"), str("A project with this name already exists for this client. Did you mean to join it?"), { color: "gAmber", FillPortions: 1, LayoutMinWidth: 0 }),
          link(
            n("lnkDup"),
            str("Open it"),
            `Set(gProjectId, LookUp(colProjects, Lower(Title) = Lower(Trim(${name}.Text)) && Client.Id = locClient).ID); Set(gProjectTab, "Overview"); Navigate(scrProject, ScreenTransition.None)`,
          ),
        ]),
      ]),
      details,
      role,
      hbox(n("conFooter"), { Height: 40, FillPortions: 0, LayoutMinHeight: 0, gap: 12, justify: "End" }, [
        caption(n("lblFooter"), str("Fields marked * are required"), { FillPortions: 1, LayoutMinWidth: 0 }),
        button(n("btnCancel2"), str("Cancel"), "ghost", { Width: 96, OnSelect: "Back()" }),
        button(n("btnSave2"), `If(varBusy, "Saving…", If(${EDIT}, "Save changes", "Log project"))`, "primary", {
          Width: 140,
          DisplayMode: "If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)",
          OnSelect: `Select(${n("btnSave")})`,
        }),
      ]),
    ],
  });
}
