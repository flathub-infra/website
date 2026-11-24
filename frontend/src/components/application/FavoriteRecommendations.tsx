import { useLocale, useTranslations } from "next-intl"
import { useGetFavoriteRecommendationsFavoritesAppIdRecommendationsGet } from "src/codegen/favorite-recommendations/favorite-recommendations"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ApplicationCollection from "./Collection"

export default function FavoriteRecommendations({ appId }: { appId: string }) {
  const locale = useLocale()
  const t = useTranslations()
  const { data, error, refetch, isFetching } =
    useGetFavoriteRecommendationsFavoritesAppIdRecommendationsGet(
      appId,
      { locale },
      { axios: { withCredentials: true }, query: { retry: false } },
    )
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return null
  }
  if (!data?.data.length && !error) {
    return null
  }

  return (
    <Card className="rounded-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic dark:shadow-none">
      {error ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p>Could not load app recommendations.</p>
          <Button
            variant="secondary"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {t("try-again")}
          </Button>
        </div>
      ) : (
        <ApplicationCollection
          title="People who favorited this app also like"
          applications={data.data}
          variant="flat"
        />
      )}
    </Card>
  )
}
