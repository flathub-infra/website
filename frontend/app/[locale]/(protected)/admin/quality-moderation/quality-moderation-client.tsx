"use client"

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
import { useSearchParams } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiMiniChevronDown,
  HiMiniChevronUp,
} from "react-icons/hi2"
import LogoImage from "src/components/LogoImage"
import MultiToggle from "src/components/MultiToggle"
import Pagination from "src/components/Pagination"
import { useUserContext } from "src/context/user-info"
import { Appstream } from "src/types/Appstream"
import {
  GetQualityModerationStatusQualityModerationStatusGetFilter,
  Permission,
  QualityModerationDashboardResponse,
  QualityModerationDashboardRow,
  UserInfo,
  useGetQualityModerationStatusQualityModerationStatusGet,
} from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import Spinner from "src/components/Spinner"
import { useLocale } from "next-intl"
import { useRouter, usePathname, Link } from "src/i18n/navigation"

export default function QualityModerationClient() {
  const user = useUserContext()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()

  const pageSize = 30

  const [page, setPage] = useState<number>(
    searchParams.get("page") ? Number(searchParams.get("page")) : 1,
  )

  const [filteredBy, setFilteredBy] =
    useState<GetQualityModerationStatusQualityModerationStatusGetFilter>(
      (searchParams.get(
        "filter",
      ) as GetQualityModerationStatusQualityModerationStatusGetFilter) ??
        "todo",
    )

  const query = useGetQualityModerationStatusQualityModerationStatusGet(
    {
      page: page,
      page_size: pageSize,
      filter: filteredBy,
    },
    {
      axios: { withCredentials: true },
      query: {
        enabled: !!user.info?.permissions.some(
          (a) => a === Permission["quality-moderation"],
        ),
        placeholderData: (previousData) => previousData,
      },
    },
  )

  useEffect(() => {
    setPage(searchParams.get("page") ? Number(searchParams.get("page")) : 1)
  }, [searchParams])

  useEffect(() => {
    setFilteredBy(
      (searchParams.get(
        "filter",
      ) as GetQualityModerationStatusQualityModerationStatusGetFilter) ??
        "todo",
    )
  }, [searchParams])

  const pages = Array.from(
    { length: query.data?.data?.pagination?.total_pages ?? 1 },
    (_, i) => i + 1,
  )

  const updateSearchParams = (newParams: { [key: string]: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value)
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <AdminLayoutClient
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission["quality-moderation"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <>
          <h1 className="my-8 text-4xl font-extrabold">Quality Moderation</h1>

          <div className="px-4 sm:px-6 lg:px-8">
            {query.isLoading && <Spinner size="m" />}
            {query.isSuccess && (
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <QualityModerationTable
                  currentPage={page}
                  data={query.data.data}
                  filteredBy={filteredBy}
                  updateSearchParams={updateSearchParams}
                  locale={locale}
                />
                <Pagination currentPage={page} pages={pages} />
              </div>
            )}
          </div>
        </>
      </div>
    </AdminLayoutClient>
  )
}

const QualityModerationTable = ({
  data,
  filteredBy,
  updateSearchParams,
  locale,
}: {
  data: QualityModerationDashboardResponse
  filteredBy: GetQualityModerationStatusQualityModerationStatusGetFilter
  currentPage: number
  updateSearchParams: (params: { [key: string]: string }) => void
  locale: string
}) => {
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
      accessorFn: (row) => row.quality_moderation_status.last_updated + "Z",
      cell: ({ row }) => {
        const date = parseISO(
          row.original.quality_moderation_status.last_updated + "Z",
        )
        return (
          <span title={date.toLocaleString(locale)}>
            {formatDistanceToNow(date, {
              addSuffix: true,
            })}
          </span>
        )
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
      accessorFn: (row) =>
        row.quality_moderation_status.review_requested_at + "Z",
      cell: ({ row }) => {
        if (!row.original.quality_moderation_status.review_requested_at) {
          return null
        }
        const date = parseISO(
          row.original.quality_moderation_status.review_requested_at + "Z",
        )
        return (
          <span title={date.toLocaleString(locale)}>
            {formatDistanceToNow(date, {
              addSuffix: true,
            })}
          </span>
        )
      },
    },
  ]

  const table = useReactTable<QualityModerationDashboardRow>({
    data: data?.apps ?? [],
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  const tableRows = table.getRowModel().rows

  return (
    <>
      <MultiToggle
        size="lg"
        items={[
          {
            id: "todo",
            content: <span>Todo</span>,
            selected:
              filteredBy ===
              GetQualityModerationStatusQualityModerationStatusGetFilter.todo,
            onClick: () => {
              updateSearchParams({
                filter:
                  GetQualityModerationStatusQualityModerationStatusGetFilter.todo,
                page: "1",
              })
            },
          },
          {
            id: "passed",
            content: <span>Passing</span>,
            selected:
              filteredBy ===
              GetQualityModerationStatusQualityModerationStatusGetFilter.passing,
            onClick: () => {
              updateSearchParams({
                filter:
                  GetQualityModerationStatusQualityModerationStatusGetFilter.passing,
                page: "1",
              })
            },
          },
          {
            id: "all",
            content: <span>All</span>,
            selected:
              filteredBy ===
              GetQualityModerationStatusQualityModerationStatusGetFilter.all,
            onClick: () => {
              updateSearchParams({
                filter:
                  GetQualityModerationStatusQualityModerationStatusGetFilter.all,
                page: "1",
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
                    className="h-20 text-sm font-normal"
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
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: <HiMiniChevronUp className="size-4" />,
                            desc: <HiMiniChevronDown className="size-4" />,
                          }[header.column.getIsSorted() as string] ?? null}
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
                  <td colSpan={columns.length} className="p-8 text-center">
                    No items
                  </td>
                </tr>
              )}
              {tableRows.map((row) => {
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
                            className={clsx("whitespace-nowrap py-5 text-sm")}
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
          <div className="ms-auto w-fit">{data.pagination.total} apps</div>
        </div>
      )}
    </>
  )
}
