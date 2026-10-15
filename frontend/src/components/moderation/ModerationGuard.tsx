"use client"

import { ReactNode } from "react"
import { Permission, GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import LoginGuard from "../login/LoginGuard"

export default function ModerationGuard({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard
        condition={(info: GetUserinfoAuthUserinfoGet200) =>
          info.permissions.some((a) => a === Permission.moderation)
        }
      >
        {children}
      </LoginGuard>
    </div>
  )
}
