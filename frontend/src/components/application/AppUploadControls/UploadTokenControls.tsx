import { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "next-i18next"
import Button from "src/components/Button"
import NewTokenDialog from "./NewTokenDialog"
import Spinner from "src/components/Spinner"
import { getIntlLocale } from "src/localize"
import { i18n } from "next-i18next"
import ConfirmDialog from "src/components/ConfirmDialog"
import { useQuery } from "@tanstack/react-query"
import { uploadTokensApi } from "src/api"
import { Repo } from "src/types/UploadTokens"

export default function UploadTokenControls({ app }: { app: { id: string } }) {
  const { t } = useTranslation()

  const [modalVisible, setModalVisible] = useState(false)
  const [repo, setRepo] = useState<Repo>("beta")
  const [showExpired, setShowExpired] = useState(false)

  const query = useQuery({
    queryKey: ["upload-tokens", app.id, showExpired],
    queryFn: () =>
      uploadTokensApi.getUploadTokensUploadTokensAppIdGet(app.id, showExpired, {
        withCredentials: true,
      }),
    enabled: !!app.id,
  })

  const [tokenToRevoke, setTokenToRevoke] = useState<number | undefined>(
    undefined,
  )

  const revoke = useCallback(() => {
    uploadTokensApi
      .revokeUploadTokenUploadTokensTokenIdRevokePost(tokenToRevoke, {
        withCredentials: true,
      })
      .then(() => {
        setTokenToRevoke(undefined)
        query.refetch()
      })
  }, [tokenToRevoke, query])

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
            onClick={() => {
              setRepo("beta")
              setModalVisible(true)
            }}
          >
            {t("new-beta-token")}
          </Button>
          {query.data.data.is_direct_upload_app && (
            <Button
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
                      title={new Date(token.issued_at * 1000).toLocaleString(
                        getIntlLocale(i18n.language),
                      )}
                    >
                      {new Date(token.issued_at * 1000).toLocaleDateString(
                        getIntlLocale(i18n.language),
                      )}
                    </td>
                    <td className="pe-5">{token.issued_to}</td>
                    <td
                      className="pe-5"
                      title={new Date(token.expires_at * 1000).toLocaleString(
                        getIntlLocale(i18n.language),
                      )}
                    >
                      {new Date(token.expires_at * 1000).toLocaleDateString(
                        getIntlLocale(i18n.language),
                      )}
                    </td>
                    <td>
                      {token.revoked ? (
                        t("revoked")
                      ) : (
                        <Button
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
          <Button className="mt-4" onClick={() => setShowExpired(true)}>
            {t("show-expired-tokens")}
          </Button>
        )}
      </>
    )
  }

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">{t("upload-tokens")}</h2>
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
        onConfirmed={() => revoke()}
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
