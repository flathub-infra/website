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
          origins_added: ["https://downloads.example"],
          origins_removed: ["https://example.com"],
          locations_by_origin: {
            "https://downloads.example": [
              'modules["libfoo"].sources[0].url',
              'modules["libfoo"].sources[0].mirror-urls[0]',
            ],
          },
          candidate_issues: [],
          arches: ["aarch64", "x86_64"],
        },
        {
          origins_added: [],
          origins_removed: [],
          locations_by_origin: {},
          candidate_issues: [
            {
              location: "modules[1].sources[0].url",
              reason: "missing-scheme",
            },
          ],
          arches: ["x86_64"],
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
