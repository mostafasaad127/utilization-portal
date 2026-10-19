/**
 * Step 2 of the installer panel: building the Power App. Power Apps has no API
 * for creating a canvas app from a script, so this is a short checklist with
 * Copy buttons for every piece of code (screens, App.Formulas, App.OnStart).
 */
declare const __APP_PACK__: string;

export interface AppFiles {
  formulas: string;
  onStart: string;
  allScreens: string;
  screens: { name: string; yaml: string }[];
}

let cache: Promise<AppFiles> | null = null;
export function appFiles(): Promise<AppFiles> {
  cache ??= (async () => {
    const bin = Uint8Array.from(atob(__APP_PACK__), (c) => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"));
    const files = JSON.parse(await new Response(stream).text()) as AppFiles;
    files.allScreens = "Screens:\n" + files.screens.map((s) => s.yaml.replace(/^Screens:\n/, "")).join("");
    return files;
  })();
  return cache;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / blocked clipboard API: fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

const SCREEN_LABEL: Record<string, string> = {
  scrHome: "Dashboard",
  scrProjects: "Projects",
  scrProject: "Project page",
  scrLog: "Log a project",
  scrJoin: "Join a project",
  scrProfile: "My profile",
  scrTeam: "Team overview",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Copy button markup; `data-copy` names what to copy. */
const btn = (what: string, label: string, primary = false) => `<button class="${primary ? "a" : "s"} cp" data-copy="${what}">${label}</button>`;

export function appStepsHtml(webUrl: string): string {
  const steps: { title: string; body: string }[] = [
    {
      title: "Create a blank canvas app",
      body: `Open <a href="https://make.powerapps.com/" target="_blank" rel="noopener">make.powerapps.com</a> → <b>+ Create</b> → <b>Blank app</b> → <b>Blank canvas app</b>. Name it <b>Utilization Portal</b>, choose <b>Tablet</b>, then <b>Create</b>.`,
    },
    {
      title: "Two settings",
      body: `<b>Settings</b> (gear, top right) → <b>Display</b>: turn <b>Scale to fit</b> off.<br><b>Settings → General</b>: set <b>Data row limit</b> to <b>2000</b>. Close settings.`,
    },
    {
      title: "Connect the lists",
      body: `Left rail → <b>Data</b> (cylinder) → <b>Add data</b> → search <b>SharePoint</b> → pick your connection. Paste the site address, then tick all <b>11 lists starting with “UP”</b> → <b>Connect</b>.
        <div class="row">${btn("site", "Copy site address")}</div><div class="mono">${esc(webUrl)}</div>`,
    },
    {
      title: "Paste the app formulas",
      body: `Tree view → select <b>App</b>. In the property box (top left, next to <i>fx</i>) choose <b>Formulas</b>, click in the formula bar, select all, paste.
        <div class="row">${btn("formulas", "Copy App.Formulas", true)}</div>`,
    },
    {
      title: "Paste the start-up code",
      body: `Still on <b>App</b>: choose <b>OnStart</b> in the property box and paste. Then choose <b>StartScreen</b> and type <b>scrHome</b>.
        <div class="row">${btn("onStart", "Copy App.OnStart", true)}${btn("start", "Copy “scrHome”")}</div>
        Finally right-click <b>App</b> → <b>Run OnStart</b> (loads your data so the screens can see it).`,
    },
    {
      title: "Paste the screens",
      body: `Copy all screens, then in Tree view right-click <b>Screen1</b> → <b>Paste</b> (allow clipboard access if the browser asks).
        <div class="row">${btn("allScreens", "Copy all 7 screens", true)}</div>
        <details><summary>Paste didn't work? Do one screen at a time</summary>
          <div class="row"><span class="hint">Loading…</span></div>
          <div class="hint">Some red errors are expected until all seven screens are in; they clear by themselves.</div>
        </details>`,
    },
    {
      title: "Tidy up and publish",
      body: `Right-click <b>Screen1</b> → <b>Delete</b>. Press <b>Ctrl+S</b>, then <b>Publish</b>. Use <b>Share</b> to add your team (they also need to be <b>members of this SharePoint site</b>). Optional: <b>Publish to Teams</b>.`,
    },
  ];
  return `<ol class="steps">${steps
    .map(
      (s, i) => `<li><label class="chk"><input type="checkbox" data-step="${i}"><span class="st">${s.title}</span></label><div class="sb">${s.body}</div></li>`,
    )
    .join("")}</ol>
    <div class="hint">Stuck? Copy the exact red error text from Power Apps (hover the ⚠ in the tree view) and send it over.</div>`;
}

export function wireAppSteps(root: ShadowRoot, webUrl: string, toast: (msg: string) => void) {
  // Per-screen buttons are filled in once the app code is unpacked.
  appFiles().then((files) => {
    const holder = root.querySelector<HTMLDivElement>("details .row");
    if (holder) holder.innerHTML = files.screens.map((s, i) => btn(`screen:${s.name}`, `${i + 1}. ${SCREEN_LABEL[s.name] ?? s.name}`)).join("");
  });
  root.addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button.cp");
    if (!b) return;
    const what = b.dataset.copy!;
    const files = await appFiles();
    const text =
      what === "site" ? webUrl
      : what === "start" ? "scrHome"
      : what === "formulas" ? files.formulas
      : what === "onStart" ? files.onStart
      : what === "allScreens" ? files.allScreens
      : files.screens.find((s) => `screen:${s.name}` === what)?.yaml ?? "";
    const ok = await copyText(text);
    const old = b.textContent;
    b.textContent = ok ? "Copied ✓" : "Copy failed";
    setTimeout(() => (b.textContent = old), 1600);
    toast(ok ? `Copied ${(text.length / 1024).toFixed(0)} KB to the clipboard` : "Your browser blocked the clipboard. Try again, or use Ctrl+C on the text.");
  });
  // Remember ticked steps.
  const KEY = "up-installer-steps";
  let done: number[] = [];
  try {
    done = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    /* storage unavailable */
  }
  root.querySelectorAll<HTMLInputElement>("input[data-step]").forEach((cb) => {
    cb.checked = done.includes(Number(cb.dataset.step));
    cb.addEventListener("change", () => {
      const all = [...root.querySelectorAll<HTMLInputElement>("input[data-step]")].filter((x) => x.checked).map((x) => Number(x.dataset.step));
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch {
        /* storage unavailable */
      }
    });
  });
}
