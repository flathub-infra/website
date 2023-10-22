import { CardInfo } from "src/codegen"
import {
  REMOVE_CARD_URL,
  TRANSACTIONS_URL,
  TRANSACTION_CANCEL_URL,
  TRANSACTION_SAVE_CARD_URL,
  TRANSACTION_SET_CARD_URL,
  TRANSACTION_SET_PENDING_URL,
} from "../env"
import { NewTransaction, Transaction } from "../types/Payment"

/**
 * Performs API request to delete a saved payment card
 * @param card the card to be deleted
 */
export async function deletePaymentCard(card: CardInfo): Promise<void> {
  let res: Response
  try {
    res = await fetch(REMOVE_CARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(card),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

export async function initiateDonation(
  recipient: string,
  amount: number,
): Promise<string> {
  let res: Response
  try {
    res = await fetch(TRANSACTIONS_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: {
          value: amount,
          currency: "usd",
          kind: "donation",
        },
        details: [
          {
            recipient,
            amount,
            currency: "usd",
            kind: "donation",
          },
        ],
      }),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (res.ok) {
    const data: NewTransaction = await res.json()
    return data.id
  } else {
    throw "network-error-try-again"
  }
}

export async function getTransactions(
  sort: string = "recent",
  limit: number = 30,
  since?: string,
): Promise<Transaction[]> {
  const url = new URL(TRANSACTIONS_URL)
  url.searchParams.append("sort", sort)
  url.searchParams.append("limit", limit.toString())
  if (since) {
    url.searchParams.append("since", since)
  }

  let res: Response
  try {
    res = await fetch(url.href, { credentials: "include" })
  } catch {
    throw "failed-to-load-refresh"
  }

  if (res.ok) {
    const data: Transaction[] = await res.json()
    return data
  } else {
    throw "failed-to-load-refresh"
  }
}

export async function setTransactionPending(
  transactionId: string,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SET_PENDING_URL(transactionId), {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

export async function setTransactionSaveCard(
  transactionId: string,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SAVE_CARD_URL(transactionId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ save_card: "on_session" }),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

export async function setTransactionUseCard(
  transactionId: string,
  card: CardInfo,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SET_CARD_URL(transactionId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(card),
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

/**
 * Performs API request to cancel an active transaction
 * @param transactionId ID of the transaction to cancel
 */
export async function cancelTransaction(transactionId: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(TRANSACTION_CANCEL_URL(transactionId), {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}
