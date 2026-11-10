import { useId } from "react"
import { useTranslations } from "next-intl"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

export default function PopulationToggle({
  checked,
  onCheckedChange,
  disabled,
  describedBy,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled: boolean
  describedBy?: string
}) {
  const id = useId()
  const t = useTranslations()

  return (
    <FieldGroup className="w-56 max-w-full shrink-0">
      <Field
        orientation="horizontal"
        data-disabled={disabled}
        className="gap-2 rounded-lg bg-muted px-3 py-2.5"
      >
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={describedBy}
        />
        <FieldLabel htmlFor={id}>
          {t("country-downloads.per-100000")}
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}
