/**
 * A tiny DSL for Power Apps canvas screens, emitted as the pa.yaml that
 * Power Apps Studio's "Paste code" accepts (schema v3.0). Property values are
 * Power Fx formulas written WITHOUT the leading "="; the emitter adds it.
 *
 * Only classic controls and containers are used: their properties are stable
 * and none of them carry hidden Studio state that pasting would lose (unlike
 * the classic combo box, which loses its item labels when pasted).
 */

export type Value = string | number | boolean | undefined;
export type Props = Record<string, Value>;

export interface Ctl {
  name: string;
  control: string;
  variant?: string;
  props: Props;
  children?: Ctl[];
}

// Control types, pinned to versions seen in Studio exports. Classic button,
// text input and date picker are left unpinned (Studio uses the latest).
export const T = {
  label: "Label@2.5.1",
  button: "Classic/Button",
  input: "Classic/TextInput",
  date: "Classic/DatePicker",
  image: "Image@2.2.3",
  rect: "Rectangle@2.3.0",
  gallery: "Gallery@2.15.0",
  group: "GroupContainer@1.3.0",
};
export const GALLERY_VARIANT = "Vertical";

// ── Power Fx helpers ────────────────────────────────────────────────────────
/** Power Fx text literal. */
export const str = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** A Lucide icon as a static SVG data URI (Power Fx text literal). */
export function icon(fragment: string, color = "#474747", strokeWidth = 2) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${color}' ` +
    `stroke-width='${strokeWidth}' stroke-linecap='round' stroke-linejoin='round'>${fragment}</svg>`;
  return str("data:image/svg+xml;utf8," + encodeURIComponent(svg));
}

/** Any SVG markup as a static data URI. */
export const svgUri = (svg: string) => str("data:image/svg+xml;utf8," + encodeURIComponent(svg));

// ── Control factories ───────────────────────────────────────────────────────
export function ctl(control: string, name: string, props: Props, children?: Ctl[], variant?: string): Ctl {
  // Classic buttons have no AccessibleLabel (screen readers read Text); show it as a tooltip instead.
  if (control === "Classic/Button" && props.AccessibleLabel !== undefined) {
    const { AccessibleLabel, ...rest } = props;
    props = { Tooltip: AccessibleLabel, ...rest };
  }
  return { name, control, variant, props, children };
}

/** Copy of a control with extra/overridden properties. */
export const withProps = (c: Ctl, props: Props): Ctl => ({ ...c, props: { ...c.props, ...props } });

const FONT = "gFont";

export type LabelOpts = Props & { size?: number; weight?: "Normal" | "Semibold" | "Bold"; color?: string };
export function label(name: string, text: string, o: LabelOpts = {}): Ctl {
  const { size = 10.5, weight = "Normal", color = "gBody", ...rest } = o;
  return ctl(T.label, name, {
    Text: text,
    Font: FONT,
    Size: size,
    FontWeight: `FontWeight.${weight}`,
    Color: color,
    PaddingTop: 0,
    PaddingBottom: 0,
    PaddingLeft: 0,
    PaddingRight: 0,
    Height: Math.ceil(size * 2),
    VerticalAlign: "VerticalAlign.Middle",
    ...rest,
  });
}

export type ButtonKind = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
export function button(name: string, text: string, kind: ButtonKind, props: Props = {}): Ctl {
  const base: Props = {
    Text: text,
    Font: FONT,
    Size: 10.5,
    FontWeight: "FontWeight.Semibold",
    Height: 36,
    RadiusTopLeft: 4,
    RadiusTopRight: 4,
    RadiusBottomLeft: 4,
    RadiusBottomRight: 4,
    BorderThickness: 0,
    FocusedBorderThickness: 2,
    FocusedBorderColor: "gFocus",
    PaddingLeft: 16,
    PaddingRight: 16,
  };
  const kinds: Record<ButtonKind, Props> = {
    primary: {
      Fill: "gPrimary",
      Color: "Color.White",
      HoverFill: "gPrimaryHover",
      HoverColor: "Color.White",
      PressedFill: "gPrimaryPressed",
      PressedColor: "Color.White",
      DisabledFill: "gPrimaryDisabled",
      DisabledColor: "Color.White",
    },
    secondary: {
      Fill: "gCard",
      Color: "gPrimary",
      BorderColor: "gPrimary",
      BorderThickness: 1,
      HoverFill: "gPrimaryTint",
      HoverColor: "gPrimary",
      HoverBorderColor: "gPrimary",
      PressedFill: "gPrimaryTint",
      PressedColor: "gPrimaryPressed",
      PressedBorderColor: "gPrimaryPressed",
      DisabledFill: "gCard",
      DisabledColor: "gPrimaryDisabled",
      DisabledBorderColor: "gPrimaryDisabled",
    },
    tertiary: {
      Fill: "Color.Transparent",
      Color: "gPrimary",
      HoverFill: "gPrimaryTint",
      HoverColor: "gPrimaryPressed",
      PressedFill: "gPrimaryTint",
      PressedColor: "gPrimaryPressed",
      DisabledFill: "Color.Transparent",
      DisabledColor: "gMuted",
      PaddingLeft: 8,
      PaddingRight: 8,
    },
    ghost: {
      Fill: "gCard",
      Color: "gHeading",
      BorderColor: "gInputBorder",
      BorderThickness: 1,
      HoverFill: "gPage",
      HoverColor: "gHeading",
      HoverBorderColor: "gInputHover",
      PressedFill: "gLine",
      PressedColor: "gHeading",
      DisabledFill: "gCard",
      DisabledColor: "gMuted",
      FontWeight: "FontWeight.Normal",
    },
    danger: {
      Fill: "gCard",
      Color: "gRed",
      BorderColor: "gRed",
      BorderThickness: 1,
      HoverFill: "gRedTint",
      HoverColor: "gRed",
      HoverBorderColor: "gRed",
      PressedFill: "gRedTint",
      PressedColor: "gRed",
    },
  };
  return ctl(T.button, name, { ...base, ...kinds[kind], ...props });
}

/** Transparent click target laid over a row or card (hover tint included). */
export function hit(name: string, onSelect: string, props: Props = {}): Ctl {
  return ctl(T.button, name, {
    Text: '""',
    Fill: "Color.Transparent",
    HoverFill: "gHoverTint",
    PressedFill: "gPressTint",
    BorderThickness: 0,
    FocusedBorderThickness: 2,
    FocusedBorderColor: "gFocus",
    RadiusTopLeft: 0,
    RadiusTopRight: 0,
    RadiusBottomLeft: 0,
    RadiusBottomRight: 0,
    OnSelect: onSelect,
    ...props,
  });
}

/** Non-interactive pill (status, RAG, severity). fill/color are formulas. */
export function pill(name: string, text: string, fill: string, color: string, props: Props = {}): Ctl {
  return ctl(T.button, name, {
    Text: text,
    DisplayMode: "DisplayMode.View",
    Font: FONT,
    Size: 9,
    FontWeight: "FontWeight.Semibold",
    Fill: fill,
    Color: color,
    HoverFill: fill,
    HoverColor: color,
    PressedFill: fill,
    PressedColor: color,
    BorderThickness: 0,
    RadiusTopLeft: 4,
    RadiusTopRight: 4,
    RadiusBottomLeft: 4,
    RadiusBottomRight: 4,
    PaddingLeft: 8,
    PaddingRight: 8,
    Height: 22,
    Width: `Len(Self.Text) * 6.4 + 20`,
    ...props,
  });
}

export function image(name: string, src: string, props: Props = {}): Ctl {
  return ctl(T.image, name, {
    Image: src,
    ImagePosition: "ImagePosition.Fit",
    PaddingTop: 0,
    PaddingBottom: 0,
    PaddingLeft: 0,
    PaddingRight: 0,
    BorderThickness: 0,
    ...props,
  });
}

export function iconImg(name: string, src: string, size = 18, props: Props = {}): Ctl {
  return image(name, src, { Width: size, Height: size, ...props });
}

export function rect(name: string, fill: string, props: Props = {}): Ctl {
  return ctl(T.rect, name, { Fill: fill, BorderThickness: 0, ...props });
}

export function hline(name: string, props: Props = {}): Ctl {
  return rect(name, "gLine", { Height: 1, ...props });
}

type BoxOpts = Props & {
  gap?: number;
  pad?: number | [number, number] | [number, number, number, number];
  align?: "Start" | "Center" | "End" | "Stretch";
  justify?: "Start" | "Center" | "End" | "SpaceBetween" | "SpaceAround" | "SpaceEvenly";
  card?: boolean;
  radius?: number;
  scroll?: boolean;
  wrap?: boolean;
};

function box(direction: "Vertical" | "Horizontal", name: string, o: BoxOpts, children: Ctl[]): Ctl {
  const { gap = 0, pad = 0, align = direction === "Vertical" ? "Stretch" : "Center", justify = "Start", card, radius, scroll, wrap, ...rest } = o;
  const [pt, pr, pb, pl] = typeof pad === "number" ? [pad, pad, pad, pad] : pad.length === 2 ? [pad[0], pad[1], pad[0], pad[1]] : pad;
  const r = radius ?? (card ? 8 : 0);
  const props: Props = {
    LayoutDirection: `LayoutDirection.${direction}`,
    LayoutGap: gap,
    LayoutAlignItems: `LayoutAlignItems.${align}`,
    LayoutJustifyContent: `LayoutJustifyContent.${justify}`,
    PaddingTop: pt,
    PaddingRight: pr,
    PaddingBottom: pb,
    PaddingLeft: pl,
    DropShadow: "DropShadow.None",
    ...(r ? { RadiusTopLeft: r, RadiusTopRight: r, RadiusBottomLeft: r, RadiusBottomRight: r } : {}),
    ...(card ? { Fill: "gCard", BorderColor: "gLine", BorderThickness: 1 } : {}),
    ...(scroll ? { LayoutOverflowY: "LayoutOverflow.Scroll" } : {}),
    ...(wrap ? { LayoutWrap: true } : {}),
    ...rest,
  };
  return ctl(T.group, name, props, children, "AutoLayout");
}

export const vbox = (name: string, o: BoxOpts, children: Ctl[]) => box("Vertical", name, o, children);
export const hbox = (name: string, o: BoxOpts, children: Ctl[]) => box("Horizontal", name, o, children);

/** A manual-layout container (children positioned with X/Y). */
export function group(name: string, props: Props, children: Ctl[]): Ctl {
  return ctl(T.group, name, { DropShadow: "DropShadow.None", ...props }, children, "ManualLayout");
}

/** Flexible spacer for auto-layout rows. */
export const spacer = (name: string, axis: "H" | "V" = "H", props: Props = {}) =>
  rect(name, "Color.Transparent", { FillPortions: 1, ...(axis === "H" ? { Height: 1 } : { Width: 1 }), ...props });

export function gallery(name: string, items: string, templateSize: number, children: Ctl[], props: Props = {}): Ctl {
  return ctl(
    T.gallery,
    name,
    {
      Items: items,
      TemplateSize: templateSize,
      TemplatePadding: 0,
      ShowScrollbar: false,
      ShowNavigation: false,
      BorderThickness: 0,
      Fill: "Color.Transparent",
      TemplateFill: "Color.Transparent",
      ...props,
    },
    children,
    GALLERY_VARIANT,
  );
}

export function input(name: string, props: Props = {}): Ctl {
  return ctl(T.input, name, {
    Default: '""',
    Font: FONT,
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
    PaddingRight: 12,
    Height: 40,
    Clear: true,
    ...props,
  });
}

export function datePicker(name: string, props: Props = {}): Ctl {
  return ctl(T.date, name, {
    Font: FONT,
    Size: 10.5,
    Color: "gHeading",
    Fill: "gCard",
    BorderColor: "gInputBorder",
    BorderThickness: 1,
    IconFill: "gMuted",
    IconBackground: "gCard",
    Format: str("dd mmm yyyy"),
    Height: 40,
    PaddingLeft: 12,
    ...props,
  });
}

// ── YAML emitter (the restricted subset Power Apps reads) ─────────────────────
function formulaLines(key: string, value: Value, indent: string): string[] {
  if (value === undefined) return [];
  const f = "=" + (typeof value === "string" ? value : String(value));
  // '#' and ':' are not allowed in single-line formulas, even inside strings.
  if (/[:#\n]/.test(f) || /\s$/.test(f)) {
    return [`${indent}${key}: |-`, ...f.split("\n").map((l) => `${indent}  ${l}`)];
  }
  return [`${indent}${key}: ${f}`];
}

function propLines(props: Props, indent: string): string[] {
  const keys = Object.keys(props).filter((k) => props[k] !== undefined);
  if (!keys.length) return [];
  return [`${indent}Properties:`, ...keys.flatMap((k) => formulaLines(k, props[k], indent + "  "))];
}

function controlLines(c: Ctl, indent: string): string[] {
  const out = [`${indent}- ${c.name}:`];
  const inner = indent + "    ";
  out.push(`${inner}Control: ${c.control}`);
  if (c.variant) out.push(`${inner}Variant: ${c.variant}`);
  out.push(...propLines(c.props, inner));
  if (c.children?.length) {
    out.push(`${inner}Children:`);
    for (const ch of c.children) out.push(...controlLines(ch, inner + "  "));
  }
  return out;
}

export interface Screen {
  name: string;
  props: Props;
  children: Ctl[];
}

export function screensYaml(screens: Screen[]): string {
  const out = ["Screens:"];
  for (const s of screens) {
    out.push(`  ${s.name}:`);
    out.push(...propLines(s.props, "    "));
    out.push("    Children:");
    for (const c of s.children) out.push(...controlLines(c, "      "));
  }
  return out.join("\n") + "\n";
}

/** Every (path, formula) pair, for validation. */
export function* walkFormulas(screens: Screen[]): Generator<{ id: string; text: string; control: string; prop: string }> {
  for (const s of screens) {
    for (const [k, v] of Object.entries(s.props)) if (v !== undefined) yield { id: `${s.name}.${k}`, text: String(v), control: s.name, prop: k };
    const visit = function* (c: Ctl): Generator<{ id: string; text: string; control: string; prop: string }> {
      for (const [k, v] of Object.entries(c.props)) if (v !== undefined) yield { id: `${s.name}/${c.name}.${k}`, text: String(v), control: c.name, prop: k };
      for (const ch of c.children ?? []) yield* visit(ch);
    };
    for (const c of s.children) yield* visit(c);
  }
}

export function* walkControls(screens: Screen[]): Generator<Ctl> {
  const visit = function* (c: Ctl): Generator<Ctl> {
    yield c;
    for (const ch of c.children ?? []) yield* visit(ch);
  };
  for (const s of screens) for (const c of s.children) yield* visit(c);
}
