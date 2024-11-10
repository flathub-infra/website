import { ConnectedAccountProvider } from "src/codegen"
import { GithubLogo } from "./GithubLogo"
import { GitlabLogo } from "./GitlabLogo"
import { GnomeLogo } from "./GnomeLogo"
import { KdeLogo } from "./KdeLogo"
import { GoogleLogo } from "./GoogleLogo"
import React from "react"

export const ProviderLogo = ({
  provider,
}: {
  provider: ConnectedAccountProvider
}) => {
  let logo = null
  if (provider === ConnectedAccountProvider.github) {
    logo = GithubLogo
  } else if (provider === ConnectedAccountProvider.gitlab) {
    logo = GitlabLogo
  } else if (provider === ConnectedAccountProvider.gnome) {
    logo = GnomeLogo
  } else if (provider === ConnectedAccountProvider.kde) {
    logo = KdeLogo
  } else if (provider === ConnectedAccountProvider.google) {
    logo = GoogleLogo
  }

  return (
    <div className="w-6 h-6" title={provider}>
      {React.createElement(logo)}
    </div>
  )
}
