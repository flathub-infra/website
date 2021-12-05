import { GetStaticPaths, GetStaticProps } from 'next'

import { fetchDeveloperApps, fetchDevelopers } from '../../../../src/fetchers'
import ApplicationCollection from '../../../../src/components/application/Collection'
import { Appstream } from '../../../../src/types/Appstream'
import { NextSeo } from 'next-seo'

export default function Developer({
    developerApps,
    developer,
}: {
    developerApps: Appstream[]
    developer: string
}) {
    return (
        <>
            <NextSeo title={`Applications by ${developer}`} />
            <ApplicationCollection
                title={`Applications by ${developer}`}
                applications={developerApps}
            />
        </>
    )
}

export const getStaticProps: GetStaticProps = async ({
    params: { developer },
}) => {
    const developerApps = await fetchDeveloperApps(developer as string)
    return {
        props: {
            developerApps: developerApps ?? [],
            developer
        },
    }
}

export const getStaticPaths: GetStaticPaths = async () => {
    const apps = await fetchDevelopers()
    const paths = apps.map((developer) => ({
        params: { developer },
    }))

    return {
        paths,
        fallback: false,
    }
}
