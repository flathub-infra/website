import { redirect } from "src/i18n/navigation"

interface Props {
  params: {
    projectgroup: string
    locale: string
  }
}

export default function ProjectGroupRedirectPage({ params }: Props) {
  // Redirect to page 1 - Note: this might need to be updated if the actual destination is different
  redirect({
    href: `/apps/collection/project-group/${encodeURIComponent(params.projectgroup)}/1`,
    locale: params.locale,
  })
}
