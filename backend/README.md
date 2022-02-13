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

If you change any files, the server should restart and you should be able to see the changes.

If you want to explore the endpoints, you can use the UI:
https://localhost:8000/docs

### Accessing redis

You can use a redis tool of your choice to interact with the database.
Just connect to localhost:6379.

### Running the smoketests locally

If you want to run the smoketests locally, you can use the following commands:

```bash
   docker-compose up -d
   docker exec backend_backend_1 pip3 install pytest
   docker exec backend_backend_1 python3 -m pytest tests/main.py
```

You might need to flush your redis database before running the tests. As it assumes that the database is empty.

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
