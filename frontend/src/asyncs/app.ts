import axios, { AxiosResponse } from "axios"
import { APP_DETAILS } from "../env"
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
      response: await axios
        .get<Appstream>(`${APP_DETAILS(id, locale)}`)
        .catch(() => {
          return {
            data: {
              id: id,
              name: id,
            } as Appstream,
          } as AxiosResponse<Appstream>
        }),
    })),
  )

  return responses.map((res) => {
    if (res.status === "fulfilled") {
      return res.value.response.data
    } else {
      return {
        id: "error",
        name: "Error",
      } as Appstream
    }
  })
}
