import Head from "next/head"

import Main from "./../../src/components/layout/Main"
import ApplicationSection from "./../../src/components/application/Section"
import Sidebar from "../../src/components/layout/Sidebar"
import { BASE_URI } from "../../src/env"
import { GetStaticProps } from 'next'
import Application from '../../src/types/Application'

export default function Apps({ recentlyUpdated }) {

  return (
    <Main>
      <Head>
        <title>Flathub—An app store and build service for Linux</title>
      </Head>
      <div className="applications-collection">
        <Sidebar />

        <div className="collection">
          <ApplicationSection
            key="updated"
            title="New & Updated Apps"
            applications={recentlyUpdated}
            href="/apps/collection/recently-updated"
          />

          <ApplicationSection
            key="popular"
            title="Popular Apps"
            applications={recentlyUpdated}
            href="/apps/collection/popular"
          />

          <ApplicationSection
            key="editor_choice"
            title="Editor's Choice Apps"
            applications={recentlyUpdated}
            href="/apps/collection/editors-choice-apps"
          />

          <ApplicationSection
            key="editor_choice_games"
            title="Editor's Choice Games"
            applications={recentlyUpdated}
            href="/apps/collection/editors-choice-games"
          />
        </div>
      </div>
    </Main>
  )
}


export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch(`${BASE_URI}/apps/collection/recently-updated/5`)
  const recentlyUpdated: Application[] = await res.json()
  return {
    props: {
      recentlyUpdated
    }
  }
}
