import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import Image from '../components/Image'

interface Props {
    iconUrl: string
    appName: string
}

const LogoImage: FunctionComponent<Props> = ({ iconUrl, appName }) => {
    const { t } = useTranslation()

    return (
        <>
            {
                iconUrl ? (
                    iconUrl.startsWith('https://dl.flathub.org') || iconUrl.startsWith('https://flathub.org') ? (
                        <Image src={iconUrl} alt={t('app-logo', { "app-name": appName })} width={128} height={128} />
                    ) : (
                        <img src={iconUrl} alt={t('app-logo', { "app-name": appName })}
                            style={{
                                display: "block",
                                margin: "2rem auto",
                                alignSelf: "center",
                                width: "128px",
                                height: "128px"
                            }} />
                    )

                ) : (
                    <Image
                        src='/img/flathub-logo.png'
                        alt={t('app-logo', { "app-name": appName })}
                        width={128}
                        height={128}
                    />
                )
            }
        </>
    )
}
export default LogoImage
