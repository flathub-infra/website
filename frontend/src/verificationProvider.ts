export type VerificationProvider = "github" | "gitlab" | "gnome"
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
  }
}
