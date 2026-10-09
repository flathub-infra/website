"use client"

import { useTranslations } from "next-intl"
import { useUserContext } from "../../../../src/context/user-info"
import LoginGuard from "../../../../src/components/login/LoginGuard"
import DeleteButton from "../../../../src/components/user/DeleteButton"
import Passkeys from "../../../../src/components/user/Passkeys"
import UserDetails from "../../../../src/components/user/UserDetails"
import type { JSX } from "react"
import { LoginMethod } from "src/codegen"

interface SettingsClientProps {
  providers: LoginMethod[]
}

const SettingsClient = ({ providers }: SettingsClientProps): JSX.Element => {
  const t = useTranslations()
  const user = useUserContext()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard>
        <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
          <div className="space-y-3">
            <UserDetails logins={providers} />
            <Passkeys key={user.info?.invite_code ?? "signed-out"} />
            <div className="pt-12">
              <DeleteButton />
            </div>
          </div>
        </div>
      </LoginGuard>
    </div>
  )
}

export default SettingsClient
