import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import Main from '../../src/components/layout/Main';
import Checkout from '../../src/components/payment/checkout/Checkout';
import Spinner from '../../src/components/Spinner';
import { useUserContext } from '../../src/context/user-info';


export default function TransactionSuccess() {
  return (
    <Main>
      <NextSeo title='Transaction Successful' noindex={true}></NextSeo>
      Transaction Success
    </Main>
  )
}
