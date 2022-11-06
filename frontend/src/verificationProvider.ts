export type VerificationProvider = "GitHub" | "GitLab" | "GnomeGitLab"

export function verificationProviderToHumanReadable(
  verificationProvider: VerificationProvider,
) {
  switch (verificationProvider) {
    case "GitHub":
      return "GitHub"
    case "GitLab":
      return "GitLab"
    case "GnomeGitLab":
      return "GNOME GitLab"
  }
}
