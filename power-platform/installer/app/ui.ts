/**
 * Shared building blocks: the page shell (header, navigation, page header)
 * and portal-style components (stat tiles, panels, pills, table rows).
 * Every name is suffixed with the screen key so names stay unique app-wide.
 */
import { button, type Ctl, ctl, GALLERY_VARIANT, withProps, group, hbox, hit, hline, icon, iconImg, image, label, pill, type Props, rect, type Screen, spacer, str, svgUri, T, vbox } from "./dsl.ts";
import { C, REFRESH_ALL } from "./theme.ts";
import { ICONS } from "./icons.ts";

export type Namer = (base: string) => string;
/** Static text, or a formula when prefixed with "=". */
export const fx = (s: string) => (s.startsWith("=") ? s.slice(1) : str(s));
export const namer = (key: string): Namer => (base) => `${base}${key}`;

// ── Pills ──────────────────────────────────────────────────────────────────
export const statusFill = (s: string) =>
  `Switch(${s}, "Active", gPrimaryTint, "Pipeline", gInfoTint, "On hold", gAmberTint, gPage)`;
export const statusColor = (s: string) => `Switch(${s}, "Active", gPrimary, "Pipeline", gInfo, "On hold", gAmber, gBody)`;
export const ragFill = (r: string) => `Switch(${r}, "Green", gGreenTint, "Amber", gAmberTint, "Red", gRedTint, gPage)`;
export const ragColor = (r: string) => `Switch(${r}, "Green", gGreen, "Amber", gAmber, "Red", gRed, gMuted)`;
export const sevFill = (s: string) => `Switch(${s}, "Critical", gRedTint, "High", gRedTint, "Medium", gAmberTint, gPage)`;
export const sevColor = (s: string) => `Switch(${s}, "Critical", gRed, "High", gRed, "Medium", gAmber, gBody)`;

export const statusPill = (name: string, s: string, props: Props = {}) => pill(name, s, statusFill(s), statusColor(s), props);
export const ragPill = (name: string, r: string, props: Props = {}) =>
  pill(name, `If(IsBlank(${r}), "—", "● " & ${r})`, ragFill(r), ragColor(r), props);
export const sevPill = (name: string, s: string, props: Props = {}) => pill(name, s, sevFill(s), sevColor(s), props);

// ── Heat scale (utilization %) ──────────────────────────────────────────────────
export const heatHex = (p: string) =>
  `Switch(true, ${p} <= 0, "#E8E8E8", ${p} < 70, "#FBD5C2", ${p} < 100, "#F39B6D", ${p} = 100, "#D04A02", "#8A2A00")`;

/** 96×6 utilization meter as an SVG image. */
export function meter(name: string, pct: string, props: Props = {}): Ctl {
  return image(
    name,
    `With({p: ${pct}}, "data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 6' preserveAspectRatio='none'>" &
    "<rect width='100' height='6' rx='3' fill='#F3F3F3'/>" &
    "<rect width='" & Min(Max(p, 0), 100) & "' height='6' rx='3' fill='" & ${heatHex("p")} & "'/></svg>"))`,
    { Width: 96, Height: 6, ImagePosition: "ImagePosition.Stretch", ...props },
  );
}

// ── Typography shortcuts ──────────────────────────────────────────────────────
export const h1 = (name: string, text: string, props: Props = {}) => label(name, text, { size: 20, weight: "Semibold", color: "gHeading", Height: 34, ...props });
export const h2 = (name: string, text: string, props: Props = {}) => label(name, text, { size: 13.5, weight: "Semibold", color: "gHeading", Height: 24, ...props });
export const caption = (name: string, text: string, props: Props = {}) => label(name, text, { size: 9, color: "gMuted", Height: 18, ...props });
export const body = (name: string, text: string, props: Props = {}) => label(name, text, { size: 10.5, color: "gBody", Height: 20, ...props });
export const strong = (name: string, text: string, props: Props = {}) => label(name, text, { size: 10.5, weight: "Semibold", color: "gHeading", Height: 20, ...props });

// ── Cards and panels ────────────────────────────────────────────────────────
export function card(name: string, height: string | number, children: Ctl[], props: Props = {}): Ctl {
  return vbox(name, { card: true, Height: height, FillPortions: 0, LayoutMinHeight: 0, LayoutMinWidth: 0, ...props }, children);
}

/** Panel header row: title (+ optional description) on the left, optional control on the right. */
export function panelHeader(n: Namer, id: string, title: string, desc?: string, right?: Ctl[], props: Props = {}): Ctl {
  const titleStack = vbox(n(`conPH${id}Txt`), { gap: 2, FillPortions: 1, LayoutMinWidth: 0, Height: desc ? 46 : 24, justify: "Center" }, [
    h2(n(`lblPH${id}`), fx(title)),
    ...(desc ? [caption(n(`lblPH${id}Desc`), fx(desc))] : []),
  ]);
  return hbox(n(`conPH${id}`), { pad: [18, 20, 10, 20], gap: 12, Height: desc ? 74 : 52, FillPortions: 0, LayoutMinHeight: 0, ...props }, [titleStack, ...(right ?? [])]);
}

/** Small "View all →"-style link. */
export const link = (name: string, text: string, onSelect: string, props: Props = {}) =>
  button(name, text, "tertiary", { OnSelect: onSelect, Height: 28, Size: 10, Width: `Len(Self.Text) * 7 + 20`, ...props });

/** Stat tile (the four tiles at the top of a dashboard). */
export function statTile(n: Namer, id: string, o: { label: string; value: string; unit?: string; detail: string; icon: string; attention?: string }): Ctl {
  const attention = o.attention ?? "false";
  return group(
    n(`grpTile${id}`),
    {
      Height: 124,
      FillPortions: 1,
      LayoutMinWidth: 180,
      Fill: "gCard",
      BorderColor: "gLine",
      BorderThickness: 1,
      RadiusTopLeft: 8,
      RadiusTopRight: 8,
      RadiusBottomLeft: 8,
      RadiusBottomRight: 8,
    },
    [
      rect(n(`rectTile${id}Accent`), "gRed", { X: 0, Y: 12, Width: 3, Height: 100, Visible: attention }),
      label(n(`lblTile${id}`), fx(o.label), { size: 10, color: "gMuted", X: 20, Y: 18, Width: "Parent.Width - 64", Height: 20 }),
      iconImg(n(`imgTile${id}`), `If(${attention}, ${icon(o.icon, C.red)}, ${icon(o.icon, C.muted)})`, 20, { X: "Parent.Width - 40", Y: 18 }),
      label(n(`lblTile${id}Value`), o.value, {
        size: 22,
        weight: "Semibold",
        color: "gHeading",
        X: 20,
        Y: 44,
        Width: o.unit ? "Len(Self.Text) * 15 + 6" : "Parent.Width - 40",
        Height: 40,
      }),
      ...(o.unit
        ? [label(n(`lblTile${id}Unit`), o.unit, { size: 11, color: "gMuted", X: `Len(${n(`lblTile${id}Value`)}.Text) * 15 + 26`, Y: 56, Width: 60, Height: 22 })]
        : []),
      label(n(`lblTile${id}Detail`), o.detail, { size: 9, color: "gMuted", X: 20, Y: 88, Width: "Parent.Width - 40", Height: 20 }),
    ],
  );
}

/** Centered empty state (icon, title, hint) for galleries. */
export function emptyState(n: Namer, id: string, visible: string, title: string, hint: string, ico = ICONS.check, height = 150): Ctl {
  return vbox(n(`conEmpty${id}`), { Visible: visible, Height: height, FillPortions: 0, LayoutMinHeight: 0, align: "Center", justify: "Center", gap: 6, pad: 16 }, [
    group(n(`grpEmpty${id}Ico`), { Width: 44, Height: 44, Fill: "gPage", RadiusTopLeft: 22, RadiusTopRight: 22, RadiusBottomLeft: 22, RadiusBottomRight: 22 }, [
      iconImg(n(`imgEmpty${id}`), icon(ico, C.muted), 20, { X: 12, Y: 12 }),
    ]),
    label(n(`lblEmpty${id}`), fx(title), { size: 11, weight: "Semibold", color: "gHeading", Align: "Align.Center", Width: 420, Height: 22 }),
    label(n(`lblEmpty${id}Hint`), fx(hint), { size: 9.5, color: "gMuted", Align: "Align.Center", Width: 420, Height: 20 }),
  ]);
}

/** Field label with optional required asterisk. */
export function fieldLabel(n: Namer, id: string, text: string, required = false): Ctl {
  return label(n(`lblF${id}`), required ? str(`${text} *`) : str(text), { size: 10, color: "gBody", Height: 18 });
}

/** Error text under a field. */
export function fieldError(n: Namer, id: string, text: string, visible: string): Ctl {
  return label(n(`lblF${id}Err`), str(text), { size: 9, color: "gRed", Height: 16, Visible: visible });
}

/** A vertical form field: label, control(s), optional error. */
export function field(n: Namer, id: string, text: string, controls: Ctl[], o: { required?: boolean; error?: [string, string]; height?: string | number; props?: Props } = {}): Ctl {
  const h = o.height ?? 18 + 6 + 40 + (o.error ? 20 : 0);
  return vbox(n(`conF${id}`), { gap: 6, Height: h, FillPortions: 1, LayoutMinWidth: 0, LayoutMinHeight: 0, ...(o.props ?? {}) }, [
    fieldLabel(n, id, text, o.required),
    ...controls,
    ...(o.error ? [fieldError(n, id, o.error[0], o.error[1])] : []),
  ]);
}

/**
 * Segmented choice: one button per option (static options). `state` is the
 * context variable holding the selected value.
 */
export function segmented(n: Namer, id: string, options: string[], state: string, props: Props = {}, onPick = ""): Ctl {
  return hbox(n(`conSeg${id}`), { gap: 6, Height: 40, FillPortions: 0, LayoutMinWidth: 0, LayoutMinHeight: 0, ...props }, options.map((o, i) =>
    button(n(`btnSeg${id}${i}`), str(o), "ghost", {
      Height: 36,
      Width: Math.max(64, o.length * 7.5 + 28),
      PaddingLeft: 10,
      PaddingRight: 10,
      Fill: `If(${state} = ${str(o)}, gPrimaryTint, gCard)`,
      Color: `If(${state} = ${str(o)}, gPrimary, gBody)`,
      BorderColor: `If(${state} = ${str(o)}, gPrimary, gInputBorder)`,
      HoverFill: `If(${state} = ${str(o)}, gPrimaryTint, gPage)`,
      HoverColor: `If(${state} = ${str(o)}, gPrimary, gHeading)`,
      FontWeight: `If(${state} = ${str(o)}, FontWeight.Semibold, FontWeight.Normal)`,
      OnSelect: `UpdateContext({${state}: ${str(o)}})${onPick ? "; " + onPick : ""}`,
    }),
  ));
}

/**
 * Segmented choice over a collection (reference data): a wrapping gallery of
 * buttons. `state` holds the selected record's ID; text is shown from `textCol`.
 */
export function segmentedFrom(n: Namer, id: string, items: string, textCol: string, state: string, o: { perRow?: number; itemWidth?: number; props?: Props; onPick?: string } = {}): Ctl {
  const perRow = o.perRow ?? 6;
  const w = o.itemWidth ?? 92;
  return ctl(
    T.gallery,
    n(`galSeg${id}`),
    {
      Items: items,
      WrapCount: perRow,
      TemplateSize: 42,
      TemplatePadding: 0,
      Width: perRow * w,
      Height: `RoundUp(Max(1, CountRows(Self.AllItems)) / ${perRow}, 0) * 42`,
      ShowScrollbar: false,
      ShowNavigation: false,
      BorderThickness: 0,
      Fill: "Color.Transparent",
      TemplateFill: "Color.Transparent",
      FillPortions: 0,
      LayoutMinHeight: 0,
      ...(o.props ?? {}),
    },
    [
      button(n(`btnSeg${id}`), `ThisItem.${textCol}`, "ghost", {
        X: 0,
        Y: 0,
        Width: "Parent.TemplateWidth - 6",
        Height: 36,
        PaddingLeft: 6,
        PaddingRight: 6,
        Fill: `If(${state} = ThisItem.ID, gPrimaryTint, gCard)`,
        Color: `If(${state} = ThisItem.ID, gPrimary, gBody)`,
        BorderColor: `If(${state} = ThisItem.ID, gPrimary, gInputBorder)`,
        HoverFill: `If(${state} = ThisItem.ID, gPrimaryTint, gPage)`,
        HoverColor: `If(${state} = ThisItem.ID, gPrimary, gHeading)`,
        FontWeight: `If(${state} = ThisItem.ID, FontWeight.Semibold, FontWeight.Normal)`,
        OnSelect: `UpdateContext({${state}: ThisItem.ID})${o.onPick ? "; " + o.onPick : ""}`,
      }),
    ],
    GALLERY_VARIANT,
  );
}

/**
 * Searchable picker over a collection (clients, industries, projects …).
 * Shows a chip when something is selected, otherwise a search box with up to
 * five matches. `state` holds the selected ID (0 = none).
 */
export function picker(
  n: Namer,
  id: string,
  o: { items: string; text: string; sub?: string; state: string; hint: string; allowNew?: { state: string; label: string }; onPick?: string },
): Ctl[] {
  const txt = n(`txtPick${id}`);
  const gal = n(`galPick${id}`);
  const selectedText = `LookUp(${o.items}, ID = ${o.state}).${o.text}`;
  const hasSel = o.allowNew ? `(${o.state} > 0 || !IsBlank(${o.allowNew.state}))` : `(${o.state} > 0)`;
  const matches = `FirstN(Filter(${o.items}, StartsWith(${o.text}, ${txt}.Text) || ${str(" ")} & ${txt}.Text in ${str(" ")} & ${o.text}), 5)`;
  const showList = `!${hasSel} && Len(${txt}.Text) > 0`;
  const newRow = o.allowNew ? `CountRows(Filter(${o.items}, Lower(${o.text}) = Lower(Trim(${txt}.Text)))) = 0` : "false";
  return [
    // Selected chip
    hbox(n(`conPick${id}Chip`), { Visible: hasSel, Height: 40, FillPortions: 0, LayoutMinHeight: 0, gap: 8, pad: [0, 8, 0, 12], Fill: "gPrimaryTint", BorderColor: "gPrimary", BorderThickness: 1, radius: 6 }, [
      label(n(`lblPick${id}Chip`), o.allowNew ? `Coalesce(${selectedText}, ${o.allowNew.state} & "  (new)")` : selectedText, {
        weight: "Semibold",
        color: "gHeading",
        FillPortions: 1,
        LayoutMinWidth: 0,
      }),
      button(n(`btnPick${id}Clear`), str("Change"), "tertiary", {
        Height: 28,
        Size: 9.5,
        Width: 72,
        OnSelect: `UpdateContext({${o.state}: 0${o.allowNew ? `, ${o.allowNew.state}: Blank()` : ""}}); Reset(${txt})`,
      }),
    ]),
    // Search box
    ctl(T.input, txt, {
      Visible: `!${hasSel}`,
      Default: '""',
      HintText: str(o.hint),
      Font: "gFont",
      Size: 10.5,
      Color: "gHeading",
      Fill: "gCard",
      HoverFill: "gCard",
      BorderColor: "gInputBorder",
      HoverBorderColor: "gInputHover",
      FocusedBorderColor: "gPrimary",
      FocusedBorderThickness: 2,
      BorderThickness: 1,
      RadiusTopLeft: 6,
      RadiusTopRight: 6,
      RadiusBottomLeft: 6,
      RadiusBottomRight: 6,
      PaddingLeft: 12,
      Height: 40,
      Clear: true,
      DelayOutput: false,
      FillPortions: 0,
    }),
    // Matches
    ctl(
      T.gallery,
      gal,
      {
        Visible: showList,
        Items: matches,
        TemplateSize: o.sub ? 48 : 38,
        TemplatePadding: 0,
        Height: `Max(1, CountRows(Self.AllItems)) * ${o.sub ? 48 : 38} + 2`,
        ShowScrollbar: false,
        ShowNavigation: false,
        BorderColor: "gLine",
        BorderThickness: 1,
        Fill: "gCard",
        TemplateFill: "Color.Transparent",
        FillPortions: 0,
        LayoutMinHeight: 0,
      },
      [
        label(n(`lblPick${id}Item`), `ThisItem.${o.text}`, { X: 12, Y: o.sub ? 6 : 0, Width: "Parent.TemplateWidth - 24", Height: o.sub ? 20 : 38, color: "gHeading" }),
        ...(o.sub ? [caption(n(`lblPick${id}ItemSub`), o.sub, { X: 12, Y: 26, Width: "Parent.TemplateWidth - 24" })] : []),
        hit(n(`btnPick${id}Item`), `UpdateContext({${o.state}: ThisItem.ID}); Reset(${txt})${o.onPick ? "; " + o.onPick : ""}`, {
          X: 0,
          Y: 0,
          Width: "Parent.TemplateWidth",
          Height: "Parent.TemplateHeight",
        }),
      ],
      GALLERY_VARIANT,
    ),
    ...(o.allowNew
      ? [
          button(n(`btnPick${id}New`), `"+ Add “" & Trim(${txt}.Text) & "” as a new ${o.allowNew.label}"`, "tertiary", {
            Visible: `${showList} && ${newRow}`,
            Height: 32,
            Size: 10,
            Align: "Align.Left",
            FillPortions: 0,
            OnSelect: `UpdateContext({${o.allowNew.state}: Trim(${txt}.Text), ${o.state}: 0})`,
          }),
        ]
      : []),
  ];
}

/** Height a picker field occupies (label + chip/search + matches). */
export function pickerHeight(n: Namer, id: string, state: string, items: string, text: string, sub = false, allowNew?: string): string {
  const txt = n(`txtPick${id}`);
  const hasSel = allowNew ? `(${state} > 0 || !IsBlank(${allowNew}))` : `(${state} > 0)`;
  const rows = `CountRows(FirstN(Filter(${items}, StartsWith(${text}, ${txt}.Text) || " " & ${txt}.Text in " " & ${text}), 5))`;
  const extra = allowNew ? ` + If(CountRows(Filter(${items}, Lower(${text}) = Lower(Trim(${txt}.Text)))) = 0, 38, 0)` : "";
  return `18 + 6 + 40 + If(!${hasSel} && Len(${txt}.Text) > 0, 6 + Max(1, ${rows}) * ${sub ? 48 : 38} + 2${extra}, 0)`;
}

// ── Page shell ──────────────────────────────────────────────────────────────
type NavKey = "home" | "projects" | "join" | "log" | "profile" | "team";
const NAV: { key: NavKey; label: string; screen: string; icon: string; admin?: boolean }[] = [
  { key: "home", label: "My dashboard", screen: "scrHome", icon: ICONS.dashboard },
  { key: "projects", label: "Projects", screen: "scrProjects", icon: ICONS.projects },
  { key: "join", label: "Join a project", screen: "scrJoin", icon: ICONS.join },
  { key: "log", label: "Log a project", screen: "scrLog", icon: ICONS.plus },
  { key: "profile", label: "My profile", screen: "scrProfile", icon: ICONS.profile },
  { key: "team", label: "Team overview", screen: "scrTeam", icon: ICONS.utilization, admin: true },
];

const PWC_LOGO = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 92 44'><g transform='skewX(-28)'>` +
    `<rect x='58' y='2' width='30' height='5' fill='#FD5108'/><rect x='64' y='9' width='24' height='5' fill='#E0301E'/>` +
    `<rect x='52' y='9' width='10' height='5' fill='#FFB600'/></g>` +
    `<text x='2' y='38' fill='#252525' font-family='Georgia, Times New Roman, serif' font-weight='700' font-size='30' letter-spacing='-1'>pwc</text></svg>`,
);

function header(n: Namer): Ctl {
  return hbox(n("conHeader"), { Height: 60, FillPortions: 0, LayoutMinHeight: 0, Fill: "gCard", pad: [0, 24], gap: 16 }, [
    image(n("imgLogo"), PWC_LOGO, { Width: 58, Height: 28, AccessibleLabel: str("PwC") }),
    rect(n("rectHeaderDiv"), "gLine", { Width: 1, Height: 26 }),
    label(n("lblAppName"), str("Utilization Portal"), { size: 13, weight: "Semibold", color: "gHeading", Width: 200, Height: 26 }),
    spacer(n("spcHeader")),
    pill(n("pilFY"), `gFYLabel & " current"`, "gPrimaryTint", "gPrimary", { Height: 26 }),
    group(n("grpRefresh"), { Width: 36, Height: 36 }, [
      iconImg(n("imgRefresh"), icon(ICONS.refresh, C.body), 18, { X: 9, Y: 9 }),
      hit(n("btnRefresh"), REFRESH_ALL + `;\nNotify("Data refreshed", NotificationType.Success, 2000)`, {
        X: 0,
        Y: 0,
        Width: 36,
        Height: 36,
        RadiusTopLeft: 18,
        RadiusTopRight: 18,
        RadiusBottomLeft: 18,
        RadiusBottomRight: 18,
        HoverFill: "RGBA(0, 0, 0, 0.05)",
        Tooltip: str("Refresh data"),
        AccessibleLabel: str("Refresh data"),
      }),
    ]),
    button(n("btnAvatar"), "gMeInitials", "primary", {
      Width: 36,
      Height: 36,
      PaddingLeft: 0,
      PaddingRight: 0,
      Size: 10,
      RadiusTopLeft: 18,
      RadiusTopRight: 18,
      RadiusBottomLeft: 18,
      RadiusBottomRight: 18,
      Tooltip: "User().FullName",
      OnSelect: "Navigate(scrProfile, ScreenTransition.None)",
    }),
  ]);
}

function navGallery(n: Namer, id: string, items: typeof NAV, active: NavKey, extra: { label: string; key: string; icon: string; onSelect: string; visible: string }[] = []): Ctl {
  const rows = [
    ...items.map((i) => ({ key: i.key, label: i.label, icon: i.icon, on: `Navigate(${i.screen}, ScreenTransition.None)`, visible: "true" })),
    ...extra.map((e) => ({ key: e.key, label: e.label, icon: e.icon, on: e.onSelect, visible: e.visible })),
  ];
  const table = `Filter(Table(\n${rows
    .map((r) => `    {Key: ${str(r.key)}, Label: ${str(r.label)}, Icon: ${icon(r.icon, r.key === active ? C.primary : C.body)}, Show: ${r.visible}}`)
    .join(",\n")}\n), Show)`;
  const nav = `Switch(ThisItem.Key, ${rows.map((r) => `${str(r.key)}, ${r.key === active ? "false" : r.on}`).join(", ")})`;
  const isActive = `ThisItem.Key = ${str(active)}`;
  return ctl(
    T.gallery,
    n(`galNav${id}`),
    {
      Items: table,
      TemplateSize: 42,
      TemplatePadding: 0,
      Height: "CountRows(Self.AllItems) * 42",
      ShowScrollbar: false,
      ShowNavigation: false,
      BorderThickness: 0,
      Fill: "Color.Transparent",
      TemplateFill: "Color.Transparent",
      FillPortions: 0,
      LayoutMinHeight: 0,
    },
    [
      iconImg(n(`imgNav${id}`), "ThisItem.Icon", 18, { X: 14, Y: 12 }),
      label(n(`lblNav${id}`), "ThisItem.Label", {
        X: 44,
        Y: 1,
        Width: "Parent.TemplateWidth - 52",
        Height: 40,
        FontWeight: `If(${isActive}, FontWeight.Semibold, FontWeight.Normal)`,
        Color: `If(${isActive}, gPrimary, gBody)`,
      }),
      rect(n(`rectNav${id}`), "gPrimary", { X: 0, Y: 9, Width: 3, Height: 24, Visible: isActive }),
      hit(n(`btnNav${id}`), nav, {
        X: 0,
        Y: 1,
        Width: "Parent.TemplateWidth",
        Height: 40,
        Fill: `If(${isActive}, RGBA(208, 74, 2, 0.08), Color.Transparent)`,
        HoverFill: `If(${isActive}, RGBA(208, 74, 2, 0.08), RGBA(0, 0, 0, 0.04))`,
        RadiusTopLeft: 4,
        RadiusTopRight: 4,
        RadiusBottomLeft: 4,
        RadiusBottomRight: 4,
        AccessibleLabel: "ThisItem.Label",
      }),
    ],
    GALLERY_VARIANT,
  );
}

function nav(n: Namer, active: NavKey): Ctl {
  const main = NAV.filter((i) => !i.admin);
  const admin = NAV.filter((i) => i.admin);
  return vbox(n("conNav"), { Width: 232, FillPortions: 0, LayoutMinWidth: 0, Fill: "gCard", pad: [16, 12], gap: 2 }, [
    navGallery(n, "Main", main, active),
    label(n("lblNavSection"), str("ADMIN"), { size: 8.5, weight: "Semibold", color: "gMuted", Height: 40, PaddingLeft: 14, PaddingTop: 14, Visible: "gIsAdmin" }),
    withProps(navGallery(n, "Admin", admin, active, [
      { key: "pbi", label: "Power BI report ↗", icon: ICONS.chart, onSelect: "Launch(gPowerBIUrl)", visible: "!IsBlank(gPowerBIUrl)" },
    ]), { Visible: "gIsAdmin" }),
    spacer(n("spcNav"), "V"),
    caption(n("lblNavFoot"), `User().FullName & If(gIsAdmin, " · Admin", "")`, { PaddingLeft: 14, Height: 18 }),
  ]);
}

export interface PageOpts {
  key: string;
  screen: string;
  nav: NavKey;
  title: string; // formula
  subtitle: string; // formula
  breadcrumb?: { text: string; onSelect: string }; // parent link (formula text)
  belowTitle?: Ctl[]; // pills etc. under the title
  actions?: Ctl[];
  headerExtra?: Ctl[]; // e.g. tabs, under the page header
  headerHeight?: number;
  content: Ctl[];
  contentProps?: Props;
  overlays?: Ctl[];
  onVisible?: string;
}

export function page(o: PageOpts): Screen {
  const n = namer(o.key);
  const headerH = o.headerHeight ?? 104 + (o.headerExtra ? 44 : 0);
  const titleStack = vbox(n("conTitle"), { gap: 4, FillPortions: 1, LayoutMinWidth: 0, justify: "Center", Height: headerH - 20 - (o.headerExtra ? 44 : 0) }, [
    ...(o.breadcrumb
      ? [
          hbox(n("conCrumb"), { gap: 4, Height: 18, FillPortions: 0, LayoutMinHeight: 0 }, [
            button(n("btnCrumb"), o.breadcrumb.text, "tertiary", {
              Height: 18,
              Size: 9,
              FontWeight: "FontWeight.Normal",
              Color: "gMuted",
              HoverColor: "gPrimary",
              HoverFill: "Color.Transparent",
              PaddingLeft: 0,
              PaddingRight: 0,
              Width: `Len(Self.Text) * 6 + 4`,
              OnSelect: o.breadcrumb.onSelect,
            }),
            iconImg(n("imgCrumb"), icon(ICONS.chevron, C.muted), 12),
          ]),
        ]
      : []),
    h1(n("lblTitle"), o.title),
    caption(n("lblSubtitle"), o.subtitle, { size: 10, Height: 18 }),
    ...(o.belowTitle ?? []),
  ]);
  const pageHeader = vbox(n("conPageHeader"), { Fill: "gCard", FillPortions: 0, LayoutMinHeight: 0, Height: headerH, pad: [20, 32, 0, 32], gap: 0 }, [
    hbox(n("conPageHeaderRow"), { gap: 12, FillPortions: 1, LayoutMinHeight: 0, align: "Start" }, [
      titleStack,
      hbox(n("conActions"), { gap: 12, Width: 420, FillPortions: 0, Height: 40, justify: "End", AlignInContainer: "AlignInContainer.Center" }, o.actions ?? []),
    ]),
    ...(o.headerExtra ?? []),
  ]);
  const main = vbox(n("conMain"), { FillPortions: 1, LayoutMinWidth: 0, gap: 0 }, [
    pageHeader,
    hline(n("rectPageHeaderLine"), { FillPortions: 0 }),
    vbox(n("conContent"), { FillPortions: 1, LayoutMinHeight: 0, scroll: true, pad: [24, 32], gap: 20, Fill: "gPage", ...(o.contentProps ?? {}) }, o.content),
  ]);
  const root = vbox(n("conRoot"), { X: 0, Y: 0, Width: "Parent.Width", Height: "Parent.Height", Fill: "gPage", gap: 0 }, [
    header(n),
    hline(n("rectHeaderLine"), { FillPortions: 0 }),
    hbox(n("conBody"), { FillPortions: 1, LayoutMinHeight: 0, align: "Stretch", gap: 0 }, [nav(n, o.nav), rect(n("rectNavLine"), "gLine", { Width: 1, FillPortions: 0 }), main]),
  ]);
  const loading = group(n("grpLoading"), { X: 0, Y: 0, Width: "Parent.Width", Height: "Parent.Height", Visible: "varLoading" }, [
    rect(n("rectLoading"), "RGBA(255, 255, 255, 0.6)", { X: 0, Y: 0, Width: "Parent.Width", Height: "Parent.Height" }),
    label(n("lblLoading"), str("Loading…"), { X: "(Parent.Width - 200) / 2", Y: "(Parent.Height - 40) / 2", Width: 200, Height: 40, Align: "Align.Center", size: 12, weight: "Semibold", color: "gPrimary" }),
  ]);
  return {
    name: o.screen,
    props: {
      Fill: "gPage",
      LoadingSpinner: "LoadingSpinner.Data",
      LoadingSpinnerColor: "gPrimary",
      ...(o.onVisible ? { OnVisible: o.onVisible } : {}),
    },
    children: [root, ...(o.overlays ?? []), loading],
  };
}

/** Modal dialog: scrim + centered card. `visible` is a formula. */
export function dialog(n: Namer, id: string, visible: string, title: string, onClose: string, children: Ctl[], footer: Ctl[], o: { width?: number; height?: number | string } = {}): Ctl {
  const w = o.width ?? 560;
  const h = o.height ?? 420;
  return group(n(`grpDlg${id}`), { X: 0, Y: 0, Width: "Parent.Width", Height: "Parent.Height", Visible: visible }, [
    hit(n(`btnDlg${id}Scrim`), onClose, { X: 0, Y: 0, Width: "Parent.Width", Height: "Parent.Height", Fill: "gScrim", HoverFill: "gScrim", PressedFill: "gScrim", FocusedBorderThickness: 0, TabIndex: -1 }),
    vbox(
      n(`conDlg${id}`),
      {
        X: `(Parent.Width - ${w}) / 2`,
        Y: `Max(24, (Parent.Height - Self.Height) / 2)`,
        Width: w,
        Height: h,
        Fill: "gCard",
        radius: 8,
        DropShadow: "DropShadow.ExtraBold",
        pad: 24,
        gap: 16,
      },
      [
        hbox(n(`conDlg${id}Head`), { Height: 32, FillPortions: 0, LayoutMinHeight: 0, gap: 8 }, [
          label(n(`lblDlg${id}`), title, { size: 14, weight: "Semibold", color: "gHeading", FillPortions: 1, LayoutMinWidth: 0, Height: 32 }),
          group(n(`grpDlg${id}Close`), { Width: 32, Height: 32 }, [
            iconImg(n(`imgDlg${id}Close`), icon(ICONS.close, C.body), 16, { X: 8, Y: 8 }),
            hit(n(`btnDlg${id}Close`), onClose, {
              X: 0,
              Y: 0,
              Width: 32,
              Height: 32,
              HoverFill: "RGBA(0, 0, 0, 0.05)",
              RadiusTopLeft: 16,
              RadiusTopRight: 16,
              RadiusBottomLeft: 16,
              RadiusBottomRight: 16,
              AccessibleLabel: str("Close"),
            }),
          ]),
        ]),
        ...children,
        spacer(n(`spcDlg${id}`), "V"),
        hbox(n(`conDlg${id}Foot`), { Height: 40, FillPortions: 0, LayoutMinHeight: 0, gap: 12, justify: "End" }, footer),
      ],
    ),
  ]);
}

/** Table header row from column specs. */
export interface Col {
  title: string;
  width?: number; // fixed width; otherwise flexible
  fill?: number;
  align?: "Left" | "Right" | "Center";
}
export function tableHeader(n: Namer, id: string, cols: Col[], props: Props = {}): Ctl[] {
  return [
    hbox(n(`conTH${id}`), { Height: 36, FillPortions: 0, LayoutMinHeight: 0, pad: [0, 20], gap: 12, Fill: "gCard", ...props }, cols.map((c, i) =>
      label(n(`lblTH${id}${i}`), str(c.title), {
        size: 9,
        weight: "Semibold",
        color: "gMuted",
        Height: 36,
        Align: `Align.${c.align ?? "Left"}`,
        ...(c.width ? { Width: c.width, FillPortions: 0 } : { FillPortions: c.fill ?? 1, LayoutMinWidth: 0 }),
      }),
    )),
    hline(n(`rectTH${id}`), { FillPortions: 0 }),
  ];
}

/** Wraps a cell control so its width follows the column spec. */
export function cell(name: string, c: Col, children: Ctl[], props: Props = {}): Ctl {
  const sizing: Props = c.width ? { Width: c.width, FillPortions: 0 } : { FillPortions: c.fill ?? 1, LayoutMinWidth: 0 };
  // A lone label needs no wrapper container: size the label itself (fewer controls).
  if (children.length === 1 && children[0].control === T.label && !Object.keys(props).length) {
    return withProps(children[0], { ...sizing, Height: "Parent.Height", Align: c.align ? `Align.${c.align}` : children[0].props.Align });
  }
  return vbox(name, {
    gap: 2,
    justify: "Center",
    align: c.align === "Right" ? "End" : c.align === "Center" ? "Center" : "Stretch",
    Height: "Parent.Height",
    LayoutMinHeight: 0,
    ...(c.width ? { Width: c.width, FillPortions: 0 } : { FillPortions: c.fill ?? 1, LayoutMinWidth: 0 }),
    ...props,
  }, children);
}

/** Row template content for a table gallery: cells in an hbox + separator + click overlay. */
export function tableRow(n: Namer, id: string, cells: Ctl[], o: { onSelect?: string; height: number; overlayWidth?: string; after?: Ctl[] }): Ctl[] {
  return [
    hbox(n(`conTR${id}`), { X: 0, Y: 0, Width: "Parent.TemplateWidth", Height: o.height - 1, pad: [0, 20], gap: 12 }, cells),
    hline(n(`rectTR${id}`), { X: 20, Y: o.height - 1, Width: "Parent.TemplateWidth - 40" }),
    ...(o.onSelect ? [hit(n(`btnTR${id}`), o.onSelect, { X: 0, Y: 0, Width: o.overlayWidth ?? "Parent.TemplateWidth", Height: o.height - 1 })] : []),
    ...(o.after ?? []),
  ];
}
