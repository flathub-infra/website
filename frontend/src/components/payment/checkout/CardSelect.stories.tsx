import React from "react"
import { Meta } from "@storybook/react"
import CardSelect from "./CardSelect"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import Button from "../../Button"
import { PaymentCard, TransactionDetailed } from "../../../types/Payment"

export default {
  title: "Components/Payment/CardSelect",
  component: CardSelect,
} as Meta<typeof CardSelect>

export const Generated = () => {
  const stripePromise = loadStripe("STRIPE_PUBLISHABLE_API_KEY")
  const clientSecret =
    "seti_1LeJSa2eZvKYlo2CBx7rGFDe_secret_MN3ZsdLUuZ6uBQDfUbXwBSKnv9gHlhR"
  const options = {
    // this is a secret from the examples, not sure if there's a better one to use for testing
    clientSecret,
  }

  const transaction: TransactionDetailed = {
    summary: {
      id: "1",
      created: new Date().getDate(),
      currency: "USD",
      kind: "donation",
      status: "pending",
      reason: "payment",
      updated: new Date().getDate(),
      value: 100,
    },
    details: [],
    card: {
      id: "1",
      brand: "visa",
      last4: "4242",
      exp_month: 1,
      exp_year: 2022,
      country: "US",
    },
    receipt: "15",
  }

  const cards: PaymentCard[] = [
    {
      id: "1",
      brand: "visa",
      last4: "4242",
      exp_month: 1,
      exp_year: 2022,
      country: "US",
    },
    {
      id: "2",
      brand: "mastercard",
      last4: "4242",
      exp_month: 1,
      exp_year: 2022,
      country: "US",
    },
  ]

  return (
    <Elements stripe={stripePromise} options={options}>
      <CardSelect
        transaction={transaction}
        clientSecret={clientSecret}
        cards={cards}
        error={"error"}
        submit={() => {}}
        skip={() => {}}
        transactionCancelButton={<Button>Cancel</Button>}
      />
    </Elements>
  )
}
