# Installer and app generator (maintainers)

`dist/install.js` is one self-contained script. Pasted into the browser console on a SharePoint site, it:

1. **Installs the data:** creates the lists, sets permissions, seeds reference data, and imports the legacy spreadsheet. It uses SharePoint REST with the signed-in user's own session: no app registration, no tokens.
2. **Hands over the Power App:** shows the pa.yaml screens, `App.Formulas` and `App.OnStart` with Copy buttons. These are generated here, gzipped into the bundle, and unpacked in the browser.

## Layout

| Path | What |
|---|---|
| `src/install.ts` | Installer logic and the panel UI |
| `src/schema.ts` | The SharePoint data model: lists, columns, access. **Single source of truth**, also used by the app type checker |
| `src/sharepoint.ts` | Minimal REST client (digest, throttling retries, paging) |
| `src/xlsx.ts` | Browser `.xlsx` reader; feeds the portal's tested `planImport` |
| `src/app-steps.ts` | "Build the app" tab: steps, Copy buttons, unpacking |
| `app/dsl.ts` | Small DSL for classic controls and containers, plus the pa.yaml emitter |
| `app/ui.ts` | Page shell (header, nav, page header) and components (tiles, pills, pickers, tables, dialogs) |
| `app/theme.ts` | Appkit tokens, `App.Formulas`, `App.OnStart` |
| `app/screens/*.ts` | The seven screens |
| `app/lint.ts` | Microsoft's canvas QA rules, plus a property whitelist from Studio's control templates (`app/control-props.json`) |
| `app/typecheck.ts` + `tools/fxcheck` | Type checks every formula with Microsoft's Power Fx engine against the SharePoint model |
| `test/mock-sharepoint.mjs` | Strict mock of the SharePoint REST endpoints the installer uses |

## Commands

```bash
npm install
npm run build      # generate + validate the app, then bundle dist/install.js
npm test           # generate + validate only
npm run mock       # mock SharePoint on http://localhost:4310/sites/up
```

The validator needs the .NET 8 SDK for the Power Fx checks. To install it for your user only:

```bash
curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0
```

Then build the checker once:

```bash
~/.dotnet/dotnet build tools/fxcheck -c Release -o tools/fxcheck/bin/out
```

## What `npm test` checks

1. **YAML:** the output parses, and every formula round-trips exactly. Formulas containing `:` or `#` are written as `|-` blocks.
2. **Schema:** the output matches Microsoft's pa.yaml v3.0 schema (`test/schema/pa.schema.yaml`).
3. **QA rules:** Microsoft's canvas QA checklist, from `microsoft/power-platform-skills` (`QAChecks.md`):
   - variants are set, and containers have a minimum size of 0;
   - `FillPortions` is explicit, with no flexible children in scroll containers;
   - galleries are never sized from `AllItems`, and `TemplateWidth` is only used on a gallery's direct child;
   - no interactive control sits under a read-only parent;
   - every property exists on its control (checked against Studio's control templates).
4. **Names:** names are unique, and every referenced control and screen exists.
5. **Power Fx:** every formula parses, and only real canvas functions are used.
6. **Types:** every formula binds and type-checks against the SharePoint lists, collections, variables, controls and canvas enums, and returns the type its property expects. A misspelled column, a wrong lookup or choice shape, or a number where a date belongs all fail.

## Mock testing

With `npm run mock` running, open `http://localhost:4310/sites/up` and run the following in the console:

```js
(0, eval)(await (await fetch("/install.js")).text())
```

`/__state` shows what was created; `/fixtures/legacy-sample.xlsx` is a sample workbook.
