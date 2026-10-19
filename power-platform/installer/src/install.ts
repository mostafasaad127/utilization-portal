/**
 * Utilization Portal — SharePoint installer.
 *
 * Paste the built dist/install.js into the browser console (F12) while on the
 * SharePoint site that will hold the portal. A panel appears; click Install.
 * Everything runs with your own SharePoint session. Safe to run repeatedly:
 * existing lists, columns and items are detected and skipped.
 */
import { LISTS, SEED, fieldXml, type ListDef } from "./schema";
import { SharePoint, SpError, detectWebUrl } from "./sharepoint";
import { readXlsx } from "./xlsx";
import { appStepsHtml, wireAppSteps } from "./app-steps";
import { planImport, type ImportPlan } from "../../../pwc-utilization-portal/src/lib/import/plan";

type ListInfo = { id: string; entityType: string };
type LogKind = "info" | "ok" | "warn" | "error" | "step";
type Logger = (msg: string, kind?: LogKind) => void;
type Options = { checkOnly: boolean; file: File | null; guessEmails: boolean; emailDomain: string };

const VERSION = "1.1.0";
const STATUS_LABEL: Record<string, string> = { PIPELINE: "Pipeline", ACTIVE: "Active", ON_HOLD: "On hold", CLOSED: "Closed" };
const RAG_LABEL: Record<string, string> = { GREEN: "Green", AMBER: "Amber", RED: "Red" };

// SharePoint base permissions (low 32 bits) we need on the site.
const PERM_MANAGE_LISTS = 0x800;
const PERM_MANAGE_PERMISSIONS = 0x2000000;

const k = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const spDate = (d: Date | null) => (d ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toISOString() : null);
const claim = (email: string) => `i:0#.f|membership|${email}`;

class Installer {
  lists: Record<string, ListInfo> = {};
  constructor(
    private sp: SharePoint,
    private log: Logger,
  ) {}

  // ── Pre-flight ──────────────────────────────────────────────────────────
  async preflight() {
    const web = await this.sp.get<{ Title: string; Url: string }>("web?$select=Title,Url");
    this.log(`Site: ${web.Title} (${web.Url})`, "info");
    const perms = await this.sp.get<{ EffectiveBasePermissions: { Low: string } }>("web?$select=EffectiveBasePermissions");
    const low = Number(perms.EffectiveBasePermissions.Low);
    if (!(low & PERM_MANAGE_LISTS) || !(low & PERM_MANAGE_PERMISSIONS)) {
      throw new Error("You need to be an owner of this site to install (Manage lists + Manage permissions). Ask a site owner to run it, or to make you an owner.");
    }
    const me = await this.sp.get<{ Id: number; Title: string; Email: string }>("web/currentuser?$select=Id,Title,Email");
    this.log(`Signed in as ${me.Title} — site owner ✓`, "ok");
    return me;
  }

  // ── Lists, columns, permissions ─────────────────────────────────────────
  async ensureLists(checkOnly: boolean) {
    for (const def of LISTS) {
      const existing = await this.sp.tryGet<{ Id: string; ListItemEntityTypeFullName: string }>(
        `web/lists/getbytitle('${def.title}')?$select=Id,ListItemEntityTypeFullName`,
      );
      if (existing) {
        this.lists[def.key] = { id: existing.Id, entityType: existing.ListItemEntityTypeFullName };
        if (!checkOnly) await this.ensureFields(def);
        this.log(`${def.title}: exists`, "ok");
        continue;
      }
      if (checkOnly) {
        this.log(`${def.title}: will be created (${def.fields.length + 1} column${def.fields.length ? "s" : ""})`, "info");
        continue;
      }
      const created = await this.sp.post<{ Id: string }>("web/lists", {
        __metadata: { type: "SP.List" },
        BaseTemplate: 100,
        Title: def.url, // creating with the space-free name gives a clean URL…
        Description: def.description,
        AllowContentTypes: true,
        ContentTypesEnabled: false,
      });
      await this.sp.merge(`web/lists(guid'${created.Id}')`, { __metadata: { type: "SP.List" }, Title: def.title }); // …then rename
      const info = await this.sp.get<{ ListItemEntityTypeFullName: string }>(`web/lists(guid'${created.Id}')?$select=ListItemEntityTypeFullName`);
      this.lists[def.key] = { id: created.Id, entityType: info.ListItemEntityTypeFullName };
      await this.ensureFields(def);
      this.log(`${def.title}: created`, "ok");
    }
  }

  private async ensureFields(def: ListDef) {
    const listPath = `web/lists(guid'${this.lists[def.key].id}')`;
    await this.sp.merge(`${listPath}/fields/getbyinternalnameortitle('Title')`, { __metadata: { type: "SP.Field" }, Title: def.titleDisplay });
    const existing = await this.sp.get<{ results: { InternalName: string }[] }>(`${listPath}/fields?$select=InternalName&$top=500`);
    const have = new Set(existing.results.map((f) => f.InternalName));
    for (const f of def.fields) {
      if (have.has(f.name)) continue;
      const lookupId = f.type === "Lookup" ? this.lists[f.list]?.id : undefined;
      await this.sp.post(`${listPath}/fields/createfieldasxml`, {
        parameters: {
          __metadata: { type: "SP.XmlSchemaFieldCreationInformation" },
          SchemaXml: fieldXml(f, lookupId),
          Options: 8 | 16, // keep our internal name + add to the default view
        },
      });
    }
  }

  async ensurePermissions(checkOnly: boolean) {
    const members = await this.sp.tryGet<{ Id: number; Title: string }>("web/associatedmembergroup?$select=Id,Title");
    if (!members) {
      this.log("This site has no Members group, so list permissions were left as they are. Set them manually (see README).", "warn");
      return;
    }
    const roles = await this.sp.get<{ results: { Id: number; RoleTypeKind: number; Name: string }[] }>("web/roledefinitions?$select=Id,Name,RoleTypeKind");
    const read = roles.results.find((r) => r.RoleTypeKind === 2);
    const contribute = roles.results.find((r) => r.RoleTypeKind === 3);
    if (!read || !contribute) throw new Error("Couldn't find the Read / Contribute permission levels on this site.");

    for (const def of LISTS) {
      const list = this.lists[def.key];
      if (!list) continue;
      const level = def.access === "reference" ? read : contribute;
      const plan =
        def.access === "private"
          ? "members see and edit only their own items"
          : def.access === "own-edit"
            ? "members read all, edit their own"
            : def.access === "reference"
              ? "members read only"
              : "members read and edit";
      if (checkOnly) {
        this.log(`${def.title}: ${plan}`, "info");
        continue;
      }
      const path = `web/lists(guid'${list.id}')`;
      const { HasUniqueRoleAssignments } = await this.sp.get<{ HasUniqueRoleAssignments: boolean }>(`${path}?$select=HasUniqueRoleAssignments`);
      if (!HasUniqueRoleAssignments) await this.sp.post(`${path}/breakroleinheritance(copyRoleAssignments=true,clearSubscopes=true)`);
      // Members get Contribute (or Read) instead of the site's Edit level, which
      // would let them change list settings and bypass item-level permissions.
      try {
        await this.sp.post(`${path}/roleassignments/getbyprincipalid(${members.Id})/deleteObject`);
      } catch (e) {
        if (!(e instanceof SpError && (e.status === 404 || e.status === 400))) throw e;
      }
      await this.sp.post(`${path}/roleassignments/addroleassignment(principalid=${members.Id},roledefid=${level.Id})`);

      if (def.access === "private" || def.access === "own-edit") {
        try {
          await this.sp.merge(path, {
            __metadata: { type: "SP.List" },
            ...(def.access === "private" ? { ReadSecurity: 2 } : {}),
            WriteSecurity: 2,
          });
        } catch (e) {
          this.log(
            `${def.title}: couldn't switch on item-level permissions automatically (${(e as Error).message}). ` +
              `Set it by hand: List settings → Advanced settings → Item-level permissions → ` +
              (def.access === "private" ? `Read: "Read items that were created by the user", ` : "") +
              `Create and edit: "Create items and edit items that were created by the user".`,
            "warn",
          );
          continue;
        }
      }
      this.log(`${def.title}: ${plan} ✓`, "ok");
    }
  }

  // ── Reference data ──────────────────────────────────────────────────────
  private async create(listKey: string, fields: Record<string, unknown>) {
    const list = this.lists[listKey];
    return this.sp.post<{ Id: number }>(`web/lists(guid'${list.id}')/items`, { __metadata: { type: list.entityType }, ...fields });
  }

  async seedReference() {
    for (const key of ["territories", "capabilities"] as const) {
      const items = await this.sp.allItems<{ Id: number; Title: string }>(this.lists[key].id, "Id,Title");
      const have = new Set(items.map((i) => k(i.Title)));
      let added = 0;
      for (const row of SEED[key]) {
        if (have.has(k(row.Title))) continue;
        await this.create(key, row);
        added++;
      }
      this.log(`${key === "territories" ? "Territories" : "Capabilities"}: ${added ? `${added} added` : "already there"}`, "ok");
    }
  }

  async ensureMeAsAdmin(me: { Title: string; Email: string }) {
    const admins = await this.sp.allItems<{ Email: string }>(this.lists.admins.id, "Email");
    if (admins.length === 0 && me.Email) {
      await this.create("admins", { Title: me.Title, Email: me.Email });
      this.log(`Added you (${me.Email}) to UP Admins`, "ok");
    }
  }

  // ── Import the legacy workbook ──────────────────────────────────────────
  async importPlan(plan: ImportPlan, opts: Options) {
    const byTitle = async (key: string) => {
      const items = await this.sp.allItems<{ Id: number; Title: string }>(this.lists[key].id, "Id,Title");
      return new Map(items.map((i) => [k(i.Title), i.Id] as const));
    };
    const territories = await byTitle("territories");
    const capabilities = await byTitle("capabilities");
    const industries = await byTitle("industries");
    const los = await byTitle("linesOfService");
    const clients = await byTitle("clients");

    const ensure = async (map: Map<string, number>, key: string, title: string, extra: Record<string, unknown> = {}) => {
      const hit = map.get(k(title));
      if (hit) return hit;
      const { Id } = await this.create(key, { Title: title, ...extra });
      map.set(k(title), Id);
      return Id;
    };

    for (const p of plan.projects) {
      await ensure(territories, "territories", p.territory);
      if (p.industry) await ensure(industries, "industries", p.industry);
    }
    for (const p of plan.projects) {
      if (p.lineOfService) await ensure(los, "linesOfService", p.lineOfService, { TerritoryId: territories.get(k(p.territory)) });
      await ensure(clients, "clients", p.client, p.industry ? { IndustryId: industries.get(k(p.industry)) } : {});
      for (const a of p.assignments) if (a.capability) await ensure(capabilities, "capabilities", a.capability);
    }
    this.log(`Reference data ready: ${clients.size} clients, ${los.size} lines of service, ${industries.size} industries`, "ok");

    // People: match by name; optionally guess first.last@domain and keep it only if the directory knows it.
    const peopleItems = await this.sp.allItems<{ Id: number; Title: string; Email: string | null }>(this.lists.people.id, "Id,Title,Email");
    const people = new Map(peopleItems.map((i) => [k(i.Title), { id: i.Id, email: i.Email ?? "" }] as const));
    let guessed = 0;
    for (const p of plan.projects) {
      for (const a of p.assignments) {
        if (people.has(k(a.person))) continue;
        let email = "";
        if (opts.guessEmails) {
          const candidate = `${a.person.trim().toLowerCase().split(/\s+/).join(".").replace(/[^a-z.'-]/g, "")}@${opts.emailDomain}`;
          try {
            await this.sp.post("web/ensureuser", { logonName: claim(candidate) });
            email = candidate;
            guessed++;
          } catch {
            /* not in the directory: leave blank for an admin to fill in */
          }
        }
        const { Id } = await this.create("people", {
          Title: a.person,
          Email: email || null,
          IsActive: true,
          TerritoryId: territories.get(k(p.territory)) ?? null,
          PrimaryCapabilityId: a.capability ? capabilities.get(k(a.capability)) ?? null : null,
        });
        people.set(k(a.person), { id: Id, email });
        // People edit their own profile (own-edit list), so hand the row to them.
        if (email) await this.setOwner("people", Id, email);
      }
    }
    this.log(`People ready: ${people.size}${opts.guessEmails ? ` (${guessed} emails matched in the directory)` : ""}`, "ok");

    // Projects (skip ones that already exist: same name + client + start date).
    const projItems = await this.sp.allItems<{ Id: number; Title: string; ClientId: number; StartDate: string }>(this.lists.projects.id, "Id,Title,ClientId,StartDate");
    const projKey = (title: string, clientId: number | undefined, start: string | null) => `${k(title)}|${clientId}|${(start ?? "").slice(0, 10)}`;
    const projects = new Map(projItems.map((i) => [projKey(i.Title, i.ClientId, i.StartDate), i.Id] as const));
    let newProjects = 0;
    let newAssignments = 0;
    let newRisks = 0;
    let owned = 0;

    for (const p of plan.projects) {
      const clientId = clients.get(k(p.client));
      const key = projKey(p.name, clientId, spDate(p.startDate));
      let projectId = projects.get(key);
      if (!projectId) {
        ({ Id: projectId } = await this.create("projects", {
          Title: p.name,
          ClientId: clientId,
          IndustryId: p.industry ? industries.get(k(p.industry)) : null,
          LineOfServiceId: p.lineOfService ? los.get(k(p.lineOfService)) : null,
          TerritoryId: territories.get(k(p.territory)),
          ProjectStatus: STATUS_LABEL[p.status],
          RAG: RAG_LABEL[p.rag],
          StartDate: spDate(p.startDate),
          EndDate: spDate(p.endDate),
          MultiTower: p.multiTower,
          EngagementLeads: p.engagementLeads.join(", ").slice(0, 255) || null,
          Scope: p.scope,
        }));
        projects.set(key, projectId);
        newProjects++;

        for (const a of p.assignments) {
          const person = people.get(k(a.person))!;
          const { Id } = await this.create("assignments", {
            Title: `${a.person} – ${p.name}`.slice(0, 255),
            ProjectId: projectId,
            PersonId: person.id,
            PersonEmail: person.email || null,
            CapabilityId: a.capability ? capabilities.get(k(a.capability)) ?? null : null,
            Allocation: a.allocation,
            StartDate: spDate(p.startDate),
            EndDate: spDate(p.endDate),
          });
          newAssignments++;
          if (person.email && (await this.setOwner("assignments", Id, person.email))) owned++;
        }
        for (const risk of p.risks) {
          await this.create("risks", {
            Title: risk.slice(0, 255),
            ProjectId: projectId,
            Severity: "Medium",
            RiskStatus: p.status === "CLOSED" ? "Closed" : "Open",
          });
          newRisks++;
        }
        this.log(`Project ${newProjects}/${plan.projects.length}: ${p.name}`, "info");
      }
    }
    this.log(
      `Imported ${newProjects} projects, ${newAssignments} assignments (${owned} handed to their owners), ${newRisks} risks. ` +
        `${plan.projects.length - newProjects} already existed and were skipped.`,
      "ok",
    );
  }

  /** Make `email` the creator of an item, so item-level permissions let them see it. */
  async setOwner(listKey: string, itemId: number, email: string) {
    const value = JSON.stringify([{ Key: claim(email) }]);
    try {
      const res = await this.sp.post<{ ValidateUpdateListItem: { results: { FieldName: string; HasException: boolean; ErrorMessage: string }[] } }>(
        `web/lists(guid'${this.lists[listKey].id}')/items(${itemId})/validateupdatelistitem`,
        {
          formValues: [
            { __metadata: { type: "SP.ListItemFormUpdateValue" }, FieldName: "Author", FieldValue: value },
            { __metadata: { type: "SP.ListItemFormUpdateValue" }, FieldName: "Editor", FieldValue: value },
          ],
          bNewDocumentUpdate: true,
        },
      );
      const failed = res.ValidateUpdateListItem.results.filter((r) => r.HasException);
      if (failed.length) {
        this.log(`Couldn't hand item ${itemId} to ${email}: ${failed[0].ErrorMessage}`, "warn");
        return false;
      }
      return true;
    } catch (e) {
      this.log(`Couldn't hand item ${itemId} to ${email}: ${(e as Error).message}`, "warn");
      return false;
    }
  }

  /** Re-runnable: fills Person email from UP People and hands every assignment to its person. */
  async fixOwnership() {
    const people = await this.sp.allItems<{ Id: number; Email: string | null; Author: { EMail: string } }>(this.lists.people.id, "Id,Email,Author/EMail&$expand=Author");
    const emailById = new Map(people.map((p) => [p.Id, (p.Email ?? "").trim()] as const));
    let profiles = 0;
    for (const p of people) {
      const email = (p.Email ?? "").trim();
      if (email && k(p.Author?.EMail) !== k(email) && (await this.setOwner("people", p.Id, email))) profiles++;
    }
    if (profiles) this.log(`Ownership: ${profiles} people can now edit their own profile.`, "ok");
    const items = await this.sp.allItems<{ Id: number; PersonId: number; PersonEmail: string | null; Author: { EMail: string } }>(
      this.lists.assignments.id,
      "Id,PersonId,PersonEmail,Author/EMail&$expand=Author",
    );
    let changed = 0;
    let missing = 0;
    for (const it of items) {
      const email = emailById.get(it.PersonId) || (it.PersonEmail ?? "").trim();
      if (!email) {
        missing++;
        continue;
      }
      if (k(it.PersonEmail) !== k(email)) {
        await this.sp.merge(`web/lists(guid'${this.lists.assignments.id}')/items(${it.Id})`, {
          __metadata: { type: this.lists.assignments.entityType },
          PersonEmail: email,
        });
      }
      if (k(it.Author?.EMail) !== k(email) && (await this.setOwner("assignments", it.Id, email))) changed++;
    }
    this.log(`Ownership: ${changed} assignments handed to their person.${missing ? ` ${missing} have no email yet — add emails in UP People, then run Fix ownership again.` : ""}`, "ok");
  }
}

// ── Panel UI ──────────────────────────────────────────────────────────────

const CSS = `
:host{all:initial}
.p{position:fixed;right:24px;bottom:24px;width:520px;max-height:86vh;display:flex;flex-direction:column;background:#fff;color:#252525;
  font:14px/1.45 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:-.2px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.22);z-index:2147483647;overflow:hidden}
.h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #E8E8E8}
.bar{width:4px;height:22px;background:#D04A02;border-radius:2px}
.t{font-weight:600;font-size:15px;flex:1}.v{color:#696969;font-size:12px}
.x{border:0;background:none;font-size:20px;cursor:pointer;color:#696969;line-height:1}
.b{padding:14px 18px;display:flex;flex-direction:column;gap:12px;overflow:auto}
.site{font-size:12px;color:#696969;word-break:break-all}
fieldset{border:1px solid #E8E8E8;border-radius:8px;padding:10px 12px;margin:0}
legend{font-weight:600;font-size:13px;padding:0 4px}
label{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 0;line-height:1.7}
label.guess input[type=checkbox]{margin-top:5px}
input[type=text]{border:1px solid #D1D1D1;border-radius:6px;padding:2px 8px;font:inherit;width:96px;margin:0 2px}
.row{display:flex;gap:8px;flex-wrap:wrap}
button.a{border:0;border-radius:4px;padding:9px 16px;font:inherit;cursor:pointer;background:#D04A02;color:#fff}
button.s{border:1px solid #D04A02;border-radius:4px;padding:8px 14px;font:inherit;cursor:pointer;background:#fff;color:#D04A02}
button:disabled{opacity:.5;cursor:not-allowed}
.log{background:#F7F7F7;border-radius:6px;padding:8px 10px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;height:220px;overflow:auto;white-space:pre-wrap}
.ok{color:#21812D}.warn{color:#8A5A00}.error{color:#C52A1A;font-weight:600}.step{color:#252525;font-weight:600;margin-top:4px}.info{color:#474747}
.hint{font-size:12px;color:#696969}
.tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid #E8E8E8}
.tab{border:0;background:none;font:inherit;padding:10px 4px;margin-right:14px;cursor:pointer;color:#696969;border-bottom:2px solid transparent}
.tab[aria-selected=true]{color:#252525;font-weight:600;border-bottom-color:#D04A02}
.pane[hidden]{display:none}
.steps{margin:0;padding:0 0 0 22px;display:flex;flex-direction:column;gap:12px}
.steps li{padding-left:4px}.steps li::marker{color:#D04A02;font-weight:600}
.chk{margin:0;align-items:center}.chk input{margin:0}.st{font-weight:600}
.sb{font-size:13px;color:#474747;margin:4px 0 0 24px;line-height:1.55}
.sb>.row,.sb>.mono,.sb>details,.sb>.hint{margin:8px 0}
.sb a{color:#D04A02}
.sb .row button{padding:6px 12px;font-size:13px}
.mono{font:12px ui-monospace,Menlo,Consolas,monospace;color:#696969;word-break:break-all}
details summary{cursor:pointer;color:#D04A02;font-size:13px}
details .row{margin-top:8px}
.toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:#252525;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
.toast.on{opacity:1}
`;

function mountPanel() {
  document.getElementById("up-installer-host")?.remove();
  const host = document.createElement("div");
  host.id = "up-installer-host";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  const webUrl = (globalThis as { UP_INSTALLER_WEB_URL?: string }).UP_INSTALLER_WEB_URL ?? detectWebUrl();
  root.innerHTML = `<style>${CSS}</style>
  <div class="p" role="dialog" aria-label="Utilization Portal installer">
    <div class="h"><span class="bar"></span><span class="t">Utilization Portal · Installer</span><span class="v">v${VERSION}</span><button class="x" title="Close" aria-label="Close">×</button></div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="true" data-tab="data">1 · Install data</button>
      <button class="tab" role="tab" aria-selected="false" data-tab="app">2 · Build the app</button>
    </div>
    <div class="b pane" data-pane="data">
      <div class="site">Installing into: <b>${webUrl}</b></div>
      <fieldset><legend>Your existing spreadsheet (optional)</legend>
        <input type="file" id="file" accept=".xlsx">
        <label class="guess"><input type="checkbox" id="guess" checked><span>Guess people's emails as <b>firstname.lastname@</b><input type="text" id="domain" value="pwc.com" aria-label="Email domain"> and keep only the ones the directory recognises</span></label>
        <div class="hint">Every sheet with Project Name, Client and Start_Date columns is read (e.g. FY27-Current, FY26-Archived).</div>
      </fieldset>
      <div class="row">
        <button class="a" id="install">Install</button>
        <button class="s" id="check">Check only</button>
        <button class="s" id="fix" title="Hand each assignment to its person (run after adding emails)">Fix ownership</button>
      </div>
      <div class="log" id="log" aria-live="polite"></div>
    </div>
    <div class="b pane" data-pane="app" hidden>${appStepsHtml(webUrl)}</div>
    <div class="toast" id="toast" role="status"></div>
  </div>`;
  const $ = <T extends HTMLElement>(id: string) => root.getElementById(id) as T;
  const logEl = $("log");
  const log: Logger = (msg, kind = "info") => {
    const line = document.createElement("div");
    line.className = kind;
    line.textContent = `${kind === "ok" ? "✓ " : kind === "warn" ? "! " : kind === "error" ? "✗ " : kind === "step" ? "▸ " : "  "}${msg}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    (kind === "error" ? console.error : console.log)(`[UP installer] ${msg}`);
  };
  const buttons = ["install", "check", "fix"].map((id) => $<HTMLButtonElement>(id));
  const busy = (on: boolean) => buttons.forEach((b) => (b.disabled = on));
  root.querySelector(".x")!.addEventListener("click", () => host.remove());
  const showTab = (tab: string) => {
    root.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === tab)));
    root.querySelectorAll<HTMLElement>(".pane").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  };
  root.querySelectorAll<HTMLButtonElement>(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab!)));
  const toastEl = $("toast");
  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("on"), 2200);
  };
  wireAppSteps(root, webUrl, toast);

  const opts = (checkOnly: boolean): Options => ({
    checkOnly,
    file: $<HTMLInputElement>("file").files?.[0] ?? null,
    guessEmails: $<HTMLInputElement>("guess").checked,
    emailDomain: $<HTMLInputElement>("domain").value.trim().replace(/^@/, "") || "pwc.com",
  });

  const run = async (mode: "install" | "check" | "fix") => {
    busy(true);
    logEl.textContent = "";
    const started = Date.now();
    try {
      const inst = new Installer(new SharePoint(webUrl), log);
      log("Checking access", "step");
      const me = await inst.preflight();
      const o = opts(mode === "check");
      log(mode === "check" ? "Lists (check only — nothing is changed)" : "Lists and columns", "step");
      await inst.ensureLists(o.checkOnly || mode === "fix");
      if (mode === "fix") {
        if (!inst.lists.assignments || !inst.lists.people) throw new Error("The portal lists aren't installed yet. Click Install first.");
        log("Ownership", "step");
        await inst.fixOwnership();
      } else {
        log("Permissions", "step");
        await inst.ensurePermissions(o.checkOnly);
        let plan: ImportPlan | null = null;
        if (o.file) {
          log(`Reading ${o.file.name}`, "step");
          plan = planImport(await readXlsx(o.file));
          const errors = plan.issues.filter((i) => i.level === "error");
          log(`Found ${plan.projects.length} projects in ${plan.sheetsRead.join(", ") || "no sheets"} (${plan.rowsRead} rows)`, plan.projects.length ? "ok" : "warn");
          for (const i of errors.slice(0, 10)) log(`${i.sheet} row ${i.row}: ${i.message} (skipped)`, "warn");
          if (errors.length > 10) log(`…and ${errors.length - 10} more rows skipped`, "warn");
        }
        if (!o.checkOnly) {
          log("Reference data", "step");
          await inst.seedReference();
          await inst.ensureMeAsAdmin(me);
          if (plan) {
            log("Importing your spreadsheet", "step");
            await inst.importPlan(plan, o);
          }
        }
      }
      log(`Done in ${Math.round((Date.now() - started) / 1000)}s.${mode === "install" ? " Next: open the “2 · Build the app” tab." : ""}`, "ok");
    } catch (e) {
      log((e as Error).message, "error");
      log("Nothing is lost — fix the issue and click Install again; finished steps are skipped.", "info");
      console.error(e);
    } finally {
      busy(false);
    }
  };
  $("install").addEventListener("click", () => run("install"));
  $("check").addEventListener("click", () => run("check"));
  $("fix").addEventListener("click", () => run("fix"));
  log("Ready. Choose your spreadsheet (optional), then click Install. Use Check only first if you want a dry run.", "info");
}

mountPanel();
