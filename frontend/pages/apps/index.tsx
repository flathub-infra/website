import Head from 'next/head'
import Main from './../../components/layout/Main'
import ApplicationSection from './../../components/application/Section'
import { useEffect, useState } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import { BASE_URI } from './../../env'

export default function Apps() {
    const [updatedApps, setUpdatedApps] = useState([])

    useEffect(() => {
        fetch(`${BASE_URI}/apps/collection/recently-updated/6`)
            .then((r) => {
                r.json().then((data) => {
                    setUpdatedApps(data)
                })
            })
            .catch((e) => {
                console.log(e)
            })
    }, [])


    return (
        <Main>
            <Head>
                <title>Flathub—An app store and build service for Linux</title>
            </Head>
            <div className="apps-collection">
                <Sidebar />

                <div className="collection">

                    <ApplicationSection key="updated" title="New & Updated Apps" applications={updatedApps} href="apps/collection/recently-updated" />

                </div>

            </div>


        </Main>

    )
}
