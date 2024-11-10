import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import clsx from "clsx"
import { format } from "date-fns"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import React from "react"
import { ReactElement, useEffect, useState } from "react"
import {
  HiExclamationTriangle,
  HiMiniChevronDown,
  HiMiniChevronUp,
} from "react-icons/hi2"
import {
  FlathubUsersResult,
  Permission,
  UserInfo,
  UserResult,
  useUsersUsersGet,
} from "src/codegen"
import AdminLayout from "src/components/AdminLayout"
import { ProviderLogo } from "src/components/login/ProviderLogo"
import Pagination from "src/components/Pagination"
import Spinner from "src/components/Spinner"

UserModeration.getLayout = function getLayout(page: ReactElement) {
  return (
    <AdminLayout
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission.moderation)
      }
    >
      {page}
    </AdminLayout>
  )
}

export default function UserModeration() {
  const pageSize = 30

  const router = useRouter()

  const [page, setPage] = useState<number>(
    router?.query?.page ? Number(router.query.page) : 1,
  )

  const query = useUsersUsersGet(
    {
      page: page,
      page_size: pageSize,
    },
    {
      axios: {
        withCredentials: true,
      },
    },
  )

  const [data, setData] = useState<FlathubUsersResult>()

  useEffect(() => {
    setPage(router?.query?.page ? Number(router.query.page) : 1)
  }, [router.query.page])

  useEffect(() => {
    setData(query?.data?.data)
  }, [query?.data])

  const pages = Array.from(
    { length: data?.pagination?.total_pages ?? 1 },
    (_, i) => i + 1,
  )

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Users" noindex />
      <div className="space-y-8">
        <h1 className="mt-8 text-4xl font-extrabold">Users</h1>
        <div className="px-4 sm:px-6 lg:px-8">
          {query.isLoading && <Spinner size="m" />}

          {query.isSuccess && (
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <UserTable data={query.data.data} />
              <Pagination currentPage={page} pages={pages} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const UserTable = ({ data }: { data: FlathubUsersResult }) => {
  const router = useRouter()

  const columns: ColumnDef<UserResult>[] = [
    {
      id: "id",
      header: "Id",
      accessorKey: "id",
    },
    {
      id: "provider",
      header: "Provider",
      accessorFn: (row) => row.default_account.provider,
      cell: ({ row }) => {
        return <ProviderLogo provider={row.original.default_account.provider} />
      },
    },
    {
      id: "display_name",
      header: "Display Name",
      accessorKey: "display_name",
    },
    {
      id: "username",
      header: "Username",
      accessorFn: (row) => row.default_account.login,
    },

    {
      id: "email",
      header: "Email",
      accessorFn: (row) => row.default_account.email,
    },
    {
      id: "last_used",
      header: "Last Used",
      accessorFn: (row) => {
        return format(row.default_account.last_used, "PP")
      },
    },
    {
      id: "deleted",
      header: "Deleted",
      cell: ({ row }) => {
        return (
          row.original.deleted && (
            <HiExclamationTriangle className="w-6 h-6 text-flathub-electric-red" />
          )
        )
      },
    },
  ]

  const table = useReactTable<UserResult>({
    data: data?.users ?? [],
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id.toString(),
  })

  const tableRows = table.getRowModel().rows

  return (
    <>
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
                  <motion.tr
                    layoutId={row.id}
                    key={row.id}
                    transition={{ delay: 0 }}
                    className={clsx(
                      "h-12 font-medium hover:bg-flathub-gainsborow dark:hover:bg-flathub-arsenic hover:cursor-pointer",
                    )}
                    onClick={() => {
                      router.push(`/admin/users/${row.original.id}`)
                    }}
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
                )
              })}
            </AnimatePresence>
          </LayoutGroup>
        </tbody>
      </table>
      {data && (
        <div>
          <div className="ms-auto w-fit">{data.pagination.total} users</div>
        </div>
      )}
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
