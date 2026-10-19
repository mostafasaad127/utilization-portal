# 1. Team and data model (Dataverse for Teams)

This is the same model as the web portal, mapped onto Dataverse for Teams.

## 1.1 Create the Team and its environment

1. In Teams, create a **private Team**, for example "Tech Catalyst – Utilization". You are its owner.
2. Add the other admins as **owners** and everyone else as **members**. Owners are the portal's Admins; members are Employees.
3. Open the **Power Apps** app in Teams (Apps → search "Power Apps" → Add, then pin it).
4. Go to **Build**, select your Team, and click **Create**. The first time, Teams sets up a Dataverse for Teams environment for the Team, which can take several minutes.
5. Name the app **Utilization**. Power Apps Studio opens. Close the blank screen prompt for now; the tables come first.

From now on, manage tables at **Power Apps → Build → [your Team] → See all → Tables**.

> Dataverse adds a prefix to internal column names (for example `cr8a1_allocation`). In Power Apps you always use the **display names** below, so the prefix never matters.

## 1.2 Tables

Create the tables **in this order**, because later tables look up earlier ones. For each one, choose **New table**, enter the name, rename the primary column if shown, then **Add column** for each row below.

Types use the Teams designer's names: *Text*, *Multiline text*, *Whole number*, *Date only*, *Yes/No*, *Choice*, *Lookup*, *Email*.

### Territory
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Code, e.g. `UK`, `ME` |
| Full name | Text | e.g. United Kingdom |

### Capability
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Code, e.g. `BA`, `PM`, `PdM`, `PO`, `SD`, `PD` |
| Description | Text | e.g. Business Analysis |

### Industry
| Column | Type |
|---|---|
| **Name** (primary) | Text |

### Line of service
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | e.g. UK Tech Catalyst |
| Territory | Lookup → Territory | |

### Client
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | |
| Industry | Lookup → Industry | |
| Internal | Yes/No | Default **No** |

### Person
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Full name |
| Email | Email | Their PwC address; links the person to their Teams account |
| Grade | Choice | Associate, Senior Associate, Manager, Senior Manager, Director, Partner |
| Territory | Lookup → Territory | |
| Primary capability | Lookup → Capability | |
| Active | Yes/No | Default **Yes** |

### Project
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Project name |
| Client | Lookup → Client | Required |
| Industry | Lookup → Industry | |
| Line of service | Lookup → Line of service | |
| Territory | Lookup → Territory | Required |
| Status | Choice | **Pipeline, Active, On hold, Closed** |
| RAG | Choice | **Green, Amber, Red** |
| Start date | Date only | Required |
| End date | Date only | Blank means TBD |
| Multi-tower | Yes/No | Default **No** |
| Engagement leads | Text | Comma-separated names |
| Scope | Multiline text | |
| Last update on | Date only | Set by a flow when a status update is posted |

### Assignment
This is the sensitive table: allocation lives here.

| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Filled by the app, e.g. "Rana Zaki – Evidence Library" |
| Project | Lookup → Project | Required |
| Person | Lookup → Person | Required |
| Capability | Lookup → Capability | |
| Allocation | Whole number | Percent of the person's time, 1–200 |
| Start date | Date only | Required |
| End date | Date only | Blank means until the project ends |
| Note | Text | Role on the project, e.g. "Lead BA" |

### Risk
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | The risk itself (rename the primary column to **Risk**) |
| Project | Lookup → Project | Required |
| Severity | Choice | **Low, Medium, High, Critical** |
| Risk status | Choice | **Open, Mitigating, Closed** (don't call it "Status", which is reserved) |
| Risk owner | Text | (don't call it "Owner", which is reserved) |
| Mitigation | Multiline text | |

### Status update
| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | First line of the update, filled by the app |
| Project | Lookup → Project | Required |
| RAG | Choice | **Green, Amber, Red** |
| Update | Multiline text | |

### Portal admin
A small list that lets the app show admin screens to the right people.

| Column | Type | Notes |
|---|---|---|
| **Name** (primary) | Text | Admin's name |
| Email | Email | Admin's PwC address |

### Migration staging tables (temporary)
These are only needed while loading the existing spreadsheet (see [05-migration.md](05-migration.md)). Every column is **Text**, which makes rows paste cleanly from Excel. Delete these tables after migrating.

- **Import project**: Project name (primary), Client, Industry, Line of service, Territory, Status, RAG, Start date, End date, Multi-tower, Engagement leads, Scope (Multiline text)
- **Import assignment**: Project name (primary), Client, Project start, Person, Capability, Allocation, Start date, End date
- **Import risk**: Project name (primary), Client, Project start, Risk, Severity, Status

## 1.3 Permissions

These settings enforce "employees only see their own figures" in the data itself, not just in the app.

In **Build → See all → Tables**, open each table's **⋯ → Manage permissions** and set **Members** as follows. Owners (admins) always have full access.

| Table | Members | What it means |
|---|---|---|
| **Assignment** | **Private** | Members can only see and edit **their own** assignments. Nobody else's allocation ever reaches their device. |
| Project | Collaborate | Everyone can see projects (needed to join one); members edit only projects they created. Admins edit all. |
| Risk | Collaborate | Everyone can read; members edit risks they raised. |
| Status update | Collaborate | Everyone can read; members edit their own updates. |
| Person | Collaborate | Everyone can see the people list; members can create and edit **their own** profile. |
| Client | Collaborate | Members can add a new client when logging a project. |
| Territory, Capability, Industry, Line of service | Reference | Read-only for members; admins maintain them. |
| Portal admin | Reference | Read-only for members, so nobody can make themselves an admin. |
| Import project / assignment / risk | **None**, or Private if None isn't offered | Admins only. |

> **"Own" means the row's Owner.** When an employee creates their own assignment, they own it automatically. When an admin staffs someone, the app sets the assignment's **Owner** to that person's account (see [02-power-apps.md](02-power-apps.md) §2.6). Without that, the employee wouldn't see their own assignment.

## 1.4 Reference data to add now

Add at least these rows so the app has something to pick from. The migration workbook adds the rest.

- **Territory:** `UK` United Kingdom; `ME` Middle East
- **Capability:** `BA` Business Analysis; `PM` Project Management; `PdM` Product Management; `PO` Product Ownership; `SD` Service Design; `PD` Product Design
- **Portal admin:** one row per admin (name and PwC email). Admins must also be **owners** of the Team; the row only controls which screens they see.
