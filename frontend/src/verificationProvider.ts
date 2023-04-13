export type VerificationProvider = "github" | "gitlab" | "gnome" | "kde"
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
