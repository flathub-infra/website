import { useMatomo } from '@datapunt/matomo-tracker-react'
import { useTheme } from 'next-themes'
import styles from './CmdInstructions.module.scss'
import CodeCopy from './CodeCopy'

const CmdInstructions = ({ appId }: { appId: string }) => {
  const { resolvedTheme } = useTheme()
  const { trackEvent } = useMatomo()

  const flatpakInstallCopied = () => {
    trackEvent({
      category: 'App',
      action: 'flatpakInstallCopied',
      name: appId ?? 'unknown',
    })
  }

  const flatpakRunCopied = () => {
    trackEvent({
      category: 'App',
      action: 'flatpakRunCopied',
      name: appId ?? 'unknown',
    })
  }

  return (
    <div className={styles.instructions}>
      <h3>Manual install</h3>
      <p>
        Make sure to follow the{' '}
        <a href='https://flatpak.org/setup/' target='_blank' rel='noreferrer'>
          setup guide
        </a>{' '}
        before installing
      </p>
      <CodeCopy text={`flatpak install flathub ${appId}`} nested={resolvedTheme === 'dark'} onCopy={flatpakInstallCopied} />
      <h3>Run</h3>
      <CodeCopy text={`flatpak run ${appId}`} nested={resolvedTheme === 'dark'} onCopy={flatpakRunCopied} />
    </div>
  )
}

export default CmdInstructions
