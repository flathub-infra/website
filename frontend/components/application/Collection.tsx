import Head from 'next/head'
import Main from './../layout/Main'
import { useEffect, useState } from 'react'
import ApplicationCard from './../application/Card'
import Sidebar from './../layout/Sidebar'
import { FunctionComponent } from 'react'
import Application from '../../types/Application'

interface Props {
    apiURI: string,
    title: string,
};


const ApplicationCollection: FunctionComponent<Props> = ({ apiURI, title }) => {
    const [apps, setApps] = useState([])

    useEffect(() => {
        fetch(apiURI)
            .then((r) => {
                r.json().then((data) => {
                    setApps(data as Array<Application>)
                })
            })
            .catch((e) => {
                console.log(e)
            })
    }, [apiURI])

    return (
        <Main>
            <Head>
                <title>{title}</title>
            </Head>

            <div className="apps-collection">
                <Sidebar />

                <div className="collection">

                    <h2>{title}</h2>
                    <p>{apps.length} results</p>

                    <div className="apps">
                        {apps.map((app) => <ApplicationCard key={app.flatpakAppId} application={app} />)}
                    </div>
                </div>
            </div>

        </Main>
    )
}

export default ApplicationCollection