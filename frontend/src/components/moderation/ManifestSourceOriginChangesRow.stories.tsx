import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Meta } from "@storybook/nextjs-vite"
import { faker } from "@faker-js/faker"
import { expect, within } from "storybook/test"
import {
  ManifestComplexityRequestData,
  ModerationRequestResponse,
} from "../../codegen/model"
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
            "https://github.com/foo/bar",
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
            "https://github.com/foo/bar": ['modules["gtkhex"].sources[0].url'],
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

const complexity: ManifestComplexityRequestData = {
  algorithm_version: 3,
  analysis_fingerprint:
    "sha256:6ec3f8e3df4e5c77cf90e5ec66081eb8918e52c27ec1d1de7cc3b4ca28998a7e",
  score_units: 15,
  raw_score_units: 15,
  display_score: 7.5,
  threshold_units: 14,
  score_band: "large",
  score_breakdown: {
    structural_units: 5,
    recipe_units: 6,
    breadth_units: 4,
    ambiguity_units: 0,
  },
  affected_arches: ["aarch64", "x86_64"],
  touched_modules: ["modules/main", "modules/main/modules/libfoo"],
  touched_modules_truncated: false,
  total_touched_module_count: 2,
  events: [
    {
      kind: "module_added",
      location: "modules/main/modules/libfoo",
      arches: ["aarch64", "x86_64"],
      new_summary: {
        has_commands: false,
        has_patch_or_script: false,
        source_count: "1-2",
      },
      magnitude: 0,
    },
    {
      kind: "buildsystem_changed",
      location: "modules/main",
      arches: ["aarch64", "x86_64"],
      old_summary: "simple",
      new_summary: "meson",
    },
  ],
  events_truncated: false,
  total_event_count: 2,
}

const requestWith = (
  requestData: ModerationRequestResponse["request_data"],
  buildLogUrl?: string,
): ModerationRequestResponse => ({
  request_type: "manifest",
  request_data: requestData,
  id: faker.number.int(),
  app_id: "tv.abc.TestApp",
  created_at: faker.date.past().toISOString(),
  build_id: faker.number.int(),
  job_id: faker.number.int(),
  build_log_url: buildLogUrl,
  is_outdated: false,
  is_new_submission: false,
  handled_by: null,
  handled_at: null,
  is_approved: null,
  comment: null,
})

export const ComplexityOnly = () => (
  <ManifestSourceOriginChangesRow
    request={requestWith({ findings: [], complexity })}
  />
)

export const Combined = () => (
  <ManifestSourceOriginChangesRow
    request={requestWith({
      findings: [
        {
          origins_added: ["https://github.com"],
          origins_removed: ["https://gitlab.gnome.org"],
          locations_by_origin: {
            "https://github.com": ['modules["main"].sources[0].url'],
          },
          arches: ["aarch64", "x86_64"],
        },
      ],
      complexity,
    })}
  />
)

export const AmbiguousAndTruncated = () => (
  <ManifestSourceOriginChangesRow
    request={requestWith({
      findings: [],
      complexity: {
        ...complexity,
        score_units: 40,
        raw_score_units: 46,
        display_score: 20,
        score_band: "major",
        score_breakdown: {
          structural_units: 14,
          recipe_units: 14,
          breadth_units: 6,
          ambiguity_units: 12,
        },
        events: [
          {
            kind: "module_match_ambiguous",
            location: "modules",
            arches: ["aarch64", "x86_64"],
            old_summary: { count: 12 },
            new_summary: { count: 13 },
          },
        ],
        events_truncated: true,
        total_event_count: 31,
        touched_modules_truncated: true,
        total_touched_module_count: 65,
      },
    })}
  />
)

export const BuildLogPresent = () => (
  <ManifestSourceOriginChangesRow
    request={requestWith(
      { findings: [], complexity },
      "https://buildbot.flathub.org/build/1234",
    )}
  />
)

export const BuildLogAbsent = () => (
  <ManifestSourceOriginChangesRow
    request={requestWith({ findings: [], complexity })}
  />
)
export const SourceSetChanged = {
  render: () => (
    <ManifestSourceOriginChangesRow
      request={requestWith({
        findings: [],
        complexity: {
          ...complexity,
          algorithm_version: 3,
          score_units: 3,
          raw_score_units: 3,
          display_score: 1.5,
          score_band: "small",
          score_breakdown: {
            structural_units: 0,
            recipe_units: 3,
            breadth_units: 0,
            ambiguity_units: 0,
          },
          touched_modules: ["modules/main"],
          total_touched_module_count: 1,
          events: [
            {
              kind: "source_set_changed" as ManifestComplexityRequestData["events"][number]["kind"],
              location: "modules/main/sources",
              arches: ["aarch64", "x86_64"],
              new_summary: {
                added: 8,
                removed: 3,
                changed: 11,
                sentinel_source_url: "https://sentinel.example/source",
              },
              magnitude: 3,
            },
          ],
          total_event_count: 1,
        },
      })}
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText("Source set changed")).toBeInTheDocument()
    expect(
      canvas.getByText("8 added, 3 removed, 11 changed"),
    ).toBeInTheDocument()
    expect(
      canvas.queryByText("https://sentinel.example/source"),
    ).not.toBeInTheDocument()
  },
}
