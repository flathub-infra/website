import { cn } from "@/lib/utils"
import {
  CheckCircle,
  CircleChevronRight,
  CircleDashed,
  CircleSlash,
  Clock,
  Package,
  XCircle,
} from "lucide-react"
import { PipelineStatus, PipelineSummary } from "src/codegen-pipeline"

interface BuildStatusProps {
  pipelineSummary: PipelineSummary
}

export interface BuildStep {
  id: string
  name: string
  status: PipelineStatus
}

export function BuildStatus({ pipelineSummary }: BuildStatusProps) {
  const steps: BuildStep[] = []

  if (["stable", "beta"].includes(pipelineSummary.repo)) {
    steps.push({
      id: `${pipelineSummary.id}-build`,
      name: "Build",
      status: (["cancelled", "running", "failed"] as PipelineStatus[]).includes(
        pipelineSummary.status,
      )
        ? pipelineSummary.status
        : "succeeded",
    })
    steps.push({
      id: `${pipelineSummary.id}-publish`,
      name: "Publish",
      status: ["published", "publishing", "superseded", "cancelled"].includes(
        pipelineSummary.status,
      )
        ? pipelineSummary.status
        : "pending",
    })
  } else {
    steps.push({
      id: `${pipelineSummary.id}-build`,
      name: "Build",
      status: (["cancelled", "running", "failed"] as PipelineStatus[]).includes(
        pipelineSummary.status,
      )
        ? pipelineSummary.status
        : "succeeded",
    })
    steps.push({
      id: `${pipelineSummary.id}-test-publish`,
      name: "Upload",
      status: ["committed", "superseded", "cancelled"].includes(
        pipelineSummary.status,
      )
        ? pipelineSummary.status
        : "pending",
    })
  }

  if (pipelineSummary.created_at)
    return (
      <div className="mt-4">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start",
                index < steps.length - 1 && "flex-1",
              )}
            >
              <div className="flex flex-col items-center">
                <div key={step.id} className={"flex flex-1 items-center"}>
                  <StepIcon step={step} />
                </div>
                <span className="truncate max-w-[80px]">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mt-3 h-1 flex-1 mx-1",
                    "bg-flathub-sonic-silver",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-2 text-xs flathub-sonic-silver"></div>
      </div>
    )
}

function StepIcon({ step }: { step: BuildStep }) {
  return (
    <div className={cn("rounded-full p-1", getStepColor(step.status, "text-"))}>
      {step.status === "pending" && <CircleDashed className="size-5" />}
      {step.status === "running" && <Clock className="size-5" />}
      {step.status === "succeeded" && <CheckCircle className="size-5" />}
      {step.status === "committed" && <Package className="size-5" />}
      {step.status === "failed" && <XCircle className="size-5" />}
      {step.status === "cancelled" && <CircleSlash className="size-5" />}
      {step.status === "publishing" && <Package className="size-5" />}
      {step.status === "published" && <Package className="size-5" />}
      {step.status === "superseded" && (
        <CircleChevronRight className="size-5" />
      )}
    </div>
  )
}

function getStepColor(status: PipelineStatus, prefix = ""): string {
  switch (status) {
    case "succeeded":
    case "published":
    case "committed":
      return `${prefix}flathub-status-green`
    case "running":
    case "publishing":
      return `${prefix}primary`
    case "failed":
      return `${prefix}flathub-status-red`
    default:
      return `${prefix}flathub-sonic-silver`
  }
}
