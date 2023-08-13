import { FunctionComponent } from "react"
import { LoginProvider } from "../../types/Login"
import ProviderLink from "./ProviderLink"
import { motion } from "framer-motion"

interface Props {
  providers: LoginProvider[]
}

const LoginProviders: FunctionComponent<Props> = ({ providers }) => {
  const links = providers.map((p) => (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      key={p.method}
    >
      <ProviderLink provider={p} />
    </motion.div>
  ))

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full flex-col gap-5 p-5 sm:w-[400px]">{links}</div>
    </div>
  )
}

export default LoginProviders
