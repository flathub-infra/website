import React from "react"
import { ComponentMeta } from "@storybook/react"
import PaymentForm from "./PaymentForm"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import Button from "../../Button"

export default {
  title: "Components/Payment/PaymentForm",
  component: PaymentForm,
} as ComponentMeta<typeof PaymentForm>

export const Generated = () => {
  const stripePromise = loadStripe("STRIPE_PUBLISHABLE_API_KEY")
  const options = {
    // this is a secret from the examples, not sure if there's a better one to use for testing
    clientSecret:
      "seti_1LeJSa2eZvKYlo2CBx7rGFDe_secret_MN3ZsdLUuZ6uBQDfUbXwBSKnv9gHlhR",
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        transactionId={"1"}
        callbackPage={`'details/1'`}
        canGoBack={true}
        goBack={() => {}}
        transactionCancelButton={<Button>Cancel</Button>}
      />
    </Elements>
  )
}
