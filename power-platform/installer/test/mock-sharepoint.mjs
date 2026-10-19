// Strict in-memory mock of the SharePoint REST endpoints the installer uses.
// Rejects unknown fields, wrong entity types and malformed field XML, so bugs
// surface here rather than on the real site. Not a full SharePoint emulator.
import http from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 4310);
const WEB = "/sites/up";
const KNOWN_USERS = new Map([
  ["admin@pwc.com", { Id: 7, Title: "Portal Admin" }],
  ["rana.zaki@pwc.com", { Id: 11, Title: "Rana Zaki" }],
  ["omar.farouk@pwc.com", { Id: 12, Title: "Omar Farouk" }],
]);
const ROLE_DEFS = [
  { Id: 1073741829, Name: "Full Control", RoleTypeKind: 5 },
  { Id: 1073741830, Name: "Edit", RoleTypeKind: 6 },
  { Id: 1073741827, Name: "Contribute", RoleTypeKind: 3 },
  { Id: 1073741826, Name: "Read", RoleTypeKind: 2 },
];
const GROUPS = { owners: 3, visitors: 4, members: 5 };
const BUILTIN = ["Title", "ID", "Author", "Editor", "Created", "Modified", "ContentType", "Attachments"];

const state = { lists: new Map(), requests: 0, errors: [] };

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json;odata=verbose;charset=utf-8" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const fail = (res, status, message) => {
  state.errors.push(message);
  send(res, status, { error: { code: "-1", message: { lang: "en-US", value: message } } });
};

function parseFieldXml(xml) {
  const attr = (n) => (xml.match(new RegExp(`\\s${n}='([^']*)'`)) ?? [])[1];
  if (!/^<Field [^>]*(\/>|>.*<\/Field>)$/s.test(xml)) throw new Error(`Malformed field XML: ${xml}`);
  const type = attr("Type");
  const name = attr("Name");
  if (!type || !name || /\s/.test(name)) throw new Error(`Field needs Type and a space-free Name: ${xml}`);
  if (type === "Lookup") {
    const listId = (attr("List") ?? "").replace(/[{}]/g, "");
    if (!state.lists.has(listId)) throw new Error(`Lookup ${name} points at unknown list ${listId}`);
  }
  if (type === "Choice" && !/<CHOICES>(<CHOICE>[^<]+<\/CHOICE>)+<\/CHOICES>/.test(xml)) throw new Error(`Choice ${name} has no choices`);
  return { InternalName: name, Type: type, Title: attr("DisplayName"), SchemaXml: xml };
}

function listFromPath(path) {
  const m = path.match(/web\/lists\(guid'([0-9a-f-]+)'\)/);
  return m ? state.lists.get(m[1]) : null;
}

function select(obj, query) {
  const sel = new URLSearchParams(query).get("$select");
  if (!sel) return obj;
  const out = {};
  for (const f of sel.split(",")) {
    const [a, b] = f.split("/");
    if (b) out[a] = { ...(out[a] ?? {}), [b]: obj[a]?.[b] };
    else out[a] = obj[a];
  }
  return out;
}

async function body(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  return data ? JSON.parse(data) : undefined;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.headers["x-http-method"] === "MERGE" ? "MERGE" : req.method;

  if (url.pathname === "/__state") {
    const lists = [...state.lists.values()].map((l) => ({
      title: l.Title,
      url: l.Url,
      fields: l.fields.map((f) => `${f.InternalName}:${f.Type}`),
      items: l.items.length,
      hasUnique: l.HasUniqueRoleAssignments,
      members: l.roles.get(GROUPS.members),
      readSecurity: l.ReadSecurity,
      writeSecurity: l.WriteSecurity,
      sample: l.items.slice(0, 2),
      authors: [...new Set(l.items.map((i) => i.Author.EMail))],
    }));
    return send(res, 200, { requests: state.requests, errors: state.errors, lists });
  }
  if (url.pathname.startsWith("/fixtures/")) {
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    return res.end(readFileSync(new URL(`.${url.pathname}`, import.meta.url)));
  }
  if (url.pathname === "/install.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end(readFileSync(new URL("../dist/install.js", import.meta.url)));
  }
  if (url.pathname === WEB || url.pathname === `${WEB}/`) {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><title>Tech Catalyst – Utilization (mock SharePoint)</title>
      <body style="font-family:Segoe UI,Arial;background:#faf9f8;padding:32px"><h1>Mock SharePoint site</h1>
      <script>var _spPageContextInfo = { webAbsoluteUrl: location.origin + "${WEB}" };</script></body>`);
  }
  if (!url.pathname.startsWith(`${WEB}/_api/`)) return fail(res, 404, `Not found: ${url.pathname}`);

  state.requests++;
  const path = decodeURIComponent(url.pathname.slice(`${WEB}/_api/`.length));
  const q = url.search.slice(1);
  if (method !== "GET" && path !== "contextinfo" && req.headers["x-requestdigest"] !== "digest-123") return fail(res, 403, "Missing or invalid X-RequestDigest");
  let payload;
  try {
    payload = await body(req);
  } catch {
    return fail(res, 400, "Body is not valid JSON");
  }

  try {
    // ── web ─────────────────────────────────────────────────────────────
    if (path === "contextinfo" && method === "POST") return send(res, 200, { d: { GetContextWebInformation: { FormDigestValue: "digest-123", FormDigestTimeoutSeconds: 1800 } } });
    if (path === "web" && method === "GET") {
      return send(res, 200, { d: select({ Title: "Tech Catalyst – Utilization", Url: `http://localhost:${PORT}${WEB}`, EffectiveBasePermissions: { High: "2147483647", Low: "4294967295" } }, q) });
    }
    if (path === "web/currentuser") return send(res, 200, { d: { Id: 7, Title: "Portal Admin", Email: "admin@pwc.com" } });
    if (path === "web/associatedmembergroup") return send(res, 200, { d: { Id: GROUPS.members, Title: "Tech Catalyst Members" } });
    if (path === "web/roledefinitions") return send(res, 200, { d: { results: ROLE_DEFS } });
    if (path === "web/ensureuser" && method === "POST") {
      const email = (payload?.logonName ?? "").split("|").pop();
      const u = KNOWN_USERS.get(email);
      return u ? send(res, 200, { d: { ...u, Email: email } }) : fail(res, 400, `The specified user ${payload?.logonName} could not be found.`);
    }

    // ── lists ───────────────────────────────────────────────────────────
    const byTitle = path.match(/^web\/lists\/getbytitle\('([^']+)'\)$/);
    if (byTitle && method === "GET") {
      const l = [...state.lists.values()].find((x) => x.Title === byTitle[1]);
      return l ? send(res, 200, { d: select(l, q) }) : fail(res, 404, `List '${byTitle[1]}' does not exist at site with URL '${WEB}'.`);
    }
    if (path === "web/lists" && method === "POST") {
      if (payload?.__metadata?.type !== "SP.List" || payload.BaseTemplate !== 100) throw new Error("Bad list create payload");
      if (/\s/.test(payload.Title)) throw new Error("Create lists with a space-free title (it becomes the URL)");
      const id = randomUUID();
      const l = {
        Id: id,
        Title: payload.Title,
        Url: payload.Title,
        ListItemEntityTypeFullName: `SP.Data.${payload.Title}ListItem`,
        fields: BUILTIN.map((n) => ({ InternalName: n, Type: "Builtin", Title: n })),
        items: [],
        nextId: 1,
        HasUniqueRoleAssignments: false,
        roles: new Map(),
        ReadSecurity: 1,
        WriteSecurity: 1,
      };
      state.lists.set(id, l);
      return send(res, 201, { d: { Id: id } });
    }

    const list = listFromPath(path);
    if (!list) return fail(res, 404, `Unknown path ${method} ${path}`);
    const rest = path.replace(/^web\/lists\(guid'[0-9a-f-]+'\)\/?/, "");

    if (rest === "" && method === "GET") return send(res, 200, { d: select(list, q) });
    if (rest === "" && method === "MERGE") {
      if (payload?.__metadata?.type !== "SP.List") throw new Error("MERGE list needs __metadata SP.List");
      for (const [key, v] of Object.entries(payload)) {
        if (key === "__metadata") continue;
        if (!["Title", "ReadSecurity", "WriteSecurity", "Description"].includes(key)) throw new Error(`Unexpected list property ${key}`);
        list[key] = v;
      }
      return send(res, 204);
    }
    if (rest === "fields/getbyinternalnameortitle('Title')" && method === "MERGE") {
      if (payload?.__metadata?.type !== "SP.Field" || !payload.Title) throw new Error("Bad Title field update");
      list.fields.find((f) => f.InternalName === "Title").Title = payload.Title;
      return send(res, 204);
    }
    if (rest === "fields" && method === "GET") return send(res, 200, { d: { results: list.fields.map((f) => ({ InternalName: f.InternalName })) } });
    if (rest === "fields/createfieldasxml" && method === "POST") {
      const p = payload?.parameters;
      if (p?.__metadata?.type !== "SP.XmlSchemaFieldCreationInformation") throw new Error("createfieldasxml needs SP.XmlSchemaFieldCreationInformation");
      const f = parseFieldXml(p.SchemaXml);
      if (list.fields.some((x) => x.InternalName === f.InternalName)) throw new Error(`A duplicate field name "${f.InternalName}" was found.`);
      list.fields.push(f);
      return send(res, 201, { d: { InternalName: f.InternalName } });
    }
    if (/^breakroleinheritance\(copyRoleAssignments=true,clearSubscopes=true\)$/.test(rest) && method === "POST") {
      list.HasUniqueRoleAssignments = true;
      list.roles = new Map([
        [GROUPS.owners, [1073741829]],
        [GROUPS.members, [1073741830]],
        [GROUPS.visitors, [1073741826]],
      ]);
      return send(res, 200, {});
    }
    const del = rest.match(/^roleassignments\/getbyprincipalid\((\d+)\)\/deleteObject$/);
    if (del && method === "POST") {
      if (!list.HasUniqueRoleAssignments) throw new Error("Can't change permissions before breaking inheritance");
      if (!list.roles.has(Number(del[1]))) return fail(res, 404, "Principal not found");
      list.roles.delete(Number(del[1]));
      return send(res, 200, {});
    }
    const add = rest.match(/^roleassignments\/addroleassignment\(principalid=(\d+),roledefid=(\d+)\)$/);
    if (add && method === "POST") {
      if (!list.HasUniqueRoleAssignments) throw new Error("Can't change permissions before breaking inheritance");
      list.roles.set(Number(add[1]), [...(list.roles.get(Number(add[1])) ?? []), Number(add[2])]);
      return send(res, 200, {});
    }

    // ── items ───────────────────────────────────────────────────────────
    if (rest === "items" && method === "GET") {
      const top = Number(new URLSearchParams(q).get("$top") ?? 100);
      const skip = Number(new URLSearchParams(q).get("$skiptoken") ?? 0);
      const pageSize = Math.min(top, 20); // small pages to exercise paging
      const page = list.items.slice(skip, skip + pageSize).map((i) => select(i, q));
      const next = skip + pageSize < list.items.length ? `http://localhost:${PORT}${WEB}/_api/web/lists(guid'${list.Id}')/items?${q.replace(/&?\$skiptoken=\d+/, "")}&$skiptoken=${skip + pageSize}` : undefined;
      return send(res, 200, { d: { results: page, ...(next ? { __next: next } : {}) } });
    }
    if (rest === "items" && method === "POST") {
      if (payload?.__metadata?.type !== list.ListItemEntityTypeFullName) throw new Error(`Wrong entity type ${payload?.__metadata?.type}, expected ${list.ListItemEntityTypeFullName}`);
      const item = { Id: list.nextId++, Author: { EMail: "admin@pwc.com" }, Editor: { EMail: "admin@pwc.com" } };
      for (const [key, v] of Object.entries(payload)) {
        if (key === "__metadata") continue;
        const field = list.fields.find((f) => f.InternalName === key || (f.Type === "Lookup" && `${f.InternalName}Id` === key));
        if (!field) throw new Error(`Column '${key}' does not exist in list ${list.Title}. It may have been deleted by another user.`);
        if (field.Type === "Choice" && v !== null && !field.SchemaXml.includes(`<CHOICE>${v}</CHOICE>`)) throw new Error(`'${v}' isn't a valid choice for ${key}`);
        if (field.Type === "DateTime" && v !== null && Number.isNaN(Date.parse(v))) throw new Error(`Bad date for ${key}: ${v}`);
        if (field.Type === "Lookup" && v !== null && typeof v !== "number") throw new Error(`Lookup ${key} must be a number`);
        item[key] = v;
      }
      for (const f of list.fields) {
        if (/Required='TRUE'/.test(f.SchemaXml ?? "")) {
          const key = f.Type === "Lookup" ? `${f.InternalName}Id` : f.InternalName;
          if (item[key] === undefined || item[key] === null || item[key] === "") throw new Error(`Required column ${f.InternalName} is empty in ${list.Title}`);
        }
      }
      list.items.push(item);
      return send(res, 201, { d: { Id: item.Id } });
    }
    const itemMerge = rest.match(/^items\((\d+)\)$/);
    if (itemMerge && method === "MERGE") {
      const item = list.items.find((i) => i.Id === Number(itemMerge[1]));
      if (!item) return fail(res, 404, "Item does not exist");
      Object.assign(item, Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "__metadata")));
      return send(res, 204);
    }
    const vul = rest.match(/^items\((\d+)\)\/validateupdatelistitem$/);
    if (vul && method === "POST") {
      const item = list.items.find((i) => i.Id === Number(vul[1]));
      if (!item) return fail(res, 404, "Item does not exist");
      if (payload?.bNewDocumentUpdate !== true) throw new Error("bNewDocumentUpdate must be true to keep the version");
      const results = payload.formValues.map((fv) => {
        if (fv.__metadata?.type !== "SP.ListItemFormUpdateValue") throw new Error("formValues need SP.ListItemFormUpdateValue");
        const email = JSON.parse(fv.FieldValue)[0].Key.split("|").pop();
        if (!KNOWN_USERS.has(email)) return { FieldName: fv.FieldName, HasException: true, ErrorMessage: `The user does not exist or is not unique.` };
        item[fv.FieldName] = { EMail: email };
        return { FieldName: fv.FieldName, HasException: false, ErrorMessage: null };
      });
      return send(res, 200, { d: { ValidateUpdateListItem: { results } } });
    }
    return fail(res, 404, `Unhandled ${method} ${path}`);
  } catch (e) {
    return fail(res, 400, e.message);
  }
});

server.listen(PORT, () => console.log(`Mock SharePoint on http://localhost:${PORT}${WEB}`));
