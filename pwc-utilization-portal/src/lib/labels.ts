import type { Grade, ProjectStatus, Rag, RiskSeverity, RiskStatus, Role } from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  PIPELINE: "Pipeline",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

export const RAG_LABEL: Record<Rag, string> = { GREEN: "Green", AMBER: "Amber", RED: "Red" };

export const GRADE_LABEL: Record<Grade, string> = {
  ASSOCIATE: "Associate",
  SENIOR_ASSOCIATE: "Senior Associate",
  MANAGER: "Manager",
  SENIOR_MANAGER: "Senior Manager",
  DIRECTOR: "Director",
  PARTNER: "Partner",
};

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  OPEN: "Open",
  MITIGATING: "Mitigating",
  CLOSED: "Closed",
};

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", EMPLOYEE: "Employee" };

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: "Sees every project, person and utilization figure; manages users, reference data and imports",
  EMPLOYEE: "Logs their own project work, allocation, risks and status updates; sees only their own projects and stats",
};

export const STATUSES = Object.keys(STATUS_LABEL) as ProjectStatus[];
export const RAGS = Object.keys(RAG_LABEL) as Rag[];
export const GRADES = Object.keys(GRADE_LABEL) as Grade[];
export const SEVERITIES = Object.keys(SEVERITY_LABEL) as RiskSeverity[];
export const RISK_STATUSES = Object.keys(RISK_STATUS_LABEL) as RiskStatus[];
