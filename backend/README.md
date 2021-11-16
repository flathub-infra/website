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

If you change any files, the server should restart and you should be able to proceed.

### Accessing redis
You can use a redis tool of your choice to interact with the database.
Just connect to localhost:6379.
