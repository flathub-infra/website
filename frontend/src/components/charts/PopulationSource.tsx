import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import { ChevronDownIcon } from "@heroicons/react/20/solid"

export default function PopulationSource({
  year,
  revision,
  id,
  className,
  children,
}: {
  year: number
  revision: string
  id?: string
  className?: string
  children?: ReactNode
}) {
  const t = useTranslations()

  return (
    <details
      id={id}
      className={cn("group/source text-sm text-foreground/70", className)}
    >
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 text-xs font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {t("country-downloads.population-source", { year })}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 group-open/source:rotate-180"
        />
      </summary>
      <div className="mt-2 flex max-w-prose flex-col gap-2 text-xs leading-relaxed [&_p]:m-0">
        {children}
        <p>
          {t.rich("country-downloads.source", {
            year,
            revision,
            source: (chunks) => (
              <a href="https://population.un.org/wpp/" className="underline">
                {chunks}
              </a>
            ),
            license: (chunks) => (
              <a
                href="https://creativecommons.org/licenses/by/3.0/igo/"
                className="underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </details>
  )
}
