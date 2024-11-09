import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { Permission, UserInfo, useUserUsersUserIdGet } from "src/codegen"
import Breadcrumbs from "src/components/Breadcrumbs"
import LoginGuard from "src/components/login/LoginGuard"
import Spinner from "src/components/Spinner"

export default function UserAdmin({ userId }) {
  const query = useUserUsersUserIdGet(userId, {
    axios: {
      withCredentials: true,
    },
  })

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={userId} />
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
                  name: query.data.data.display_name,
                  href: `/admin/moderation/${query.data.data.id}`,
                  current: true,
                },
              ]}
            />

            <div className="space-y-8">
              <h1 className="mt-4 text-4xl font-extrabold">
                User: {query.data.data.display_name} ({query.data.data.id})
              </h1>
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
