import { FunctionComponent } from "react"
import { LoginProvider } from "../../types/Login"
import ProviderLink from "./ProviderLink"

interface Props {
  providers: LoginProvider[]
}

const LoginProviders: FunctionComponent<Props> = ({ providers }) => {
  const links = providers.map((p) => (
    <div key={p.method}>
      <ProviderLink provider={p} />
    </div>
  ))

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full flex-col gap-5 p-5 sm:w-[400px]">{links}</div>
    </div>
  )
}

export default LoginProviders
