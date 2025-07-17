import { Heading, Section, Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

export interface BuildNotificationEmailProps {
  appId: string
  appName: string | null
  category: "build_notification"
  subject: string
  previewText: string
  diagnostics: Diagnostic[]
  anyWarnings: boolean
  anyErrors: boolean
  buildId: number
  buildRepo: string
}

interface Diagnostic {
  category:
    | "failed_to_load_appstream"
    | "appstream_validation"
    | "missing_icon"
    | "no_local_icon"
    | "missing_build_log_url"
    | "screenshot_not_mirrored"
    | "mirrored_screenshot_not_found"
    | "no_screenshot_branch"
    | "unexpected_files_in_screenshot_branch"
    | "wrong_arch_executables"
  refstring: string
  isError?: boolean
  isWarning?: boolean
  data?: {
    error: string
    stdout: string
    stderr: string
    path: string
    appstreamPath: string
    urls: string[]
    expectedBranch: string
    files?: string[]
    expectedArch: string
    executables?: {
      path: string
      detectedArch: string
      detectedArchCode: string
    }[]
  }
}

const Diagnostic = ({
  appId,
  diagnostic,
}: {
  appId: string
  diagnostic: Diagnostic
}) => {
  return (
    <Section>
      <Heading as={"h3"}>{diagnostic.category}</Heading>
      {diagnostic.refstring && <Text>{diagnostic.refstring}</Text>}
      <Section>
        {diagnostic.category === "failed_to_load_appstream" && (
          <Section>
            <Text>
              The appstream file at {diagnostic.data?.path} could not be loaded.
              Make sure it exists, is not corrupted, and the app ID is correct.
            </Text>
            <Text>Error: {diagnostic.data?.error}</Text>
          </Section>
        )}
        {diagnostic.category === "appstream_validation" && (
          <Section>
            <Text>
              The appstream file at <code>{diagnostic.data?.path}</code>{" "}
              contains errors.
            </Text>
            {diagnostic.data?.stdout && (
              <Section>
                <Heading as={"h4"}>stdout</Heading>
                <Text>{diagnostic.data?.stdout}</Text>
              </Section>
            )}
            {diagnostic.data?.stderr && (
              <Section>
                <Heading as={"h4"}>stderr</Heading>
                <Text>{diagnostic.data?.stderr}</Text>
              </Section>
            )}
            <Text>Error: {diagnostic.data?.error}</Text>
          </Section>
        )}
        {diagnostic.category === "missing_icon" && (
          <Text>
            The appstream file at <code>{diagnostic.data?.appstreamPath}</code>{" "}
            does not contain an icon.
          </Text>
        )}
        {diagnostic.category === "no_local_icon" && (
          <Text>
            The appstream file at <code>{diagnostic.data?.appstreamPath}</code>{" "}
            only contains a remote icon for the app, not a local one.
          </Text>
        )}
        {diagnostic.category === "missing_build_log_url" && (
          <Text>
            For FOSS apps, Flathub requires that direct uploads provide a link
            to public build logs for each build. The build log may be specified
            using <code>flat-manager-client</code>'s{" "}
            <code>--build-log-url</code> option at either the{" "}
            <code>create</code>
            or <code>push</code> step.
          </Text>
        )}
        {diagnostic.category === "screenshot_not_mirrored" && (
          <Section>
            <Text>
              The following screenshots in the appstream catalog file (at{" "}
              <code>{diagnostic.data?.path}</code>) are not mirrored to the
              screenshots branch:
            </Text>
            <ul>
              {diagnostic.data?.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </Section>
        )}
        {diagnostic.category === "mirrored_screenshot_not_found" && (
          <Section>
            <Text>
              The screenshots in the appstream catalog file (at{" "}
              <code>{diagnostic.data?.path}</code>) have been edited to point to
              the Flathub mirror, but the following screenshots are not present
              in the <code>{diagnostic.data?.expectedBranch}</code>
              branch:
            </Text>
            <ul>
              {diagnostic.data?.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </Section>
        )}
        {diagnostic.category === "no_screenshot_branch" && (
          <Section>
            <Text>
              The screenshots in the appstream file have not been mirrored to
              the <code>{diagnostic.data?.expectedBranch}</code>
              OSTree branch, which is required for Flathub to display them
              correctly.
            </Text>
            <Text>
              To prepare screenshots for mirroring, pass the{" "}
              <code>--mirror-screenshots-url=https://dl.flathub.org/media</code>
              option to <code>flatpak-builder</code>. This option downloads
              screenshots from their source and saves them to the build
              directory. Then, commit the screenshots to the{" "}
              <code>screenshots/&lt;architecture&gt;</code>
              branch for each architecture.
            </Text>
          </Section>
        )}
        {diagnostic.category === "unexpected_files_in_screenshot_branch" && (
          <Section>
            <Text>The following files do not match the expected app ID:</Text>
            <ul>
              {diagnostic.data?.files?.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
            <Text>
              Screenshot files should be in a directory named after the app ID
              and branch, e.g. <code>{appId}-master</code>.
            </Text>
          </Section>
        )}
        {diagnostic.category === "wrong_arch_executables" && (
          <Section>
            <Text>
              The following executable or shared library files are built for a
              different architecture than the
              {diagnostic.data?.expectedArch} ref:
            </Text>
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="text-left rtl:text-right">
                  <th>Path</th>
                  <th>Detected Architecture</th>
                </tr>
              </thead>
              <tbody>
                {diagnostic.data?.executables?.map((file, i) => (
                  <tr key={i}>
                    <td className="align-top">
                      <code>{file.path}</code>
                    </td>
                    <td className="align-top">
                      {file.detectedArch} ({file.detectedArchCode})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Text>
              This is probably a mistake. If you are including pre-built
              binaries in your build, make sure to use the correct binaries for
              each architecture.
            </Text>
          </Section>
        )}
      </Section>
    </Section>
  )
}

export const BuildNotificationEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  diagnostics,
  anyWarnings,
  anyErrors,
  buildId,
  buildRepo,
}: BuildNotificationEmailProps) => {
  const appNameAndId = buildAppName(appId, appName)

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        {anyErrors ? (
          <>
            Errors were detected during validation of build #{buildId} (
            {buildRepo}) for <b>{appNameAndId}</b>. This build may not be
            published. Please address the issues and upload a new build.
          </>
        ) : (
          <>
            Warnings were detected during validation of build #{buildId} for{" "}
            <b>{appNameAndId}</b>.
          </>
        )}
      </Text>
      {anyErrors && (
        <Section>
          <Heading as={"h2"}>Errors</Heading>
          {diagnostics
            .filter((diagnostic) => diagnostic.isError)
            .map((diagnostic, i) => (
              <Diagnostic key={i} appId={appId} diagnostic={diagnostic} />
            ))}
        </Section>
      )}
      {anyWarnings && (
        <Section>
          <Heading as={"h2"}>Warnings</Heading>
          {diagnostics
            .filter((diagnostic) => diagnostic.isWarning)
            .map((diagnostic, i) => (
              <Diagnostic key={i} appId={appId} diagnostic={diagnostic} />
            ))}
        </Section>
      )}
    </Base>
  )
}

BuildNotificationEmail.PreviewProps = {
  appId: "org.flatpak.Hello",
  appName: "Hello",
  subject: "Build notification",
  category: "build_notification",
  previewText: "Notification for a build",
  diagnostics: [
    {
      refstring: "app/org.flatpak.Hello/x86_64/master",
      isWarning: true,
      category: "no_local_icon",
      data: {
        appstreamPath: "files/share/appdata/org.flatpak.Hello.appdata.xml",
      },
    },
    {
      refstring: "app/org.flatpak.Hello/x86_64/master",
      isWarning: false,
      category: "no_screenshot_branch",
      data: {
        expectedBranch: "screenshots/x86_64",
      },
    },
    {
      refstring: "app/org.flatpak.Hello/x86_64/master",
      isWarning: false,
      category: "missing_build_log_url",
    },
    {
      refstring: "app/org.gnome.Crosswords/aarch64/master",
      isWarning: true,
      category: "wrong_arch_executables",
      data: {
        expectedArch: "aarch64",
        executables: [
          {
            path: "/files/bin/crossword-editor",
            detectedArch: "x86_64",
            detectedArchCode: 62,
          },
          {
            path: "/files/bin/crosswords",
            detectedArch: "x86_64",
            detectedArchCode: 62,
          },
        ],
      },
    },
    {
      refstring: "screenshots/x86_64",
      isWarning: false,
      category: "unexpected_files_in_screenshot_branch",
      data: {
        files: ["screenshot.png"],
      },
    },
  ],
  anyWarnings: true,
  anyErrors: false,
  buildId: 1,
  buildRepo: "stable",
} as BuildNotificationEmailProps

export default BuildNotificationEmail
