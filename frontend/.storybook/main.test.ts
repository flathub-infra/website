import { fileURLToPath } from "node:url"
import { afterEach, expect, it, vi } from "vitest"
import { createViteServer } from "vitest/node"
import storybook from "./main"

let server: Awaited<ReturnType<typeof createViteServer>> | undefined

afterEach(async () => {
  await server?.close()
  vi.restoreAllMocks()
})

it("loads locale JSON without public asset warnings", async () => {
  const config = await storybook.viteFinal!(
    {
      configFile: false,
      root: fileURLToPath(new URL("../", import.meta.url)),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: "127.0.0.1", port: 0, preTransformRequests: false },
    },
    { configType: "DEVELOPMENT" } as Parameters<
      NonNullable<typeof storybook.viteFinal>
    >[1],
  )
  server = await createViteServer(config)
  const warn = vi.spyOn(server.config.logger, "warn")
  await server.listen()
  const address = server.httpServer!.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address for the Vite test server")
  }
  const response = await fetch(
    `http://127.0.0.1:${address.port}/public/locales/en/common.json?import`,
  )
  expect(response.status).toBe(200)
  expect(await response.text()).toContain("Downloads per country")
  expect(warn).not.toHaveBeenCalled()
  expect(storybook.staticDirs).toContain("../public")
})
