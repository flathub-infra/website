# Flathub website backend

This is the fastapi based backend for https://www.flathub.org
Not the backend for flathub itself. Go here, if you're looking for that https://github.com/flathub/flathub

## Development

### Prerequisites

- Docker
- Docker-compose

### Running

Start the database:

```bash
docker compose up
```

You need to seed the database:

```bash
curl -X POST localhost:8000/update
```

Additionally, you may want to update the statistics:

```bash
curl -X POST localhost:8000/update/stats
```

If you perform any transactions which need funds transferring to vendors
then you should:

```bash
curl -X POST localhost:8000/update/process-pending-transfers
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
   docker compose run backend alembic revision --autogenerate -m "Title of migration"
   ```

   If the command ran successfully, a new file will be created under `alembic/versions`.

2. Run the migration after the file has been created via
   ```bash
   docker compose run backend alembic upgrade head
   ```
   This will update your local database.

## Coping with changes others have made

The docker file is set to run migrations when the `backend` container starts, so if you
pull changes and they contain migrations, you can either run step 2 above, or else
simply stop and restart the `backend` container.

## Resetting the database

If you encounter any issues with the database and migrations, then to save yourself time and frustration it might be better to reset your Docker environment with

```bash
docker compose down --volumes
```

After that, using `docker compose up` will download and give you a fresh start from the last working migration.

After these changes, it's possible that the endpoint will need an update. To do this, open another terminal session and run

```bash
curl -X POST localhost:8000/update
```

## Poetry changes

If there's an update in `pyproject.toml` and `poetry.lock`, this means the dependencies have changed and the container needs to be rebuilt.

To do this, you run:

```bash
docker compose up --build
```

## Search

If you're running this locally, you can use http://localhost:7700/ to test the search.

## Stripe

If you want to use the parts of the backend which use Stripe, e.g. for testing vending
or other aspects of the UI which might need wallet access, then you will need to
launch the backend with Stripe credentials.  Here is how to go about setting up a
suitable account with Stripe, and then preparing credentials for use.

### Setting up a development Stripe account

1. Visit <https://dashboard.stripe.com/login> and choose the "Sign-up" link.
2. Create an account and choose the US as your country.
3. Wait for the verification email and use it to verify your account.
4. Stripe will first ask you to activate payments - skip this.
5. Navigate to the 'Connect' page (it may be under a 'More' option).
6. Fill out the 'Complete your platform profile' section, with options:
    1. Select 'Other' and Continue
    2. Select 'From your platform's website or app' and Continue
    3. Select 'Both your platform's name and the seller/service provider's name' and Continue
    4. Select 'Your platform' and Continue, then Submit
7. Once that submits, click the 'Connect settings' link near the top of the page.
8. Scroll down to 'Branding' section:
    1. Complete the business name and icon fields.
    2. Remember to use the 'Save branding changes' button.
9. Navigate to the 'Payments' page.
    1. Ensure that the test mode toggle (at the top of the page) is active.
    2. Use the 'Create a payment' option to seed a balance of $100.
    3. Use the test card details from <https://stripe.com/docs/testing>.

This account will now be usable for testing payment and application vending workflows in local development.

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
STRIPE_WEBHOOK_KEY=... docker compose up --build`

When everything has started, if you visit <http://localhost:8000/docs> you will
see mention of Stripe if things are working properly.
