import { useQuery } from "@tanstack/react-query"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import clsx from "clsx"
import { formatDistanceToNow, parseISO } from "date-fns"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"
import { useRouter } from "next/router"
import { Fragment, ReactElement, useEffect, useState } from "react"
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiMiniChevronDown,
  HiMiniChevronUp,
} from "react-icons/hi2"
import { qualityModerationApi } from "src/api"
import {
  GetQualityModerationStatusQualityModerationStatusGetFilterEnum,
  QualityModerationDashboardResponse,
  QualityModerationDashboardRow,
} from "src/codegen"
import LogoImage from "src/components/LogoImage"
import MultiToggle from "src/components/MultiToggle"
import Pagination from "src/components/Pagination"
import Spinner from "src/components/Spinner"
import { useUserContext } from "src/context/user-info"
import { Appstream } from "src/types/Appstream"

export default function QualityModerationDashboard() {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  const pageSize = 30

  const [page, setPage] = useState<number>(
    router?.query?.page ? Number(router.query.page) : 1,
  )

  const [filteredBy, setFilteredBy] =
    useState<GetQualityModerationStatusQualityModerationStatusGetFilterEnum>(
      (router.query
        .filter as GetQualityModerationStatusQualityModerationStatusGetFilterEnum) ??
        "all",
    )

  const query = useQuery({
    queryKey: ["quality-moderation-dashboard", page, pageSize, filteredBy],
    queryFn: ({ signal }) =>
      qualityModerationApi.getQualityModerationStatusQualityModerationStatusGet(
        page,
        pageSize,
        filteredBy,
        {
          withCredentials: true,
          signal,
        },
      ),
    enabled: !!user.info?.is_quality_moderator,
    placeholderData: (previousData, previousQuery) => previousData,
  })

  const columns: ColumnDef<QualityModerationDashboardRow>[] = [
    {
      id: "icon",
      header: "Icon",
      cell: ({ row }) =>
        (row.original.appstream as Appstream).icon && (
          <Link href={`/apps/${row.original.id}`}>
            <div className="relative m-2 flex h-[64px] min-w-[64px] self-center drop-shadow-md">
              <LogoImage
                size="64"
                iconUrl={(row.original.appstream as Appstream).icon}
                appName={(row.original.appstream as Appstream).name}
              />
            </div>
          </Link>
        ),
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <Link href={`/apps/${row.original.id}`}>
            {(row.original.appstream as Appstream).name}
          </Link>
          <div className="text-xs dark:text-flathub-gray-x11 text-flathub-sonic-silver">
            {(row.original.appstream as Appstream).summary}
          </div>
        </div>
      ),
    },
    {
      id: "unrated",
      header: "Unrated",
      accessorFn: (row) => row.quality_moderation_status.unrated,
      cell: ({ row }) => row.original.quality_moderation_status.unrated,
    },
    {
      id: "not_passed",
      header: "Not Passed",
      accessorFn: (row) => row.quality_moderation_status.not_passed,
      cell: ({ row }) => row.original.quality_moderation_status.not_passed,
    },
    {
      id: "passed",
      header: "Passed",
      accessorFn: (row) => row.quality_moderation_status.passed,
      cell: ({ row }) => row.original.quality_moderation_status.passed,
    },
    {
      id: "passes",
      header: "Status",
      accessorFn: (row) => row.quality_moderation_status.passes,
      cell: ({ row }) =>
        row.original.quality_moderation_status.passes ? (
          <HiCheckCircle className="w-6 h-6 text-flathub-celestial-blue" />
        ) : (
          <HiExclamationTriangle className="w-6 h-6 text-flathub-electric-red" />
        ),
    },
    {
      id: "moderation-last-updated",
      header: "Moderation Last Updated",
      accessorFn: (row) => row.quality_moderation_status.last_updated,
      cell: ({ row }) => {
        const date = parseISO(
          row.original.quality_moderation_status.last_updated,
        )
        return formatDistanceToNow(date, { addSuffix: true })
      },
    },
    {
      id: "installs-last-7-days",
      header: "Installs Last 7 Days",
      accessorFn: (row) => row.installs_last_7_days,
    },
    {
      id: "review-requested",
      header: "Review Requested",
      accessorFn: (row) => row.quality_moderation_status.review_requested_at,
      cell: ({ row }) => {
        if (!row.original.quality_moderation_status.review_requested_at) {
          return null
        }
        const date = parseISO(
          row.original.quality_moderation_status.review_requested_at,
        )
        return formatDistanceToNow(date, { addSuffix: true })
      },
    },
  ]

  const [data, setData] = useState<QualityModerationDashboardResponse>()

  useEffect(() => {
    setPage(router?.query?.page ? Number(router.query.page) : 1)
  }, [router.query.page])

  useEffect(() => {
    setFilteredBy(
      (router.query
        .filter as GetQualityModerationStatusQualityModerationStatusGetFilterEnum) ??
        "all",
    )
  }, [router.query.filter])

  useEffect(() => {
    setData(query?.data?.data)
  }, [query?.data])

  const table = useReactTable<QualityModerationDashboardRow>({
    data: data?.apps ?? [],
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  const tableRows = table.getRowModel().rows

  const pages = Array.from(
    { length: data?.pagination?.total_pages ?? 1 },
    (_, i) => i + 1,
  )

  let content: ReactElement

  if (!user.info || !user.info.is_quality_moderator) {
    content = (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>
      </>
    )
  } else if (query.isPending) {
    content = <Spinner size="m" />
  } else {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">
          Quality Moderation Dashboard
        </h1>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <MultiToggle
              size="lg"
              items={[
                {
                  id: "all",
                  content: <span>All</span>,
                  selected:
                    filteredBy ===
                    GetQualityModerationStatusQualityModerationStatusGetFilterEnum.All,
                  onClick: () => {
                    delete router.query.filter

                    router.query.page = "1"

                    router.push({
                      query: router.query,
                    })
                  },
                },
                {
                  id: "passed",
                  content: <span>Passing</span>,
                  selected:
                    filteredBy ===
                    GetQualityModerationStatusQualityModerationStatusGetFilterEnum.Passing,
                  onClick: () => {
                    router.query.filter =
                      GetQualityModerationStatusQualityModerationStatusGetFilterEnum.Passing

                    router.query.page = "1"

                    router.push({
                      query: router.query,
                    })
                  },
                },
                {
                  id: "todo",
                  content: <span>Todo</span>,
                  selected:
                    filteredBy ===
                    GetQualityModerationStatusQualityModerationStatusGetFilterEnum.Todo,
                  onClick: () => {
                    router.query.filter =
                      GetQualityModerationStatusQualityModerationStatusGetFilterEnum.Todo

                    router.query.page = "1"

                    router.push({
                      query: router.query,
                    })
                  },
                },
              ]}
            />
            <table className="min-w-full divide-y divide-flathub-gray-x11 dark:divide-flathub-arsenic">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="relative">
                    {headerGroup.headers.map((header) => {
                      return (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className="py-13.5 h-20 text-sm font-normal first:rounded-tl-2xl last:rounded-tr-2xl sm:pl-0"
                        >
                          {header.isPlaceholder ? null : (
                            <div className="flex w-full">
                              <button
                                type="button"
                                {...{
                                  className: clsx(
                                    header.column.getCanSort() &&
                                      "cursor-pointer select-none",
                                    "flex items-center justify-between gap-1",
                                  ),
                                  onClick:
                                    header.column.getToggleSortingHandler(),
                                }}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                                {{
                                  asc: <HiMiniChevronUp className="h-4 w-4" />,
                                  desc: (
                                    <HiMiniChevronDown className="h-4 w-4" />
                                  ),
                                }[header.column.getIsSorted() as string] ??
                                  null}
                              </button>
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-flathub-gray-x11 dark:divide-flathub-arsenic">
                <LayoutGroup>
                  <AnimatePresence>
                    {tableRows.length === 0 && (
                      <tr className="h-12">
                        <td
                          colSpan={columns.length}
                          className="p-8 text-center"
                        >
                          No items
                        </td>
                      </tr>
                    )}
                    {tableRows.map((row, rowIndex) => {
                      return (
                        <Fragment key={row.id}>
                          <motion.tr
                            layoutId={row.id}
                            key={row.id}
                            transition={{ delay: 0 }}
                            className={clsx("h-12 font-medium")}
                          >
                            {row.getVisibleCells().map((cell) => {
                              return (
                                <td
                                  key={cell.id}
                                  className={clsx(
                                    "whitespace-nowrap py-5 text-sm",
                                  )}
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                  )}
                                </td>
                              )
                            })}
                          </motion.tr>
                        </Fragment>
                      )
                    })}
                  </AnimatePresence>
                </LayoutGroup>
              </tbody>
            </table>
            {data && (
              <div>
                <div className="ms-auto w-fit">
                  {data.pagination.total} apps
                </div>
              </div>
            )}
            <Pagination currentPage={page} pages={pages} />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Quality Moderation Dashboard" noindex />
      {content}
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
