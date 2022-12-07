# Flathub website backend

This is the fastapi based backend for https://www.flathub.org
Not the backend for flathub itself. Go here, if your looking for that https://github.com/flathub/flathub

## Development

### Prerequisites

- Docker
- Docker-compose

### Running

Start the database:

```bash
docker-compose up
```

You need to seed the database:

```bash
curl -X POST localhost:8000/update
```

Additionally, you may want to update the statistics:

```bash
curl -X POST localhost:8000/update/stats
```

If you change any files, the server should restart and you should be able to see the changes.

If you want to explore the endpoints, you can use the UI:
https://localhost:8000/docs

### Accessing redis

You can use a redis tool of your choice to interact with the database.
Just connect to localhost:6379.

### Running smoke tests locally

Smoke tests are executed against non-production data for reproducibility. To
reproduce CI setup, first recreate the environment:

```
docker compose down -v
docker compose --env-file .env.ci up --build
```

After that finishes, execute the helper script:

```
bash tests/run_tests.sh
```

## How to make changes to the SQL database schema

Making a change to the database schema in `models.py` will require a database migration.

If you want to update the models, first make the change in `models.py` and then
prepare and run a migration. You should ensure that any model change is committed
along with its migration so that the two do not get out of sync.

Once you have made your `models.py` change:

1. Prepare your migration with:

   ```bash
   docker-compose run backend alembic revision --autogenerate -m "Title of migration"
   ```

   If the command ran successfully, a new file will be created under `alembic/versions`.

2. Run the migration after the file has been created via
   ```bash
   docker-compose run backend alembic upgrade head
   ```
   This will update your local database.

## Coping with changes others have made

The docker file is set to run migrations when the `backend` container starts, so if you
pull changes and they contain migrations, you can either run step 2 above, or else
simply stop and restart the `backend` container.

## Resetting the database

If you encounter any issues with the database and migrations, then to save yourself time and frustration it might be better to reset your Docker environment with

```bash
docker-compose down --volumes
```

After that, using `docker-compose up` will download and give you a fresh start from the last working migration.

After these changes, it's possible that the endpoint will need an update. To do this, open another terminal session and run

```bash
curl -X POST localhost:8000/update
```

## Poetry changes

If there's an update in `pyproject.toml` and `poetry.lock`, this means the dependencies have changed and the container needs to be rebuilt.

To do this, you run:

```bash
docker-compose up --build
```

## Search

If you running this locally, you can use http://localhost:7700/ to test the search.

## Stripe

If you want to use the parts of the backend which use Stripe, e.g. for testing vending
or other aspects of the UI which might need wallet access, then you will need to
launch the backend with Stripe credentials.  Here is how to go about setting up a
suitable account with Stripe, and then preparing credentials for use.

### Create and configure a Stripe account

1. Visit <https://dashboard.stripe.com/login> and choose the "Sign-up" link.
2. Enter an email, name, and password, and ensure that you choose the US as your
   country.
3. Tick the 'don't email me' box, and then submit the form
4. Wait for the verification email, and use it to get your account verified.
5. The first thing it'll ask you to do is activate payments - skip this.
6. Visit the 'Connect' tab on the dashboard and hit 'Get Started' in the 'For Platforms' section
7. Select 'Platform or Marketplace' and hit Continue
8. Under 'Select products for your users' hit Start
9. The two products you want are 'Connect' and 'Payments', hit 'Done'
10. On the right, under 'Payments' hit 'Continue Setup'
11. Choose 'Other' and press Continue
12. Choose 'From your platform's website or app' and hit Continue
13. Choose 'Both your platform's name and the seller/service provider's name' and hit Continue
14. Choose 'Your platform' and hit Continue, then hit Submit
15. Once that completes, find the 'Connect settings' link near the top and choose it
16. Scroll down to Branding and fill it out with something reasonable
17. Press the 'Save branding changes' button
18. Visit 'Settings' 'Bank Accounts and Scheduling' and switch to manual payouts
19. Visit the 'Balances' page, and, ensuring you're in test mode still, press 'Add to balance'
20. Choose 'Connected accounts', add 100 dollars

Now things should work for testing

### Acquiring your Stripe keys

1. Return to 'Home' of the dashboard, and then ensure test mode is turned on
2. On the RHS there's a 'For developers' section, it should mention test mode
3. Click on the Publishable key to copy it, paste it into your notes.
   This is STRIPE_PUBLIC_KEY
4. Click on the Secret key once to reveal, and a second time to copy, paste it into your notes.
   This is STRIPE_SECRET_KEY

To acquire your webhook key, you can use the stripe CLI tool.  Install it
and then run `stripe login` - complete the login in your browser and the CLI
should succeed.  Next run `stripe listen` and it will give you your webhook secret.
This is STRIPE_WEBHOOK_KEY.

If you want webhooks to make it from the testing into the backend then run:
`stripe listen --forward-to localhost:8000/wallet/webhook/stripe`.

### Running the website with the right keys

In the backend directory you can run `env STRIPE_PUBLIC_KEY=... STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_KEY=... docker-compose up --build`

When everything has started, if you visit <http://localhost:8000/docs> you will
see mention of Stripe if things are working properly.

