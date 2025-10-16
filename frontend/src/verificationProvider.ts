import { Auths, GetUserinfoAuthUserinfoGet200 } from "./codegen"

export type VerificationProvider = "github" | "gitlab" | "gnome" | "kde"

export function getUserName(
  info: GetUserinfoAuthUserinfoGet200,
): string | undefined {
  if (!info) {
    return undefined
  }

  return info.displayname ?? getFirstAuth(info.auths).login
}

function getFirstAuth(auths: Auths) {
  if (auths.github) {
    return auths.github
  }
  if (auths.gitlab) {
    return auths.gitlab
  }
  if (auths.gnome) {
    return auths.gnome
  }
  if (auths.kde) {
    return auths.kde
  }
  return undefined
}

export function verificationProviderToHumanReadable(
  verificationProvider: VerificationProvider,
) {
  switch (verificationProvider) {
    case "github":
      return "GitHub"
    case "gitlab":
      return "GitLab"
    case "gnome":
      return "GNOME GitLab"
    case "kde":
      return "KDE GitLab"
  }
}
