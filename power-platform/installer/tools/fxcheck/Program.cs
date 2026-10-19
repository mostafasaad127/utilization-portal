// Power Fx checker built on Microsoft's own engine (Microsoft.PowerFx.Core + Interpreter).
//
//   parse mode (default): stdin = [{id, text}]           → syntax errors + function names
//   check mode ("check"):  stdin = program (see below)    → binding/type errors per formula
//
// The check mode models the canvas app: SharePoint lists as typed tables, controls as typed
// records, Self/Parent/ThisItem per formula, canvas enums as option sets, and verifies each
// property's result type against what the property expects.
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.PowerFx;
using Microsoft.PowerFx.Core;
using Microsoft.PowerFx.Syntax;
using Microsoft.PowerFx.Types;

var input = Console.In.ReadToEnd();
if (args.Length > 0 && args[0] == "check") Checker.Run(input);
else Parser.Run(input);

static class Parser
{
    public static void Run(string input)
    {
        var items = JsonSerializer.Deserialize<List<Item>>(input)!;
        var options = new ParserOptions { AllowsSideEffects = true, Culture = CultureInfo.GetCultureInfo("en-US"), MaxExpressionLength = 100_000 };
        var results = new List<object>();
        foreach (var item in items)
        {
            var parse = Engine.Parse(item.text, null, options);
            var calls = new CallCollector();
            parse.Root?.Accept(calls);
            results.Add(new
            {
                item.id,
                errors = parse.Errors.Select(e => $"{e.Message} (at {e.Span?.Min})").ToArray(),
                functions = calls.Names.Distinct().OrderBy(n => n).ToArray(),
            });
        }
        Console.Write(JsonSerializer.Serialize(results));
    }
}

record Item(string id, string text);

class CallCollector : IdentityTexlVisitor
{
    public List<string> Names { get; } = new();
    public override bool PreVisit(CallNode node)
    {
        Names.Add(node.Head.Name.Value);
        return true;
    }
}

static class Checker
{
    static readonly Dictionary<string, string[]> Enums = new()
    {
        ["FontWeight"] = ["Normal", "Semibold", "Bold", "Lighter"],
        ["Align"] = ["Left", "Right", "Center", "Justify"],
        ["VerticalAlign"] = ["Top", "Middle", "Bottom"],
        ["DisplayMode"] = ["Edit", "View", "Disabled"],
        ["LayoutDirection"] = ["Horizontal", "Vertical"],
        ["LayoutAlignItems"] = ["Start", "Center", "End", "Stretch"],
        ["LayoutJustifyContent"] = ["Start", "Center", "End", "SpaceBetween", "SpaceAround", "SpaceEvenly"],
        ["LayoutOverflow"] = ["Hide", "Scroll"],
        ["AlignInContainer"] = ["Start", "Center", "End", "Stretch", "SetByContainer"],
        ["DropShadow"] = ["None", "Light", "Regular", "Semibold", "Bold", "ExtraBold"],
        ["ImagePosition"] = ["Fill", "Fit", "Stretch", "Tile", "Center"],
        ["TextMode"] = ["SingleLine", "MultiLine", "Password"],
        ["TextFormat"] = ["Text", "Number"],
        ["LoadingSpinner"] = ["Controls", "Data", "None"],
        ["ScreenTransition"] = ["None", "Fade", "Cover", "CoverRight", "UnCover", "UnCoverRight"],
        ["NotificationType"] = ["Error", "Information", "Success", "Warning"],
        ["Font"] = ["Arial", "Segoe UI", "Open Sans", "Lato", "Georgia", "Verdana"],
    };

    static FormulaType Spec(JsonNode? n, Dictionary<string, FormulaType> named)
    {
        if (n is JsonValue v)
        {
            var s = v.GetValue<string>();
            return s switch
            {
                "Text" => FormulaType.String,
                "Number" => FormulaType.Number,
                "Boolean" => FormulaType.Boolean,
                "Date" => FormulaType.Date,
                "DateTime" => FormulaType.DateTime,
                "Color" => FormulaType.Color,
                _ => named.TryGetValue(s, out var t) ? t : throw new Exception($"Unknown type {s}"),
            };
        }
        var o = n!.AsObject();
        if (o["k"]!.GetValue<string>() == "table") return ((RecordType)Spec(o["r"], named)).ToTable();
        RecordType r = RecordType.Empty();
        foreach (var kv in o["f"]!.AsObject()) r = r.Add(kv.Key, Spec(kv.Value, named));
        return r;
    }

    public static void Run(string input)
    {
        var prog = JsonNode.Parse(input)!.AsObject();
        var config = new PowerFxConfig(Features.PowerFxV1);
        config.EnableSetFunction();
        config.SymbolTable.EnableMutationFunctions();
        var optionSets = new Dictionary<string, OptionSet>();
        foreach (var (name, members) in Enums)
        {
            var dict = members.ToDictionary(m => m.Replace(" ", ""), m => m);
            var os = new OptionSet(name, DisplayNameUtility.MakeUnique(dict));
            config.AddOptionSet(os);
            optionSets[name] = os;
        }
        var engine = new RecalcEngine(config);
        var opts = new ParserOptions { AllowsSideEffects = true, Culture = CultureInfo.GetCultureInfo("en-US"), MaxExpressionLength = 200_000 };
        var global = new SymbolTable { DebugName = "app" };
        var named = new Dictionary<string, FormulaType>();
        var results = new List<object>();
        void Report(string id, IEnumerable<string> errs) { var e = errs.ToArray(); if (e.Length > 0) results.Add(new { id, errors = e }); }

        // 1. Named record types, then plain globals.
        foreach (var kv in prog["types"]!.AsObject()) named[kv.Key] = Spec(kv.Value, named);
        foreach (var g in prog["globals"]!.AsArray())
            global.AddVariable(g!["name"]!.GetValue<string>(), Spec(g["type"], named), mutable: true);

        // 2. Named formulas and derived collections: type comes from checking the expression.
        foreach (var d in prog["derived"]!.AsArray())
        {
            var name = d!["name"]!.GetValue<string>();
            var r = engine.Check(d["text"]!.GetValue<string>(), opts, global);
            Report($"derive:{name}", r.Errors.Where(e => e.Severity >= ErrorSeverity.Severe).Select(e => e.Message));
            global.AddVariable(name, r.ReturnType ?? FormulaType.String, mutable: true);
        }

        // 3. Controls: typed records by kind.
        var kinds = new Dictionary<string, RecordType>();
        RecordType Kind(string kind, RecordType? thisItem = null)
        {
            var b = RecordType.Empty().Add("X", FormulaType.Number).Add("Y", FormulaType.Number).Add("Width", FormulaType.Number).Add("Height", FormulaType.Number)
                .Add("Visible", FormulaType.Boolean);
            return kind switch
            {
                "label" or "button" => b.Add("Text", FormulaType.String).Add("Size", FormulaType.Number),
                "input" => b.Add("Text", FormulaType.String).Add("HintText", FormulaType.String),
                "date" => b.Add("SelectedDate", FormulaType.Date),
                "gallery" => b.Add("TemplateWidth", FormulaType.Number).Add("TemplateHeight", FormulaType.Number).Add("Selected", thisItem ?? RecordType.Empty()),
                "image" => b.Add("Image", FormulaType.String),
                _ => b,
            };
        }
        var controls = prog["controls"]!.AsArray().ToDictionary(c => c!["name"]!.GetValue<string>(), c => c!["kind"]!.GetValue<string>());
        foreach (var (name, kind) in controls) global.AddVariable(name, Kind(kind), mutable: false);
        foreach (var s in prog["screens"]!.AsArray()) global.AddVariable(s!.GetValue<string>(), RecordType.Empty().Add("Width", FormulaType.Number).Add("Height", FormulaType.Number), mutable: false);

        // 4. Formulas.
        var itemTypes = new Dictionary<string, RecordType>();
        foreach (var f in prog["formulas"]!.AsArray())
        {
            var id = f!["id"]!.GetValue<string>();
            var text = f["text"]!.GetValue<string>();
            var expect = f["expect"]?.GetValue<string>() ?? "Any";
            var local = new SymbolTable { DebugName = "local" };
            var self = f["self"]?.GetValue<string>();
            var parent = f["parent"]?.GetValue<string>();
            var thisItem = f["thisItem"]?.GetValue<string>();
            if (self != null && controls.TryGetValue(self, out var sk)) local.AddVariable("CSelf", Kind(sk), mutable: false);
            if (parent != null)
                local.AddVariable("CParent", controls.TryGetValue(parent, out var pk) ? Kind(pk) : RecordType.Empty().Add("Width", FormulaType.Number).Add("Height", FormulaType.Number), mutable: false);
            if (thisItem != null && itemTypes.TryGetValue(thisItem, out var it)) local.AddVariable("CThisItem", it, mutable: false);
            var symbols = ReadOnlySymbolTable.Compose(local, global);
            var r = engine.Check(text, opts, symbols);
            var errs = r.Errors.Where(e => e.Severity >= ErrorSeverity.Severe).Select(e => e.Message).ToList();
            if (r.IsSuccess && f["galleryItems"] != null && r.ReturnType is TableType tt) itemTypes[f["galleryItems"]!.GetValue<string>()] = tt.ToRecord();
            if (r.IsSuccess && expect != "Any") { var m = Mismatch(r.ReturnType, expect); if (m != null) errs.Add(m); }
            Report(id, errs);
        }
        Console.Write(JsonSerializer.Serialize(results));
    }

    static string? Mismatch(FormulaType t, string expect)
    {
        if (t is BlankType) return null;
        bool ok = expect switch
        {
            "Number" => t is NumberType or DecimalType,
            "Boolean" => t is BooleanType,
            "Color" => t is ColorType || (t is OptionSetValueType c && c.OptionSetName == "Color"),
            "Text" => t is StringType or NumberType or DecimalType or DateType or DateTimeType or BooleanType,
            "Date" => t is DateType or DateTimeType,
            "Table" => t is TableType,
            _ => t is OptionSetValueType os && os.OptionSetName == expect,
        };
        return ok ? null : $"expected {expect} but the formula returns {t.GetType().Name.Replace("Type", "")}{(t is OptionSetValueType o ? " " + o.OptionSetName : "")}";
    }
}
