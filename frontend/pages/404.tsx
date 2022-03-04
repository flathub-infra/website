import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Main from "../src/components/layout/Main"

export default function Custom404() {
    const { t } = useTranslation()
    return (
        <Main>
            <NextSeo title={t('client-error')} />
            <div className='main-container'>
                <h1>{t('whoops')}</h1>
                <p>
                    {t('an-error-occurred-client')}
                </p>
                <p>
                    <Trans i18nKey={"common:retry-or-go-home"}>
                        You might want to retry or go back <a href='.'>home</a>.
                    </Trans>
                </p>
            </div>
        </Main>
    )
}


export const getStaticProps: GetStaticProps = async ({ locale }) => {
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common'])),
        },
    }
}
