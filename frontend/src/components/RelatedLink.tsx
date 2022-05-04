import { useTranslation } from "next-i18next"
import Link from "next/link"
import { FunctionComponent } from "react"
import { MdKeyboardArrowLeft } from "react-icons/md"

interface Props {
  href: string
  pageTitle: string
}

/** A link placed at the top of a page's main container to return to some other page
 */
const RelatedLink: FunctionComponent<Props> = ({ href, pageTitle }) => {
  const { t } = useTranslation()

  return (
    <Link href={href} passHref>
      <a style={{ display: "flex", alignItems: "center", marginTop: "8px" }}>
        <MdKeyboardArrowLeft style={{ fontSize: "32px" }} />{" "}
        {t("go-to-page", { page: pageTitle })}
      </a>
    </Link>
  )
}

export default RelatedLink
