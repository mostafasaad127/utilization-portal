import type { ProjectStatus, Rag, RiskSeverity, RiskStatus } from "@/generated/prisma/enums";
import { RAG_LABEL, RISK_STATUS_LABEL, SEVERITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "error" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-container-alt text-body",
  primary: "bg-primary-tint text-primary",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning-text",
  error: "bg-error-tint text-error",
  info: "bg-info-tint text-info",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const RAG_DOT: Record<Rag, string> = { GREEN: "bg-success", AMBER: "bg-warning", RED: "bg-error" };
const RAG_TONE: Record<Rag, Tone> = { GREEN: "success", AMBER: "warning", RED: "error" };

/** RAG is shown with a coloured dot *and* a word so it never relies on colour alone. */
export function RagBadge({ rag }: { rag: Rag }) {
  return (
    <Badge tone={RAG_TONE[rag]}>
      <span className={cn("size-2 rounded-full", RAG_DOT[rag])} aria-hidden />
      {RAG_LABEL[rag]}
    </Badge>
  );
}

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  PIPELINE: "info",
  ACTIVE: "primary",
  ON_HOLD: "warning",
  CLOSED: "neutral",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const SEVERITY_TONE: Record<RiskSeverity, Tone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "error", CRITICAL: "error" };

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={severity === "CRITICAL" ? "bg-error text-white" : undefined}>
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

const RISK_STATUS_TONE: Record<RiskStatus, Tone> = { OPEN: "error", MITIGATING: "warning", CLOSED: "neutral" };

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  return <Badge tone={RISK_STATUS_TONE[status]}>{RISK_STATUS_LABEL[status]}</Badge>;
}
