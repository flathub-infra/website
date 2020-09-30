import Head from "next/head"
import Link from "next/link"

import Main from "./../src/components/layout/Main"
import ApplicationSection from "./../src/components/application/Section"

import { BASE_URI } from "../src/env"
import { GetStaticProps } from 'next'
import Application from '../src/types/Application'

export default function Home({recentlyUpdated}) {
  return (
    <Main>
      <Head>
        <title>Flathub—An app store and build service for Linux</title>
        <meta
          name="description"
          content="Find and install hundreds of apps and games for Linux. Enjoy GIMP, GNU Octave, Spotify, Steam and many more!"
        />
        <base href="/" />

        <link rel="icon" type="image/png" href="./favicon.png" />
      </Head>
      <div className="container">
        <header id="main-header">
          <h2>Apps for Linux, right here</h2>
          <p>
            {" "}
            Welcome to Flathub, the home of hundreds of apps which can be easily
            installed on any Linux distribution. <br />
            Browse the apps online, from your app center or the command line.{" "}
          </p>
          <a href="https://flatpak.org/setup/">
            <button className="primary-button">Quick Setup</button>
          </a>{" "}
          <Link href="/apps">
            <button className="primary-button">Browse the apps</button>
          </Link>
        </header>

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
