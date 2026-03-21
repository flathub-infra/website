import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslations } from "next-intl"

export const EolBadge = () => {
  const t = useTranslations()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            EOL
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{t("app-eol")}</TooltipContent>
    </Tooltip>
  )
}
