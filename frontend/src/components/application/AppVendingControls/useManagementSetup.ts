import {
  getGetManagementVendingSetupVendingappAppIdManagementSetupGetQueryKey,
  useGetManagementVendingSetupVendingappAppIdManagementSetupGet,
} from "src/codegen"
import { useUserContext } from "src/context/user-info"

export function useManagementSetup(appId: string, enabled = true) {
  const account = useUserContext().info?.invite_code
  return useGetManagementVendingSetupVendingappAppIdManagementSetupGet(appId, {
    axios: { withCredentials: true },
    query: {
      enabled: !!account && enabled,
      queryKey: [
        ...getGetManagementVendingSetupVendingappAppIdManagementSetupGetQueryKey(
          appId,
        ),
        account,
      ],
    },
  })
}
