"use client"

import { Button } from "../../../../@/components/ui/button"
import { Link } from "src/i18n/navigation"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useGetPipelineApiPipelinesPipelineIdGet } from "../../../../src/codegen-pipeline"
import Spinner from "../../../../src/components/Spinner"
import {
  getRepoBadgeVariant,
  BuildCardContent,
} from "../../../../@/components/build/build-card"
import { Badge } from "../../../../@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "../../../../@/components/ui/card"

interface Props {
  pipelineId: string
}

export default function BuildDetailClient({ pipelineId }: Props) {
  const query = useGetPipelineApiPipelinesPipelineIdGet(pipelineId)

  if (query.isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Spinner size="m" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Error: {query.error.message}</p>
      </div>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 mt-4 w-11/12 space-y-10 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Link href="/builds">
        <Button variant="ghost" className="mb-6">
          <ArrowLeftIcon className="h-4 w-4 me-2" />
          Back to Dashboard
        </Button>
      </Link>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <h1 className="text-3xl font-bold mb-6">
              {query.data.data.app_id}
            </h1>
            {query.data.data.repo && (
              <Badge variant={getRepoBadgeVariant(query.data.data.repo)}>
                {query.data.data.repo}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          <BuildCardContent pipelineSummary={query.data.data} />
        </CardContent>

        <CardFooter className="pt-2">
          {query.data.data.log_url && (
            <Button variant="outline" size="sm" className="w-full mt-6" asChild>
              <a
                href={query.data.data.log_url}
                className="size-4 me-2"
                target="_blank"
              >
                View Log
              </a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
