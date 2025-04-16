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
    timestamp: faker.date.recent().getTime() / 1000,
  }

  const summary = {
    timestamp: faker.date.recent().getTime() / 1000,
  }

  return (
    <Releases latestRelease={latestRelease} summary={summary} expanded={true} />
  )
}

export const withChangelog = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: `<p>${faker.lorem.paragraphs(3)}</p><p><ul><li>${faker.lorem.paragraphs(3)}</li><li>${faker.lorem.paragraphs(3)}</li><li>${faker.lorem.paragraphs(3)}</li></ul></p>`,
    timestamp: faker.date.recent().getTime() / 1000,
  }

  const summary = {
    timestamp: faker.date.recent().getTime() / 1000,
  }

  return (
    <Releases latestRelease={latestRelease} summary={summary} expanded={true} />
  )
}

export const notExpanded = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: `<p>${faker.lorem.paragraphs(3)}</p><p><ul><li>${faker.lorem.paragraphs(3)}</li><li>${faker.lorem.paragraphs(3)}</li><li>${faker.lorem.paragraphs(3)}</li></ul></p>`,
    timestamp: faker.date.recent().getTime() / 1000,
  }

  const summary = {
    timestamp: faker.date.recent().getTime() / 1000,
  }

  return (
    <Releases
      latestRelease={latestRelease}
      summary={summary}
      expanded={false}
    />
  )
}

export const withTimestamp = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: faker.lorem.paragraphs(3),
    timestamp: faker.date.recent().getTime() / 1000,
  }

  const summary = {
    timestamp: faker.date.recent().getTime() / 1000,
  }

  return (
    <Releases latestRelease={latestRelease} summary={summary} expanded={true} />
  )
}

export const withUrl = () => {
  const latestRelease: Release = {
    version: faker.system.semver(),
    description: faker.lorem.paragraphs(3),
    timestamp: faker.date.recent().getTime() / 1000,
    url: faker.internet.url(),
  }

  const summary = {
    timestamp: faker.date.recent().getTime() / 1000,
  }

  return (
    <Releases latestRelease={latestRelease} summary={summary} expanded={true} />
  )
}
