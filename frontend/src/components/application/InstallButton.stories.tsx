import React from "react"
import { Meta } from "@storybook/react"
import InstallButton from "./InstallButton"
export default {
  title: "Components/InstallButton",
  component: InstallButton,
} as Meta<typeof InstallButton>

export const Generated = () => {
  const appId = "tv.kodi.Kodi"

  return (
    <div className="flex">
      <div className="ms-auto">
        <InstallButton appId={appId} />
      </div>
    </div>
  )
}
