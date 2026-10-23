import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AppHeader } from "./AppHeader"
import { Description } from "./Description"
import Releases from "./Releases"
import Tags from "./Tags"
import SubHeader from "./sub-header/SubHeader"
import { UserContext } from "src/context/user-info"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { fn } from "storybook/test"

const router = {
  back: fn(),
  forward: fn(),
  refresh: fn(),
  push: fn(),
  replace: fn(),
  prefetch: fn(),
}

const app = {
  id: "org.example.Studio",
  type: "desktop-application" as const,
  name: "Studio — Creative tools for everyone",
  developer_name: "The community of independent creative developers",
  summary: "A thoughtful workspace for your next great idea",
  description:
    "<p>Bring your sketches, notes, and projects together in one welcoming workspace. Studio helps you focus on the work you love, whether you are making your first illustration or collaborating on something bigger.</p><p>Designed for your desktop, with tools that stay out of your way.</p><ul><li>Organize projects with flexible collections</li><li>Work offline and keep your files under your control</li><li>Share your work in open formats</li></ul>",
  project_license: "GPL-3.0-only",
  is_free_license: true,
  urls: { donation: "https://example.org/donate" },
}

const summary = {
  timestamp: 1703980800,
  download_size: 48234496,
  installed_size: 146800640,
}

const meta = {
  title: "Components/Application/App detail polish",
  // Next 16.4 changed LayoutRouterContext; avoid Storybook's legacy layout mock.
  parameters: { layout: "fullscreen", nextjs: { appDirectory: false } },
  args: { stress: false },
  render: ({ stress }) => (
    <AppRouterContext value={router}>
      <UserContext value={{ loading: false, info: undefined }}>
        <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
          <AppHeader
            app={
              stress
                ? {
                    ...app,
                    icon: "/favicon.svg",
                    name: "StudioCreativeProjectManagementWithAnUnbrokenApplicationName",
                    developer_name:
                      "IndependentCreativeDeveloperCommunityWithALongUnbrokenName",
                  }
                : app
            }
            verificationStatus={{ verified: true, method: "manual" }}
            vendingSetup={stress ? { recommended_donation: 5 } : undefined}
            isQualityModalOpen={false}
          />
          <SubHeader
            app={app}
            summary={summary}
            stats={null}
            safetyRating={[]}
          />
          <div className="flex flex-col gap-8">
            <Description
              app={
                stress
                  ? { ...app, description: app.description.repeat(8) }
                  : app
              }
              isQualityModalOpen={false}
              isVerified
            />
            <Releases
              latestRelease={{
                version: "2024.1 — A fresh start for your creative projects",
                timestamp: "1703980800",
                description:
                  "<p>This release brings a more comfortable workspace and faster project loading.</p><ul><li>A redesigned project overview makes recent work easier to find.</li><li>Improved keyboard navigation throughout the editor.</li><li>Better support for long project names and translated labels.</li><li>More reliable export of large illustrations.</li></ul>",
                url: "https://example.org/releases",
              }}
              summary={summary}
            />
            <Tags
              keywords={[
                "creativity",
                "illustration",
                "open source",
                "CollaborativeCreativeProjectManagement",
                "linux",
                "flatpak",
              ]}
            />
          </div>
        </main>
      </UserContext>
    </AppRouterContext>
  ),
} satisfies Meta<{ stress: boolean }>

export default meta
type Story = StoryObj<typeof meta>
export const Overview: Story = {}
export const German: Story = { globals: { locale: "de" } }
export const LongContent: Story = { args: { stress: true } }
