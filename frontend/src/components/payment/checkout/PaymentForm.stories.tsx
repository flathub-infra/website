import { Meta } from "@storybook/nextjs-vite"
import PaymentForm from "./PaymentForm"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"

export default {
  title: "Components/Payment/PaymentForm",
  component: PaymentForm,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof PaymentForm>

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
      />
    </Elements>
  )
}
