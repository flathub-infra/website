import { FunctionComponent } from 'react'
import Image from 'next/image'

interface Props {
    iconUrl: string
    appName: string
}

const LogoImage: FunctionComponent<Props> = ({ iconUrl, appName }) => {

    return (
        <>
            {
                iconUrl ? (
                    iconUrl.startsWith('https://dl.flathub.org') || iconUrl.startsWith('https://flathub.org') ? (
                        <Image src={iconUrl} alt={`${appName} logo`} width={128} height={128} />
                    ) : (
                        <img src={iconUrl} alt={`${appName} logo`}
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
                        alt={`${appName} logo`}
                        width={128}
                        height={128}
                    />
                )
            }
        </>
    )
}
export default LogoImage
