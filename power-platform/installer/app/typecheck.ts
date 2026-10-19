/**
 * Builds a typed model of the app for tools/fxcheck "check" mode:
 * SharePoint lists (from the installer's own schema, so they can't drift),
 * collections, variables, controls, and every property formula with the type
 * it must return. Canvas-only functions (Navigate, Notify, UpdateContext …)
 * are rewritten into core Power Fx that checks their arguments the same way.
 */
import { type Ctl, type Screen, T } from "./dsl.ts";
import { LISTS, type FieldDef } from "../src/schema.ts";

type Spec = string | { k: "record"; f: Record<string, Spec> } | { k: "table"; r: Spec };
const rec = (f: Record<string, Spec>): Spec => ({ k: "record", f });
const table = (r: Spec): Spec => ({ k: "table", r });

const PERSON = rec({ DisplayName: "Text", Email: "Text", Claims: "Text", Department: "Text", JobTitle: "Text", Picture: "Text" });
const LOOKUP = rec({ Id: "Number", Value: "Text" });
const CHOICE = rec({ Value: "Text" });

function fieldSpec(f: FieldDef): Spec {
  switch (f.type) {
    case "Text":
    case "Note":
      return "Text";
    case "Number":
      return "Number";
    case "Boolean":
      return "Boolean";
    case "Date":
      return "Date";
    case "Choice":
      return CHOICE;
    case "Lookup":
      return LOOKUP;
  }
}

const COLLECTION_OF: Record<string, string> = {
  colProjects: "projects",
  colAssignments: "assignments",
  colPeople: "people",
  colClients: "clients",
  colIndustries: "industries",
  colLoS: "linesOfService",
  colTerritories: "territories",
  colCapabilities: "capabilities",
  colRisks: "risks",
  colUpdates: "updates",
  colAdmins: "admins",
};

const VARS: Record<string, string> = {
  gIsAdmin: "Boolean",
  gProjectId: "Number",
  gProjectTab: "Text",
  gEditProjectId: "Number",
  gJoinProjectId: "Number",
  varBusy: "Boolean",
  varLoading: "Boolean",
  locAllocDefault: "Number",
  locAsgCap: "Number",
  locAsgConfirm: "Boolean",
  locAsgId: "Number",
  locAsgOpen: "Boolean",
  locCap: "Number",
  locClient: "Number",
  locClientNew: "Text",
  locEndBlank: "Boolean",
  locFilter: "Text",
  locGrade: "Text",
  locIndustry: "Number",
  locJoinId: "Number",
  locLoS: "Number",
  locMulti: "Boolean",
  locRag: "Text",
  locRiskConfirm: "Boolean",
  locRiskId: "Number",
  locRiskSev: "Text",
  locRiskStatus: "Text",
  locScope: "Text",
  locStatus: "Text",
  locTab: "Text",
  locTerritory: "Number",
  locTried: "Boolean",
  locUpdRag: "Text",
};

// ── Text utilities (string/identifier aware) ───────────────────────────────────
function skipQuoted(s: string, i: number): number {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === q) {
      if (s[i + 1] === q) i++;
      else return i + 1;
    }
  }
  return i;
}

/** Splits the argument list starting right after "(" at `open`; returns args and the index after ")". */
function args(s: string, open: number): { list: string[]; end: number } {
  const list: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < s.length; ) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      i = skipQuoted(s, i);
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      if (depth === 0) {
        const last = s.slice(start, i);
        if (last.trim() || list.length) list.push(last);
        return { list, end: i + 1 };
      }
      depth--;
    } else if (ch === "," && depth === 0) {
      list.push(s.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  throw new Error("Unbalanced parentheses");
}

/** Splits a record literal body "a: 1, b: 2" into [key, value] pairs. */
function recordPairs(body: string): [string, string][] {
  const inner = body.trim().replace(/^\{/, "").replace(/\}$/, "");
  const { list } = args(`(${inner})`, 0);
  return list.map((p) => {
    const i = p.indexOf(":");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  });
}

const CANVAS_VOID = new Set(["Navigate", "Notify", "Launch", "Reset", "Select"]);

/** Rewrites canvas-only calls into core Power Fx (for checking only). */
export function rewrite(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const j = skipQuoted(s, i);
      out += s.slice(i, j);
      i = j;
      continue;
    }
    const m = /^[A-Za-z_]\w*/.exec(s.slice(i));
    if (m && (i === 0 || !/[\w.]/.test(s[i - 1]))) {
      const name = m[0];
      const after = i + name.length;
      if (s[after] === "(" && ["UpdateContext", "Concurrent", "Back", "User", "Param", "Defaults", "RemoveIf", ...CANVAS_VOID].includes(name)) {
        const { list, end } = args(s, after);
        const a = list.map((x) => rewrite(x));
        let rep: string;
        if (name === "UpdateContext") rep = `If(true, ${recordPairs(a[0]).map(([k, v]) => `Set(${k}, ${v})`).join("; ")})`;
        else if (name === "Concurrent") rep = `If(true, ${a.join("; ")})`;
        else if (name === "Back") rep = "true";
        else if (name === "User") rep = "CUser";
        else if (name === "Param") rep = `Text(${a[0]})`;
        else if (name === "Defaults") rep = `First(${a[0]})`;
        else if (name === "RemoveIf") rep = `IsBlank(Filter(${a.join(",")}))`;
        else rep = `(${a.map((x) => `IsBlank(${x})`).join(" || ")})`;
        out += rep;
        i = end;
        continue;
      }
      // Self/Parent/ThisItem are host keywords the core engine reserves: alias them.
      out += name === "Self" ? "CSelf" : name === "Parent" ? "CParent" : name === "ThisItem" ? "CThisItem" : name;
      i = after;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** All ClearCollect(name, expr) pairs in a formula, in order. */
export function clearCollects(s: string): { name: string; expr: string }[] {
  const found: { name: string; expr: string }[] = [];
  const re = /\bClearCollect\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const { list } = args(s, m.index + "ClearCollect".length);
    found.push({ name: list[0].trim(), expr: list.slice(1).join(",") });
  }
  return found;
}

// ── Expected result types per property ─────────────────────────────────────────
const NUMBER = /^(X|Y|Width|Height|Size|Padding(Top|Bottom|Left|Right)|Radius\w+|BorderThickness|FocusedBorderThickness|LayoutGap|FillPortions|LayoutMin(Width|Height)|TemplateSize|TemplatePadding|WrapCount|LineHeight|TabIndex)$/;
const BOOLEAN = /^(Visible|Wrap|AutoHeight|Clear|DelayOutput|ShowScrollbar|ShowNavigation|LayoutWrap)$/;
const COLOR = /^(Fill|Color|\w+Fill|\w+Color|IconBackground)$/;
const TEXT = /^(Text|HintText|Tooltip|AccessibleLabel|Image)$/;
const ENUM: Record<string, string> = {
  FontWeight: "FontWeight",
  Font: "Font",
  Align: "Align",
  VerticalAlign: "VerticalAlign",
  DisplayMode: "DisplayMode",
  LayoutDirection: "LayoutDirection",
  LayoutAlignItems: "LayoutAlignItems",
  LayoutJustifyContent: "LayoutJustifyContent",
  LayoutOverflowY: "LayoutOverflow",
  AlignInContainer: "AlignInContainer",
  DropShadow: "DropShadow",
  ImagePosition: "ImagePosition",
  Mode: "TextMode",
  LoadingSpinner: "LoadingSpinner",
};

function expectFor(control: string, prop: string): string {
  if (prop.startsWith("On")) return "Any";
  if (prop === "Items") return "Table";
  if (prop === "DefaultDate") return "Date";
  if (prop === "Default") return "Text";
  if (prop === "Format") return control === T.input ? "TextFormat" : "Text";
  if (ENUM[prop]) return ENUM[prop];
  if (NUMBER.test(prop)) return "Number";
  if (BOOLEAN.test(prop)) return "Boolean";
  if (TEXT.test(prop)) return "Text";
  if (COLOR.test(prop)) return "Color";
  return "Any";
}

const KIND: Record<string, string> = {
  [T.label]: "label",
  [T.button]: "button",
  [T.input]: "input",
  [T.date]: "date",
  [T.gallery]: "gallery",
  [T.image]: "image",
  [T.group]: "group",
  [T.rect]: "rect",
};

export function buildProgram(screens: Screen[], appFormulas: { name: string; text: string }[], onStart: string) {
  const types: Record<string, Spec> = {};
  const globals: { name: string; type: Spec }[] = [];
  for (const l of LISTS) {
    const f: Record<string, Spec> = { ID: "Number", Title: "Text", Created: "DateTime", Modified: "DateTime", Author: PERSON, Editor: PERSON };
    for (const fd of l.fields) f[fd.name] = fieldSpec(fd);
    types[l.key] = rec(f);
    globals.push({ name: l.title, type: table(l.key) });
  }
  for (const [c, key] of Object.entries(COLLECTION_OF)) globals.push({ name: c, type: table(key) });
  globals.push({ name: "gMe", type: "people" });
  globals.push({ name: "CUser", type: rec({ Email: "Text", FullName: "Text", Image: "Text" }) });
  for (const [v, t] of Object.entries(VARS)) globals.push({ name: v, type: t });

  // Named formulas, then collections built with ClearCollect (in the order the app builds them).
  const derived: { name: string; text: string }[] = appFormulas.map((f) => ({ name: f.name, text: rewrite(f.text) }));
  const behaviorSources = [onStart, ...screens.map((s) => String(s.props.OnVisible ?? ""))];
  const known = new Set([...globals.map((g) => g.name), ...derived.map((d) => d.name)]);
  for (const src of behaviorSources)
    for (const cc of clearCollects(src)) {
      if (known.has(cc.name)) continue;
      known.add(cc.name);
      derived.push({ name: cc.name, text: rewrite(cc.expr) });
    }

  const controls: { name: string; kind: string }[] = [];
  const formulas: { id: string; text: string; expect: string; self?: string; parent?: string; thisItem?: string; galleryItems?: string }[] = [];
  formulas.push({ id: "App.OnStart", text: rewrite(onStart), expect: "Any" });
  for (const s of screens) {
    for (const [k, v] of Object.entries(s.props)) if (v !== undefined) formulas.push({ id: `${s.name}.${k}`, text: rewrite(String(v)), expect: k === "LoadingSpinner" ? "LoadingSpinner" : expectFor("", k) });
    const visit = (c: Ctl, parent: Ctl | null, gallery: Ctl | null) => {
      controls.push({ name: c.name, kind: KIND[c.control] ?? "group" });
      for (const [k, v] of Object.entries(c.props)) {
        if (v === undefined) continue;
        formulas.push({
          id: `${s.name}/${c.name}.${k}`,
          text: rewrite(String(v)),
          expect: expectFor(c.control, k),
          self: c.name,
          parent: parent?.name ?? "__screen",
          thisItem: gallery?.name,
          ...(c.control === T.gallery && k === "Items" ? { galleryItems: c.name } : {}),
        });
      }
      for (const ch of c.children ?? []) visit(ch, c, c.control === T.gallery ? c : gallery);
    };
    for (const c of s.children) visit(c, null, null);
  }
  return { types, globals, derived, controls, screens: screens.map((s) => s.name), formulas };
}
