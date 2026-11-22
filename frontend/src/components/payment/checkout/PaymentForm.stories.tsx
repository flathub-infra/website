import { Meta } from "@storybook/nextjs-vite"
import PaymentForm from "./PaymentForm"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js"

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
  const options: StripeElementsOptions = {
    mode: "payment",
    amount: 250,
    currency: "usd",
    paymentMethodTypes: ["card"],
    paymentMethodCreation: "manual",
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        onError={async () => {}}
        intent={{
          checkout_revision: 0,
          client_secret: "pi_example_secret_example",
        }}
        transactionId={"1"}
        callbackPage={`'details/1'`}
        canGoBack={true}
        goBack={() => {}}
      />
    </Elements>
  )
}
