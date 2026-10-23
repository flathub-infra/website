import type { ComponentType } from "react"
import {
  AppRouterContext,
  LayoutRouterContext,
} from "next/dist/shared/lib/app-router-context.shared-runtime"

const router = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch() {},
}

const layoutRouter = {
  parentTree: ["/", { children: ["__PAGE__", {}] }],
  parentRenderTree: { data: { bfcacheId: 0 } },
  parentSegmentPath: null,
  parentParams: {},
  url: "/",
  isActive: true,
}

export default function withMockAppRouter(Story: ComponentType) {
  return (
    <AppRouterContext.Provider value={router as never}>
      <LayoutRouterContext.Provider value={layoutRouter as never}>
        <Story />
      </LayoutRouterContext.Provider>
    </AppRouterContext.Provider>
  )
}
