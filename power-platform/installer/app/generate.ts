/**
 * Generates the Power Apps screens (pa.yaml) + App formulas, then validates:
 *  1. YAML parses and every formula round-trips exactly
 *  2. the document matches Microsoft's pa.yaml v3.0 JSON schema
 *  3. control names are unique and every referenced control/screen exists
 *  4. every formula parses with Microsoft's Power Fx parser (tools/fxcheck)
 *  5. every function used is a real canvas-app function
 *
 * Run: node app/generate.ts   (from the installer folder)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Ajv from "ajv";
import yaml from "js-yaml";
import { type Screen, screensYaml, walkControls, walkFormulas } from "./dsl.ts";
import { APP_FORMULAS, APP_ONSTART } from "./theme.ts";
import { lint, normalize } from "./lint.ts";
import { buildProgram } from "./typecheck.ts";

// Screen modules, in navigation order. Each exports a function returning a Screen.
const SCREEN_MODULES = ["home", "projects", "project", "log", "join", "profile", "team"];
const screens: Screen[] = [];
for (const m of SCREEN_MODULES) {
  const file = new URL(`./screens/${m}.ts`, import.meta.url);
  if (!existsSync(file)) {
    console.warn(`(skipping missing screen module ${m})`);
    continue;
  }
  const mod = await import(file.href);
  screens.push(mod.default());
}

normalize(screens);

const OUT = "app/out";
mkdirSync(OUT, { recursive: true });

const problems: string[] = [];

// ── Emit ──────────────────────────────────────────────────────────────────────
const all = screensYaml(screens);
writeFileSync(join(OUT, "all-screens.pa.yaml"), all);
for (const s of screens) writeFileSync(join(OUT, `${s.name}.pa.yaml`), screensYaml([s]));
writeFileSync(join(OUT, "App.Formulas.txt"), APP_FORMULAS);
writeFileSync(join(OUT, "App.OnStart.txt"), APP_ONSTART);

// ── 1. YAML round-trip ──────────────────────────────────────────────────────────
const doc = yaml.load(all) as any;
const parsed = new Map<string, unknown>();
for (const [sname, s] of Object.entries<any>(doc.Screens)) {
  for (const [k, v] of Object.entries(s.Properties ?? {})) parsed.set(`${sname}.${k}`, v);
  const visit = (list: any[]) => {
    for (const item of list ?? []) {
      const [cname, c] = Object.entries<any>(item)[0];
      for (const [k, v] of Object.entries(c.Properties ?? {})) parsed.set(`${sname}/${cname}.${k}`, v);
      visit(c.Children);
    }
  };
  visit(s.Children);
}
const formulas = [...walkFormulas(screens)];
for (const f of formulas) {
  if (parsed.get(f.id) !== "=" + f.text) problems.push(`YAML round-trip mismatch: ${f.id}`);
}

// ── 2. Schema ─────────────────────────────────────────────────────────────────
// The upstream schema has an unbalanced "(" in the CodeComponent name pattern; fix it on load.
const schemaText = readFileSync("test/schema/pa.schema.yaml", "utf8").replace("^([a-zA-Z][a-zA-Z0-9]{1,7})_)?", "^(([a-zA-Z][a-zA-Z0-9]{1,7})_)?");
const schema = yaml.load(schemaText) as object;
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);
if (!validate(doc)) for (const e of validate.errors!.slice(0, 20)) problems.push(`Schema: ${e.instancePath} ${e.message}`);

// ── 3. Names ──────────────────────────────────────────────────────────────────
const names = new Set<string>();
for (const c of walkControls(screens)) {
  if (names.has(c.name)) problems.push(`Duplicate control name: ${c.name}`);
  names.add(c.name);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c.name)) problems.push(`Bad control name: ${c.name}`);
}
const screenNames = new Set(screens.map((s) => s.name));
const PREFIX = /\b((?:lbl|btn|txt|gal|con|grp|img|rect|pil|cel|dte|spc|lnk|tgl|scr)[A-Z]\w*)\b/g;
const stripStrings = (t: string) => t.replace(/"(?:[^"]|"")*"/g, '""');
for (const f of formulas) {
  for (const m of stripStrings(f.text).matchAll(PREFIX)) {
    const ref = m[1];
    if (ref.startsWith("scr") ? !screenNames.has(ref) : !names.has(ref)) problems.push(`Unknown reference ${ref} in ${f.id}`);
  }
}

// ── 3b. Microsoft canvas QA rules ─────────────────────────────────────────────────────
for (const p of lint(screens)) problems.push(`QA: ${p}`);

// ── 4 & 5. Power Fx parse + function names ─────────────────────────────────────────
const KNOWN = new Set(
  `Abs AddColumns And Average Back Blank Char Clear ClearCollect Coalesce Collect ColorFade ColorValue Concat Concatenate Concurrent Count CountA CountIf CountRows
  Date DateAdd DateDiff DateValue Day Defaults Disable Distinct DropColumns EncodeUrl EndsWith Errors Exit Filter Find First FirstN ForAll GroupBy Hour
  If IfError Index IsBlank IsBlankOrError IsEmpty IsError IsMatch IsNumeric IsToday Language Last LastN Launch Left Len LookUp Lower Match Max Mid Min Minute Mod Month
  Navigate Not Notify Now Or Param Patch Proper RGBA Refresh Remove RemoveIf Replace Reset Right Round RoundDown RoundUp Search Second Select Sequence Set ShowColumns Sort SortByColumns
  Split StartsWith Substitute Sum Switch Table Text Time Today Trim TrimEnds Ungroup Update UpdateContext UpdateIf Upper User Value Weekday With Year`.split(/\s+/),
);
const fxItems = formulas.map((f) => ({ id: f.id, text: f.text }));
const splitNamed = (src: string, prefix: string) =>
  src
    .replace(/\/\/.*$/gm, "")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      const m = s.match(/^(\w+)\s*=\s*([\s\S]*?);?$/);
      return { id: `${prefix}:${m ? m[1] : i}`, text: m ? m[2] : s };
    });
fxItems.push(...splitNamed(APP_FORMULAS, "App.Formulas"));
fxItems.push({ id: "App.OnStart", text: APP_ONSTART });

const dotnet = existsSync(join(homedir(), ".dotnet/dotnet")) ? join(homedir(), ".dotnet/dotnet") : "dotnet";
const fxDll = "tools/fxcheck/bin/out/fxcheck.dll";
if (!existsSync(fxDll)) {
  problems.push("Power Fx checker not built: run `~/.dotnet/dotnet build tools/fxcheck -c Release -o tools/fxcheck/bin/out`");
} else {
  const res = JSON.parse(execFileSync(dotnet, [fxDll], { input: JSON.stringify(fxItems), maxBuffer: 64 * 1024 * 1024 }).toString()) as {
    id: string;
    errors: string[];
    functions: string[];
  }[];
  for (const r of res) {
    for (const e of r.errors) problems.push(`Power Fx: ${r.id}: ${e}`);
    for (const fn of r.functions) if (!KNOWN.has(fn)) problems.push(`Unknown function ${fn} in ${r.id}`);
  }
}

// ── 6. Types: bind every formula against the SharePoint model, controls and canvas enums ──
if (existsSync(fxDll) && !problems.some((p) => p.startsWith("Power Fx:"))) {
  const program = buildProgram(screens, splitNamed(APP_FORMULAS, "App.Formulas").map((f) => ({ name: f.id.split(":")[1], text: f.text })), APP_ONSTART);
  writeFileSync(join(OUT, ".typecheck-program.json"), JSON.stringify(program, null, 1));
  const res = JSON.parse(execFileSync(dotnet, [fxDll, "check"], { input: JSON.stringify(program), maxBuffer: 64 * 1024 * 1024 }).toString()) as { id: string; errors: string[] }[];
  for (const r of res) for (const e of r.errors) problems.push(`Type: ${r.id}: ${e}`);
}

// ── Report ────────────────────────────────────────────────────────────────────
const controls = [...walkControls(screens)].length;
console.log(`${screens.length} screens · ${controls} controls · ${formulas.length} formulas · ${(all.length / 1024).toFixed(0)} KB YAML`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log("✓ schema, QA rules, names, references, Power Fx syntax and types all OK");
