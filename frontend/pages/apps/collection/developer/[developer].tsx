import { GetStaticPaths, GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import ApplicationCollection from '../../../../src/components/application/Collection'
import Main from '../../../../src/components/layout/Main'
import { fetchDeveloperApps, fetchDevelopers } from '../../../../src/fetchers'
import { Appstream } from '../../../../src/types/Appstream'


export default function Developer({
    developerApps,
    developer,
}: {
    developerApps: Appstream[]
    developer: string
}) {
    return (
        <Main>
            <NextSeo title={`Applications by ${developer}`} />
            <ApplicationCollection
                title={`Applications by ${developer}`}
                applications={developerApps}
            />
        </Main>
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
        revalidate: 3600,
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
