import Head from "next/head"
import { useEffect, useState } from "react"
import Link from "next/link"

import Main from "./../src/components/layout/Main"
import ApplicationSection from "./../src/components/application/Section"

import { BASE_URI } from "../src/env"

export default function Home() {
  const [updatedApps, setUpdatedApps] = useState([])

  useEffect(() => {
    fetch(`${BASE_URI}/apps/collection/recently-updated/5`)
      .then((r) => {
        r.json().then((data) => {
          setUpdatedApps(data)
        })
      })
      .catch((e) => {
        console.warn(e)
      })
  }, [])

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
          applications={updatedApps}
          href="/apps/collection/recently-updated"
        />

        <ApplicationSection
          key="updated"
          title="New & Updated Apps"
          applications={updatedApps}
          href="/apps/collection/recently-updated"
        />
        <ApplicationSection
          key="popular"
          title="Popular Apps"
          applications={updatedApps}
          href="/apps/collection/popular"
        />

        <ApplicationSection
          key="editor_choice"
          title="Editor's Choice Apps"
          applications={updatedApps}
          href="/apps/collection/editors-choice-apps"
        />

        <ApplicationSection
          key="editor_choice_games"
          title="Editor's Choice Games"
          applications={updatedApps}
          href="/apps/collection/editors-choice-games"
        />
      </div>
    </Main>
  )
}
