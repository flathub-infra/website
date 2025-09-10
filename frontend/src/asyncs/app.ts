import { fetchAppstream } from "src/fetchers"
import { Appstream } from "../types/Appstream"

/**
 * Fetches the appstream data for a set of apps (e.g. the user's).
 * @param appIds array of app identifiers to fetch data for
 */
export async function getAppsInfo(
  appIds: string[],
  locale: string,
): Promise<Appstream[]> {
  const responses = await Promise.allSettled(
    appIds.map(async (id) => ({
      id,
      response: await fetchAppstream(id, locale),
    })),
  )

  return responses.map((res) => {
    if (res.status === "fulfilled" && res.value.response) {
      return res.value.response
    } else if (res.status === "fulfilled") {
      return {
        id: res.value.id,
        name: res.value.id,
      } as Appstream
    } else {
      return {
        id: "error",
        name: "Error",
      } as Appstream
    }
  })
}
