import { z } from "zod"

export const RequestSchema = z.object({
  requestType: z.enum(["appdata", "summary"]),
  requestData: z.object({
    keys: z.record(
      z.string(),
      z.union([
        z.string(),
        z.array(z.string()),
        z.boolean(),
        z.record(
          z.any(),
          z.union([
            z.array(z.string()),
            z.record(z.any(), z.array(z.string())),
          ]),
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
          z.union([
            z.array(z.string()),
            z.record(z.any(), z.array(z.string())),
          ]),
        ),
        z.null(),
      ]),
    ),
  }),
  isNewSubmission: z.boolean(),
})
