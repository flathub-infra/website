[![Backend CI](https://github.com/flathub/website/actions/workflows/backend_ci.yml/badge.svg)](https://github.com/flathub/website/actions/workflows/backend_ci.yml)
[![Frontend CI](https://github.com/flathub/website/actions/workflows/frontend_ci.yml/badge.svg)](https://github.com/flathub/website/actions/workflows/frontend_ci.yml)
[![Translation status](https://hosted.weblate.org/widgets/flathub/-/frontend/svg-badge.svg)](https://hosted.weblate.org/engage/flathub/)

# flathub.org

This is the source code for the website, both backend and frontend. That's running on https://beta.flathub.org and hopefully soon https://flathub.org

# Code contribution

First of all thanks for considering contributing to this project!

Pull request are welcome. Please, create an issue first explaining what you want to do and how.

### Development

You'll need git, yarn, docker and docker-compose.

Go to the folder where you manage your projects and checkout this project.

Then start the backend:

```sh
cd backend
docker-compose up
```

Use another terminal session to run the following or use your browser to go to localhost:8000/docs and use the UI to run the `/update` endpoint.
This will populate the database with the latest data from the flathub.

```sh
curl -X POST localhost:8000/update
```

Then open a terminal and go the the frontend folder.
If it's the first time you run it, run

```sh
yarn
```

Then you should be able to start the dev server and see changed to the code:

```sh
yarn dev
```

## More backend instructions

You can find more backend instructions in the readme in the backend folder.

## Translations

We're using [Weblate](https://hosted.weblate.org/engage/flathub/) to translate the UI. So feel free, to contribute translations over there.

## Stripe development setup

In development, to connect the backend to Stripe you must:

1. Create a US based Stripe account and verify your email.
2. Go to the Developers tab of the Stripe dashboard and toggle test mode.
3. Insert the publishable and secret keys from the page into the corresponding backend `docker-compose.yml` environment variables (`STRIPE_PUBLIC_KEY` and `STRIPE_SECRET_KEY`).
4. Go the the Webhooks section of the Developers tab, select to test in a local environment.
5. Follow the steps to setup the webhook with Stripe CLI, listening to `localhost:8000/wallet/webhook/stripe`.
6. Insert the webhook signing secret into the corresponding backend `docker-compose.yml` environment variable (`STRIPE_WEBHOOK_KEY`).

To allow creation of test Stripe Express accounts, you must:

1. Go to the Connect tab of the Stripe dashboard.
2. Complete the platform profile.
3. Go to Settings > Connect Settings in your Stripe account and set a business name and icon.

## Stripe testing

In both staging and development environments, Stripe is running in test mode (all data is fake).

To test payment, card details can be used from https://stripe.com/docs/testing

To test creation of a Stripe Express account, see https://stripe.com/docs/connect/testing
