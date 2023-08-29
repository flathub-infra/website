import { Summary } from "../../types/Summary"
import ListBox from "./ListBox"
import { HiCloudArrowDown, HiFolderArrowDown } from "react-icons/hi2"
import { BsHddFill, BsLaptop } from "react-icons/bs"
import { AppStats } from "../../types/AppStats"
import { i18n, useTranslation } from "next-i18next"
import { calculateHumanReadableSize } from "../../size"
import { getIntlLocale } from "../../localize"

const SummaryInfo = ({
  summary,
  stats,
}: {
  summary?: Summary
  stats: AppStats
}) => {
  const { t } = useTranslation()

  return (
    <div className="relative flex flex-wrap gap-2">
      <ListBox
        inACard
        items={[
          {
            icon: <BsHddFill />,
            header: t("installed-size"),
            content: {
              type: "text",
              text: summary
                ? `~${calculateHumanReadableSize(summary.installed_size)}`
                : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      <ListBox
        inACard
        items={[
          {
            icon: <HiFolderArrowDown />,
            header: t("download-size"),
            content: {
              type: "text",
              text: summary
                ? calculateHumanReadableSize(summary.download_size)
                : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      {/* {data.content_rating} */}
      <ListBox
        inACard
        items={[
          {
            icon: <BsLaptop />,
            header: t("available-architectures"),
            content: {
              type: "text",
              text:
                summary && summary.arches && summary.arches.length > 0
                  ? summary.arches.join(", ")
                  : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      {stats.installs_total !== 0 && (
        <ListBox
          inACard
          items={[
            {
              icon: <HiCloudArrowDown />,
              header: t("installs"),
              content: {
                type: "text",
                text: stats.installs_total.toLocaleString(
                  getIntlLocale(i18n.language),
                ),
              },
            },
          ]}
        ></ListBox>
      )}
    </div>
  )
}

export default SummaryInfo
