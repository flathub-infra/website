import { useLocalStorage } from "./useLocalStorage";

class PendingTransaction {
  /* The base URL to redirect to when the transaction is finished or cancelled */
  redirect: string;

  /* All apps that were requested */
  appIDs: string[];

  /* The apps that were requested but haven't been purchased yet */
  missingAppIDs: string[];
}

export const usePendingTransaction = () => useLocalStorage<PendingTransaction>("pendingTransaction", null);