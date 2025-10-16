"use client"

import { Input } from "@/components/ui/input"
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
import React from "react"
import { useEffect, useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid"
import {
  FlathubUsersResult,
  Permission,
  UserInfo,
  UserResult,
  useUsersUsersGet,
} from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import { ProviderLogo } from "src/components/login/ProviderLogo"
import Pagination from "src/components/Pagination"
import Spinner from "src/components/Spinner"
import { useSearchParams } from "next/navigation"
import { usePathname, useRouter } from "src/i18n/navigation"

export default function UsersClient() {
  const pageSize = 30
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filterString, setFilterString] = useState<string>(
    searchParams.get("filterString") || undefined,
  )

  const [page, setPage] = useState<number>(
    searchParams.get("page") ? Number(searchParams.get("page")) : 1,
  )

  const query = useUsersUsersGet(
    {
      page: page,
      page_size: pageSize,
      filterString: filterString,
    },
    {
      fetch: {
        credentials: "include",
      },
    },
  )

  const [data, setData] = useState<FlathubUsersResult>()

  useEffect(() => {
    setPage(searchParams.get("page") ? Number(searchParams.get("page")) : 1)
  }, [searchParams])

  useEffect(() => {
    const updateSearchParams = (newParams: { [key: string]: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      router.push(`${pathname}?${params.toString()}`)
    }

    updateSearchParams({ filterString: filterString || "" })
  }, [filterString, router, pathname, searchParams])

  useEffect(() => {
    setData(query?.data?.data)
  }, [query?.data])

  const pages = Array.from(
    { length: data?.pagination?.total_pages ?? 1 },
    (_, i) => i + 1,
  )

  return (
    <AdminLayoutClient
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission["view-users"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Users</h1>
          <div className="px-4 sm:px-6 lg:px-8">
            {query.isLoading && <Spinner size="m" />}

            {query.isSuccess && (
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <Input
                  type="text"
                  placeholder="Search"
                  defaultValue={filterString}
                  onBlur={(e) => setFilterString(e.target.value)}
                />
                <UserTable data={query.data.data} />
                <Pagination currentPage={page} pages={pages} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayoutClient>
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
        if (!row.original.default_account?.provider) {
          return null
        }
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
      accessorFn: (row) => {
        if (!row.default_account?.login) {
          return null
        }
        return row.default_account.login
      },
    },

    {
      id: "email",
      header: "Email",
      accessorFn: (row) => {
        if (!row.default_account?.email) {
          return null
        }
        return row.default_account.email
      },
    },
    {
      id: "last_used",
      header: "Last Used",
      accessorFn: (row) => {
        if (!row.default_account?.last_used) {
          return null
        }
        return format(row.default_account.last_used, "PP")
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
                            asc: <ChevronUpIcon className="size-4" />,
                            desc: <ChevronDownIcon className="size-4" />,
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
