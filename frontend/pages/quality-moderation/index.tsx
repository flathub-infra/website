import { useQuery } from "@tanstack/react-query"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import clsx from "clsx"
import { format, parseISO } from "date-fns"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"
import { Fragment, ReactElement, useEffect, useState } from "react"
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiMiniChevronDown,
  HiMiniChevronUp,
} from "react-icons/hi2"
import { qualityModerationApi } from "src/api"
import { QualityModerationDashboardRow } from "src/codegen"
import MultiToggle from "src/components/MultiToggle"
import Spinner from "src/components/Spinner"
import { useUserContext } from "src/context/user-info"

export default function QualityModerationDashboard() {
  const { t } = useTranslation()
  const user = useUserContext()

  const [filteredBy, setFilteredBy] = useState<"all" | "passed" | "todo">("all")

  const [sorting, setSorting] = useState<SortingState>([
    { id: "passed", desc: true },
  ])

  const query = useQuery({
    queryKey: ["quality-moderation-dashboard"],
    queryFn: () =>
      qualityModerationApi.getQualityModerationStatusQualityModerationStatusGet(
        {
          withCredentials: true,
        },
      ),
    enabled: !!user.info?.["is-quality-moderator"],
  })

  const columns: ColumnDef<QualityModerationDashboardRow>[] = [
    {
      id: "id",
      header: "ID",
      accessorFn: (row) => row.id,
      cell: ({ row }) => (
        <Link href={`/apps/${row.original.id}`}>{row.original.id}</Link>
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
        return format(date, "Pp")
      },
    },
  ]

  const [data, setData] = useState<QualityModerationDashboardRow[]>([])

  useEffect(() => {
    if (filteredBy === "all") {
      setData(query?.data?.data?.apps ?? [])
    } else if (filteredBy === "passed") {
      setData(
        query?.data?.data?.apps.filter(
          (app) => app.quality_moderation_status.passes,
        ) ?? [],
      )
    } else if (filteredBy === "todo") {
      setData(
        query?.data?.data?.apps.filter(
          (app) =>
            app.quality_moderation_status.not_passed === 0 &&
            app.quality_moderation_status.unrated > 0,
        ) ?? [],
      )
    }
  }, [filteredBy, query?.data?.data?.apps])

  const table = useReactTable<QualityModerationDashboardRow>({
    data,
    columns: columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  const tableRows = table.getRowModel().rows

  let content: ReactElement

  if (!user.info || !user.info["is-quality-moderator"]) {
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
  } else if (query.isLoading) {
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
                  selected: filteredBy === "all",
                  onClick: () => setFilteredBy("all"),
                },
                {
                  id: "passed",
                  content: <span>Passed</span>,
                  selected: filteredBy === "passed",
                  onClick: () => setFilteredBy("passed"),
                },
                {
                  id: "todo",
                  content: <span>Todo</span>,
                  selected: filteredBy === "todo",
                  onClick: () => setFilteredBy("todo"),
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
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Quality Moderation Dashboard" />
      {content}
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
