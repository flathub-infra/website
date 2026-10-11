"use client"

import { useTranslations } from "next-intl"
import { useUserContext } from "../../../../src/context/user-info"
import LoginGuard from "../../../../src/components/login/LoginGuard"
import DeleteButton from "../../../../src/components/user/DeleteButton"
import Passkeys from "../../../../src/components/user/Passkeys"
import UserDetails from "../../../../src/components/user/UserDetails"
import type { JSX } from "react"
import { LoginMethod } from "src/codegen"
import { Separator } from "@/components/ui/separator"

interface SettingsClientProps {
  providers: LoginMethod[]
}

const SettingsClient = ({ providers }: SettingsClientProps): JSX.Element => {
  const t = useTranslations()
  const user = useUserContext()

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <LoginGuard>
        <div className="flex flex-col gap-7">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("settings")}
            </h1>
          </header>
          <div className="flex flex-col gap-7">
            <UserDetails logins={providers} />
            <Separator className="opacity-40" />
            <Passkeys key={user.info?.invite_code ?? "signed-out"} />
            <Separator className="opacity-40" />
            <div>
              <DeleteButton />
            </div>
          </div>
        </div>
      </LoginGuard>
    </div>
  )
}

export default SettingsClient
