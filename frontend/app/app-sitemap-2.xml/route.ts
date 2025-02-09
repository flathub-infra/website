import { createAppSitemap } from "app/app-sitemap"

export async function GET(request: Request) {
  return createAppSitemap(2)
}
