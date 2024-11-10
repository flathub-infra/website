import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"
import {
  ConnectedAccountProvider,
  Permission,
  UserInfo,
  useUserUsersUserIdGet,
} from "src/codegen"
import Breadcrumbs from "src/components/Breadcrumbs"
import LoginGuard from "src/components/login/LoginGuard"
import { ProviderLogo } from "src/components/login/ProviderLogo"
import LogoImage from "src/components/LogoImage"
import Spinner from "src/components/Spinner"

const ProviderProfileLink = ({
  provider,
  login,
}: {
  provider: ConnectedAccountProvider
  login: string
}) => {
  return (
    <a
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center space-x-2"
    >
      <ProviderLogo provider={provider} />
      <span>{login}</span>
    </a>
  )
}

export default function UserAdmin({ userId }) {
  const query = useUserUsersUserIdGet(userId, {
    axios: {
      withCredentials: true,
    },
  })

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={query?.data?.data?.default_account.login ?? userId} />
      <LoginGuard
        condition={(info: UserInfo) =>
          info.permissions.some((a) => a === Permission.moderation)
        }
      >
        {query.isLoading && <Spinner size="m" />}
        {query.isSuccess && (
          <div className="space-y-8">
            <Breadcrumbs
              pages={[
                {
                  name: "Users",
                  href: "/admin/users",
                  current: false,
                },
                {
                  name: query.data.data.default_account.login,
                  href: `/admin/moderation/${query.data.data.id}`,
                  current: true,
                },
              ]}
            />

            <div className="space-y-8">
              <h1 className="mt-4 text-4xl font-extrabold">
                {query.data.data.default_account.login} ({query.data.data.id})
              </h1>

              {query.data.data.default_account && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-extrabold">Default Account</h2>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {" "}
                          <ProviderProfileLink
                            {...query.data.data.default_account}
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          Email: {query.data.data.default_account.email}
                        </div>
                        <div>
                          Display Name:{" "}
                          {query.data.data.default_account.display_name}
                        </div>
                        <div>
                          Last Used:{" "}
                          {format(
                            query.data.data.default_account.last_used,
                            "PP",
                          )}
                        </div>
                        <div></div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {query.data.data.owned_apps.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-extrabold">Owned Apps</h2>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {query.data.data.owned_apps.map((app) => (
                      <Link
                        key={app.app_id}
                        href={`/apps/${app.app_id}`}
                        className=""
                      >
                        <Card key={app.app_id}>
                          <CardHeader>
                            <CardTitle>{app.app_id}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div>{format(app.created, "PP")}</div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {query.data.data.roles.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-extrabold">Roles</h2>
                  <div className="space-y-2">
                    {query.data.data.roles.map((role) => (
                      <div key={role.id}>{role.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { user },
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      userId: user,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
