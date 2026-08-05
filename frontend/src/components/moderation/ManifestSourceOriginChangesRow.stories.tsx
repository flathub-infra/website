import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Meta } from "@storybook/nextjs-vite"
import { faker } from "@faker-js/faker"
import { ModerationRequestResponse } from "../../codegen/model"
import ManifestSourceOriginChangesRow from "./ManifestSourceOriginChangesRow"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/ManifestSourceOriginChangesRow",
  component: ManifestSourceOriginChangesRow,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} as Meta<typeof ManifestSourceOriginChangesRow>

export const Primary = () => {
  const request: ModerationRequestResponse = {
    request_type: "manifest",
    request_data: {
      findings: [
        {
          origins_added: [
            "https://download.gnome.org",
            "https://github.com",
            "https://mirror.example.org:8443",
          ],
          origins_removed: [
            "https://old-download.gnome.org",
            "https://gitlab.gnome.org",
          ],
          locations_by_origin: {
            "https://download.gnome.org": [
              'modules["ghex"].sources[0].url',
              'modules["ghex"].sources[0].mirror-urls[0]',
              'modules["gtkhex"].sources[1].url',
            ],
            "https://github.com": ['modules["gtkhex"].sources[0].url'],
            "https://mirror.example.org:8443": [
              'modules["docs"].sources[1].mirror-urls[0]',
            ],
            "https://old-download.gnome.org": [
              'modules["ghex"].sources[0].url',
            ],
            "https://gitlab.gnome.org": ['modules["gtkhex"].sources[0].url'],
          },
          arches: ["aarch64", "x86_64"],
        },
      ],
    },
    id: 1,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),
    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,
    is_new_submission: false,
    handled_by: null,
    handled_at: null,
    is_approved: null,
    comment: null,
  }

  return <ManifestSourceOriginChangesRow request={request} />
}
