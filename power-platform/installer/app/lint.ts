/**
 * Normalisation and lint rules from Microsoft's canvas-app QA checklist
 * (microsoft/power-platform-skills · plugins/canvas-apps/references/QAChecks.md).
 *
 * normalize() fixes what can be fixed mechanically; lint() reports the rest.
 */
import { readFileSync } from "node:fs";
import { type Ctl, type Screen, T } from "./dsl.ts";

// Real property lists from Studio's control templates (PowerApps-Tooling test .msapp files).
const TEMPLATES: Record<string, { from: string; props: string[] }> = JSON.parse(readFileSync(new URL("./control-props.json", import.meta.url), "utf8"));
// Properties an auto-layout container adds to its direct children (not for ManualLayout or screen children).
const DYNAMIC = ["FillPortions", "LayoutMinWidth", "LayoutMinHeight", "LayoutMaxWidth", "LayoutMaxHeight", "AlignInContainer"];

const isAuto = (c: Ctl) => c.control === T.group && c.variant === "AutoLayout";
const dir = (c: Ctl) => (String(c.props.LayoutDirection ?? "").includes("Horizontal") ? "H" : "V");
const fp = (c: Ctl) => Number(c.props.FillPortions ?? 0);
const INTERACTIVE = new Set([T.button, T.input, T.date]);

function eachWithParent(screens: Screen[], fn: (c: Ctl, parent: Ctl | null, ancestors: Ctl[], screen: Screen) => void) {
  for (const s of screens) {
    const visit = (c: Ctl, parent: Ctl | null, anc: Ctl[]) => {
      fn(c, parent, anc, s);
      for (const ch of c.children ?? []) visit(ch, c, [...anc, c]);
    };
    for (const c of s.children) visit(c, null, []);
  }
}

export function normalize(screens: Screen[]) {
  // Gallery row counts come from the Items formula, never from the lazily
  // materialised AllItems/AllItemsCount (QACHK-HIDDEN-BOUNDED-LIST).
  const items = new Map<string, string>();
  eachWithParent(screens, (c) => {
    if (c.control === T.gallery) items.set(c.name, String(c.props.Items));
  });
  const MAX_ROWS = 12;
  eachWithParent(screens, (c) => {
    for (const [k, v] of Object.entries(c.props)) {
      if (typeof v !== "string") continue;
      let f = v;
      if (c.control === T.gallery) {
        const src = items.get(c.name)!;
        if (k === "Height" && /Self\.AllItemsCount \* (\d+)/.test(f)) {
          // Long lists scroll inside a bounded viewport; short ones show every row.
          f = f.replace(/Self\.AllItemsCount \* (\d+)/, `Min(CountRows(${src}), ${MAX_ROWS}) * $1`);
          c.props.ShowScrollbar = `CountRows(${src}) > ${MAX_ROWS}`;
        }
        f = f.replace(/CountRows\(Self\.AllItems\)/g, `CountRows(${src})`).replace(/Self\.AllItemsCount/g, `CountRows(${src})`);
      }
      f = f.replace(/CountRows\((\w+)\.AllItems\)/g, (m, g) => (items.has(g) ? `CountRows(${items.get(g)})` : m));
      c.props[k] = f;
    }
  });

  eachWithParent(screens, (c, parent) => {
    if (parent && isAuto(parent)) {
      // Containers default to min 250×100 (QACHK-CONTAINER-MIN-SIZE).
      if (c.control === T.group) {
        c.props.LayoutMinWidth ??= 0;
        c.props.LayoutMinHeight ??= 0;
      }
      // Explicit FillPortions on every auto-layout child (QACHK-FILLPORTIONS-DEFAULT).
      c.props.FillPortions ??= 0;
    } else {
      // Layout properties only exist on direct children of an auto-layout container.
      for (const k of DYNAMIC) delete c.props[k];
    }
    // Labels wrap by default; ours are single-line unless they opt in (QACHK-WRAP-MISSING).
    if (c.control === T.label) c.props.Wrap ??= false;
  });
}

export function lint(screens: Screen[]): string[] {
  const out: string[] = [];
  eachWithParent(screens, (c, parent, anc, s) => {
    const where = `${s.name}/${c.name}`;
    const formulas = Object.values(c.props).filter((v) => typeof v === "string").join("\n");

    const tpl = TEMPLATES[c.control];
    if (!tpl) out.push(`${where}: no template property list for ${c.control}`);
    else {
      const allowed = new Set([...tpl.props, ...(parent && isAuto(parent) ? DYNAMIC : [])]);
      for (const k of Object.keys(c.props)) if (!allowed.has(k)) out.push(`${where}: unknown property ${k} for ${c.control} (template ${tpl.from})`);
    }
    if (/AllItems/.test(formulas)) out.push(`${where}: reads AllItems/AllItemsCount (lazy; use the source count)`);
    if (c.control === T.rect && Object.keys(c.props).some((k) => k.startsWith("Radius"))) out.push(`${where}: Rectangle has no Radius properties`);
    if ((c.control === T.group || c.control === T.gallery) && !c.variant) out.push(`${where}: missing Variant`);

    // Parent.TemplateWidth/Height only resolve on a gallery's direct child.
    if (/Parent\.Template(Width|Height)/.test(formulas) && parent?.control !== T.gallery) out.push(`${where}: Parent.TemplateWidth/Height used below a gallery's direct child`);

    if (parent && isAuto(parent)) {
      const d = dir(parent);
      const main = d === "V" ? "Height" : "Width";
      const mainVal = c.props[main];
      // Scroll trap (QACHK-SCROLL-TRAP).
      if (parent.props.LayoutOverflowY && fp(c) > 0) out.push(`${where}: FillPortions > 0 inside a scroll container`);
      // FillPortions + fixed main-axis size (QACHK-FILLPORTIONS-*-CONFLICT).
      if (fp(c) > 0 && mainVal !== undefined && !/Parent/.test(String(mainVal))) out.push(`${where}: FillPortions > 0 and an explicit ${main}`);
      // Fixed child without a main-axis size defaults to 200px (QACHK-NO-HEIGHT-TRAP).
      if (fp(c) === 0 && mainVal === undefined && c.control === T.group) out.push(`${where}: no ${main} and FillPortions 0 (defaults to 200px)`);
    }

    // Interactive control under a read-only ancestor (QACHK-READ-ONLY-ANCESTOR).
    if (INTERACTIVE.has(c.control) && anc.some((a) => /DisplayMode\.(View|Disabled)$/.test(String(a.props.DisplayMode ?? "")))) out.push(`${where}: interactive control under a View/Disabled ancestor`);

    if (c.control === T.gallery) {
      if (!c.props.Items) out.push(`${where}: gallery without Items`);
      if (/Self\.Template/.test(String(c.props.Height ?? ""))) out.push(`${where}: gallery height derived from Self.Template*`);
    }
  });
  return out;
}
