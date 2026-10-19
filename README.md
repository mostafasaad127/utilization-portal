# Utilization Portal

A replacement for a team's shared project-utilization spreadsheet: who is staffed on what, at what allocation, plus project status, RAG and risks. Admins see everyone; employees enter their own work and see only their own figures.

The repo holds two editions of the same product:

| Folder | Edition | Notes |
|---|---|---|
| [`pwc-utilization-portal/`](pwc-utilization-portal) | **Web portal**: Next.js 16, Postgres/Prisma, Better Auth with Microsoft Entra ID | The full-featured prototype. Includes audit log, imports, exports and invitations. |
| [`power-platform/`](power-platform) | **Microsoft 365 edition**: SharePoint lists, Power Apps, Power Automate, Power BI | Needs no hosting and no approvals. One script installs it: [`power-platform/installer/dist/install.js`](power-platform/installer/dist/install.js). |

All demo and test data is fictional. Company names are Microsoft's standard sample names (Contoso, Woodgrove Bank and others).
