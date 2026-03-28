import { useTranslations } from "next-intl"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"
import Modal from "../../Modal"
import LicenseInfo from "../LicenseInfo"

const LicenseModal = ({
  isOpen,
  onClose,
  app,
}: {
  isOpen: boolean
  onClose: () => void
  app: Pick<
    GetAppstreamAppstreamAppIdGet200,
    "id" | "is_free_license" | "project_license" | "urls"
  >
}) => {
  const licenseType =
    !app.project_license ||
    app.project_license.startsWith("LicenseRef-proprietary")
      ? "proprietary"
      : app.is_free_license
        ? "floss"
        : "special"

  const headlineKey =
    licenseType === "proprietary"
      ? "proprietary"
      : licenseType === "floss"
        ? "community-built"
        : "special-license"

  const t = useTranslations()

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      title={t(headlineKey)}
      size="sm"
    >
      <LicenseInfo app={app} />
    </Modal>
  )
}

export default LicenseModal
