import { FunctionComponent, useState } from "react"

import { AddonAppstream } from "../../types/Appstream"
import { useTranslations } from "next-intl"
import clsx from "clsx"
import Modal from "../Modal"
import InstallButton from "./InstallButton"

interface Props {
  addons: Pick<AddonAppstream, "id" | "name" | "summary">[]
}

const AddonRow: FunctionComponent<{
  addon: Pick<AddonAppstream, "id" | "name" | "summary">
}> = ({ addon }) => {
  return (
    <div className="flex items-center">
      <div className="flex flex-col px-4 py-3">
        <div>
          <h3 className="font-semibold">{addon.name}</h3>
        </div>
        <span
          className={clsx(
            "text-sm dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
          )}
        >
          {addon.summary}
        </span>
      </div>
      <div className="ms-auto pe-4">
        <InstallButton appId={addon.id} type={"addon"} />
      </div>
    </div>
  )
}

const Addons: FunctionComponent<Props> = ({ addons }) => {
  const t = useTranslations()

  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      {addons && addons.length > 0 && (
        <>
          <div className="flex flex-col divide-y dark:divide-flathub-granite-gray">
            {addons.slice(0, 5).map((addon) => (
              <AddonRow key={addon.id} addon={addon} />
            ))}
            {addons.length > 5 ? (
              <button
                className="w-full rounded-bl-xl rounded-br-xl rounded-tl-none rounded-tr-none px-0 py-3 font-semibold transition hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => setIsModalOpen(true)}
              >
                <span>{t("more")}</span>
              </button>
            ) : null}
          </div>
        </>
      )}
      <Modal
        shown={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add-ons")}
      >
        <div className="overflow-y-auto max-h-[70vh]">
          <div
            className={clsx(
              "dark:bg-flathub-arsenic border dark:border-none",
              "flex flex-col min-w-0 gap-5 rounded-xl bg-flathub-white duration-500",
            )}
          >
            <div className="flex flex-col divide-y dark:divide-flathub-granite-gray">
              {addons.map((addon) => (
                <AddonRow key={addon.id} addon={addon} />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default Addons
