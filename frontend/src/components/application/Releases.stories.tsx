import React from "react"
import { Meta } from "@storybook/react"
import Releases from "./Releases"
import { faker } from "@faker-js/faker"
import { Release } from "../../types/Appstream"

export default {
  title: "Components/Application/Releases",
  component: Releases,
} as Meta<typeof Releases>

export const noChangelogProvided = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
  }

  const summary = {
    timestamp: faker.date.recent().getTime(),
  }

  return <Releases latestRelease={latestRelease} summary={summary} />
}

export const withChangelog = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: faker.lorem.paragraphs(3),
  }

  const summary = {
    timestamp: faker.date.recent().getTime(),
  }

  return <Releases latestRelease={latestRelease} summary={summary} />
}

export const withTimestamp = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: faker.lorem.paragraphs(3),
    timestamp: faker.date.recent().getTime() / 1000,
  }

  const summary = {
    timestamp: faker.date.recent().getTime(),
  }

  return <Releases latestRelease={latestRelease} summary={summary} />
}

export const withUrl = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: faker.lorem.paragraphs(3),
    timestamp: faker.date.recent().getTime() / 1000,
    url: faker.internet.url(),
  }

  const summary = {
    timestamp: faker.date.recent().getTime(),
  }

  return <Releases latestRelease={latestRelease} summary={summary} />
}
