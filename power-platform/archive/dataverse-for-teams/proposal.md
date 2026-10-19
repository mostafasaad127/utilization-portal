# Proposal: replacing the utilization spreadsheet with a Teams app

**For:** Tech Catalyst / Digital Consulting leadership and IT
**Ask:** agreement to pilot a Microsoft Teams app, built only with tools already approved in PwC's Microsoft 365. No new software, no external hosting, no new licences for employees.

## The problem
The FY26/FY27 utilization sheet is shared and edited by everyone. As a result:
- Anyone can see and change anyone's allocation, with no record of who changed what.
- The data drifts: free-text clients and lines of service, `#NAME?` errors, "TBD" dates, rows for the same project split across people.
- Answering basic questions takes manual work: who is on the bench, who rolls off next month, which projects are Amber or Red.
- Each financial year means a new tab, and history is spread across archives.

## The proposal
A Teams app for the team, made of:

| Part | Built with | Does |
|---|---|---|
| Employee app | Power Apps (in Teams) | Each person logs or joins their projects, sets their own allocation, raises risks and posts status updates, and sees **only their own** figures |
| Admin dashboard | Power BI (Teams tab) | Team utilization, capacity heatmap by month, bench, roll-offs, Amber/Red projects, risk register |
| Data | Dataverse for Teams | Structured, validated records inside the Team; allocation is private to each person at data level |
| Nudges | Power Automate | Weekly "please update your project" messages; roll-off alerts to admins |

**Security and compliance:** PwC sign-in, data stays in PwC's Microsoft 365 tenant, access is Team membership (owners = admins), and every record shows who created and last changed it.

**Cost:** no new licences for employees. Admins viewing the dashboard need Power BI Pro, which is included in Microsoft 365 E5.

## A working prototype already exists
A full web prototype shows the target experience: employee self-service, the admin dashboard, the capacity heatmap and the spreadsheet import. It also proves the data model and rules.

**Prototype:** a hosted demo with sample data is available on request.

## Plan
| Week | Milestone |
|---|---|
| 1 | Build the Team, data model and Power App core screens |
| 2 | Migrate the current sheet; build the Power BI dashboard and flows |
| 3–4 | Pilot with 3–5 people; adjust |
| 5 | Roll out to the team; retire the spreadsheet as read-only |

## Decision needed
Approval to run the pilot in a new private Team, and a nominated co-owner for continuity.
