import { FunctionComponent } from 'react'
import { LoginProvider } from '../../types/Login'
import ProviderLink from './ProviderLink'
import styles from './Providers.module.scss'

interface Props {
  providers: LoginProvider[],
}

const LoginProviders: FunctionComponent<Props> = ({
  providers,
}) => {
  const links = providers.map(p => <ProviderLink provider={p} key={p.method} />)

  return (
    <div className={styles.providers}>
      {links}
    </div>
  )
}

export default LoginProviders
