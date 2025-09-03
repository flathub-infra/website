import { ReactElement, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import NewTokenDialog from "./NewTokenDialog"
import Spinner from "src/components/Spinner"
import { getIntlLocale } from "src/localize"
import ConfirmDialog from "src/components/ConfirmDialog"
import { Repo } from "src/types/UploadTokens"
import {
  useGetUploadTokensUploadTokensAppIdGet,
  useRevokeUploadTokenUploadTokensTokenIdRevokePost,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { UTCDate } from "@date-fns/utc"
import { Appstream } from "src/types/Appstream"

export default function UploadTokenControls({
  app,
}: {
  app: Pick<Appstream, "id">
}) {
  const t = useTranslations()

  const locale = useLocale()

  const i18n = getIntlLocale(locale)

  const [modalVisible, setModalVisible] = useState(false)
  const [repo, setRepo] = useState<Repo>("beta")
  const [showExpired, setShowExpired] = useState(false)

  const query = useGetUploadTokensUploadTokensAppIdGet(
    app.id,
    {
      include_expired: showExpired,
    },
    {
      axios: { withCredentials: true },
      query: {
        enabled: !!app.id,
      },
    },
  )

  const [tokenToRevoke, setTokenToRevoke] = useState<number | undefined>(
    undefined,
  )

  const revokeMutation = useRevokeUploadTokenUploadTokensTokenIdRevokePost({
    axios: { withCredentials: true },
  })

  let content: ReactElement
  if (query.isPending) {
    content = <Spinner size="m" />
  } else if (query.status === "error") {
    content = <p>{t("error-occurred")}</p>
  } else {
    content = (
      <>
        <div className="grid w-full grid-cols-2 gap-4">
          <Button
            size="lg"
            onClick={() => {
              setRepo("beta")
              setModalVisible(true)
            }}
          >
            {t("new-beta-token")}
          </Button>
          {query.data.data.is_direct_upload_app && (
            <Button
              size="lg"
              onClick={() => {
                setRepo("stable")
                setModalVisible(true)
              }}
            >
              {t("new-stable-token")}
            </Button>
          )}
        </div>

        {query.data.data.tokens.length === 0 && (
          <p className="mt-6">{t("no-tokens-to-show")}</p>
        )}

        {query.data.data.tokens.length > 0 && (
          <div className="overflow-x-auto w-full">
            <table className="mt-6 w-full">
              <thead>
                <tr>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("id")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("name")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("repo")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("scopes")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("issued")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("issued-to")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("expires")}
                  </th>
                  <th className="text-start pe-5 whitespace-nowrap">
                    {t("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.tokens.map((token) => (
                  <tr key={token.id}>
                    <td className="pe-5">{token.id}</td>
                    <td className="pe-5">{token.comment}</td>
                    <td className="pe-5">{token.repos.join(", ")}</td>
                    <td className="pe-5">{token.scopes.join(", ")}</td>
                    <td
                      className="pe-5"
                      title={new UTCDate(token.issued_at * 1000).toLocaleString(
                        getIntlLocale(i18n.language),
                      )}
                    >
                      {new UTCDate(token.issued_at * 1000).toLocaleDateString(
                        getIntlLocale(i18n.language),
                      )}
                    </td>
                    <td className="pe-5">{token.issued_to}</td>
                    <td
                      className="pe-5"
                      title={new UTCDate(
                        token.expires_at * 1000,
                      ).toLocaleString(getIntlLocale(i18n.language))}
                    >
                      {new UTCDate(token.expires_at * 1000).toLocaleDateString(
                        getIntlLocale(i18n.language),
                      )}
                    </td>
                    <td>
                      {token.revoked ? (
                        t("revoked")
                      ) : (
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={() => {
                            setTokenToRevoke(token.id)
                          }}
                        >
                          {t("revoke")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showExpired && (
          <Button
            size="lg"
            className="mt-4"
            onClick={() => setShowExpired(true)}
          >
            {t("show-expired-tokens")}
          </Button>
        )}
      </>
    )
  }

  return (
    <>
      {content}

      <NewTokenDialog
        visible={modalVisible}
        cancel={() => setModalVisible(false)}
        created={() => query.refetch()}
        app_id={app.id}
        repo={repo}
      />

      <ConfirmDialog
        isVisible={tokenToRevoke !== undefined}
        action={t("revoke-token")}
        prompt={t("revoke-token")}
        actionVariant="destructive"
        onConfirmed={() =>
          revokeMutation.mutate(
            {
              tokenId: tokenToRevoke,
            },
            {
              onSuccess: () => {
                setTokenToRevoke(undefined)
                query.refetch()
              },
            },
          )
        }
        onCancelled={() => setTokenToRevoke(undefined)}
      >
        {query?.data &&
          t("revoke-token-description", {
            name: query.data?.data?.tokens.find(
              (token) => token.id === tokenToRevoke,
            )?.comment,
          })}
      </ConfirmDialog>
    </>
  )
}
