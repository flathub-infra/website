![CI](https://github.com/bilelmoussaoui/frontend/workflows/CI/badge.svg)
# Frontend for flathub.org

This is the frontend component of what is going to be the new flathub.org
You can find the used backend here: https://github.com/flathub/backend/ it's currently not hosted anywhere, so you'll need to run it locally.

## Development

You'll need git, yarn, docker and docker-compose.

Go to the folder where you manage your projects and run this. It will checkout both repos you'll need.

```sh
git checkout git@github.com:flathub/backend.git
git checkout git@github.com:flathub/frontend.git
```

Then start the backend:
```sh
cd backend
docker-compose up
```

Use another terminal session to run the following or use your browser to go to localhost:8000/docs and use the UI to run the `/update` endpoint.
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
