import { getAppstreamAppstreamAppIdGet } from "../codegen/app/app"
import type {
  GetAppstreamAppstreamAppIdGet200,
  GetAppstreamAppstreamAppIdGetParams,
} from "../codegen/model"

/**
 * Fetches the appstream data for a set of apps (e.g. the user's).
 * @param appIds array of app identifiers to fetch data for
 */
export async function getAppsInfo(
  appIds: string[],
  locale: string,
): Promise<GetAppstreamAppstreamAppIdGet200[]> {
  const params: GetAppstreamAppstreamAppIdGetParams = { locale }
  const responses = await Promise.allSettled(
    appIds.map(async (id) => {
      try {
        const response = await getAppstreamAppstreamAppIdGet(id, params)
        return response.data
      } catch {
        return {
          id: id,
          name: id,
        } as GetAppstreamAppstreamAppIdGet200
      }
    }),
  )

  return responses
    .filter(
      (res): res is PromiseFulfilledResult<GetAppstreamAppstreamAppIdGet200> =>
        res.status === "fulfilled",
    )
    .map((res) => res.value)
}
