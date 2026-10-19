# Utilization Portal: Microsoft 365 edition

The Utilization Portal rebuilt on tools every PwC employee already has: **SharePoint lists** for the data, a **Power App** for the screens, and optionally **Power BI** and **Power Automate**. It needs no hosting, no new licences, and no IT approvals, and people sign in with their normal PwC account.

The web portal in `../pwc-utilization-portal` is the working prototype. This edition matches its screens and its rule that employees only see their own figures.

## What you need

- A **SharePoint site where you're an owner**, e.g. a new Team site called "Tech Catalyst – Utilization". Its **members** are your employees; its **owners** are admins.
- **Edge or Chrome**, with access to the developer console (F12).
- **Power Apps**, which is included with Microsoft 365 for apps that use SharePoint.
- The file **`installer/dist/install.js`**. It's the only file you take to work.

## Install: one script, two steps

### Step 1 · Install the data (about 1 minute)

1. Open your SharePoint site's home page in Edge or Chrome.
2. Press **F12** (or right-click → *Inspect*) and open the **Console** tab.
3. Open `install.js` in Notepad, select all, copy, paste it into the console, and press **Enter**.
   - If the browser says pasting is blocked, type `allow pasting`, press Enter, then paste again.
4. A panel opens on the page. Optionally choose your current spreadsheet (`.xlsx`), then click **Install**.

The installer:
- creates the 11 `UP …` lists with all their columns;
- locks them down, so employees can only see and edit **their own allocations**, while admins (site owners) see everything;
- adds the territories and capabilities;
- makes you an admin;
- imports your spreadsheet. Rows for the same project are merged, team members become assignments, and risks are split out.

You can run it again at any time: it only adds what's missing. **Check only** shows what it would do without changing anything.

### Step 2 · Build the app (about 10 minutes)

Click the **2 · Build the app** tab in the same panel and follow the seven ticks. Each piece of code has a **Copy** button: you paste the app formulas, the start-up code, and the seven screens into a new blank Power App, then publish.

| Screen | Who | What it does |
|---|---|---|
| My dashboard | everyone | Greeting, utilization today, FY average, next roll-off, "waiting for your update", FY heat strip, current work, open risks |
| Projects | everyone | My projects or all projects, status filters, search |
| Project page | everyone | Overview, status updates (sets the project RAG), risks; **Team** tab for admins |
| Log a project | everyone | New or edit; type-to-search client, industry and line of service; add a new client inline; your role and allocation |
| Join a project | everyone | Search open projects you're not on; pick a capability, allocation and dates |
| My profile | everyone | Grade, territory, primary capability; edit or leave your assignments |
| Team overview | admins | Team utilization, bench, over-allocated, people table with meters, projects needing attention |

## If something goes wrong

Copy the exact message and send it over; every fix is a small change.
- **Installer:** messages appear in the panel's log. Nothing is lost if it stops halfway: fix the cause and click **Install** again.
- **Power Apps:** red errors appear as ⚠ in the tree view. Hover one to see the message.

Common ones:
- **"You need to be a site owner"**: ask the site owner to make you one, or create your own Team site.
- **Paste does nothing in Power Apps**: allow clipboard access for make.powerapps.com, or paste the screens one at a time (there's a button for each).
- **Screens show errors right after pasting**: make sure step 3 (connect the lists) and step 5 (run OnStart) are done. Errors that point at another screen clear once all seven are pasted.
- **An employee sees no assignments**: their row is owned by whoever created it. Add their email in *UP People*, then click **Fix ownership** in the installer.

## How the privacy works

| Data | Employees | Admins (site owners) |
|---|---|---|
| Assignments (who's on what, at what %) | **only their own**, enforced by SharePoint item-level permissions | everything |
| Projects, clients, risks, status updates | read all; edit projects; edit their own risks and updates | everything |
| People | read all; edit their own profile | everything |
| Territories, capabilities, industries, lines of service, admins | read only | maintain |

This is enforced by SharePoint itself, not just by the app, so it also holds in SharePoint, Excel and Power BI.

## Known limits

- **Who can use it:** members of the SharePoint site. Adding someone means adding them to the site (or its Team).
- **Size:** the app loads up to 2,000 rows per list (the Power Apps limit, set in step 2). That's years of projects for one team.
- **Audit:** every row records who created and last changed it, and when; SharePoint's version history keeps earlier values.
- **Look:** the app follows the portal closely, with Appkit colours and type, the same icons, and SVG visuals. Animations and pixel-perfect spacing are harder in Power Apps.

## Folder guide

| Path | What it is |
|---|---|
| `installer/dist/install.js` | **The one file you need.** The installer, with the whole app inside |
| `installer/` | Source for the installer and the app generator (see `installer/README.md`) |
| `ui-reference/` | Screenshots of the portal screens the app is modelled on |
| `ui/icons.md` | The portal's icons |
| `archive/` | The earlier Dataverse for Teams plan, retired because Microsoft is retiring Dataverse for Teams |
