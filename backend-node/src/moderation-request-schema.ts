import { z } from "zod"

const AppdataRequestDataSchema = z.object({
  keys: z.record(
    z.string(),
    z.union([
      z.string(),
      z.array(z.string()),
      z.boolean(),
      z.record(
        z.any(),
        z.union([z.array(z.string()), z.record(z.any(), z.array(z.string()))]),
      ),
      z.null(),
    ]),
  ),
  current_values: z.record(
    z.string(),
    z.union([
      z.string(),
      z.array(z.string()),
      z.boolean(),
      z.record(
        z.any(),
        z.union([z.array(z.string()), z.record(z.any(), z.array(z.string()))]),
      ),
      z.null(),
    ]),
  ),
})

export const RequestSchema = z.discriminatedUnion("requestType", [
  z.object({
    requestType: z.enum(["appdata", "summary"]),
    requestData: AppdataRequestDataSchema,
    isNewSubmission: z.boolean(),
  }),
  z.object({
    requestType: z.literal("manifest"),
    requestData: z.object({
      findings: z.array(
        z.object({
          origins_added: z.array(z.string()),
          origins_removed: z.array(z.string()),
          locations_by_origin: z.record(z.string(), z.array(z.string())),
          arches: z.array(z.string()),
        }),
      ),
      complexity: z.unknown().optional(),
    }),
    isNewSubmission: z.literal(false),
  }),
])
