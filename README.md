[![Backend CI](https://github.com/flathub/website/actions/workflows/backend_ci.yml/badge.svg)](https://github.com/flathub/website/actions/workflows/backend_ci.yml)
[![Frontend CI](https://github.com/flathub/website/actions/workflows/frontend_ci.yml/badge.svg)](https://github.com/flathub/website/actions/workflows/frontend_ci.yml)
[![Translation status](https://hosted.weblate.org/widgets/flathub/-/frontend/svg-badge.svg)](https://hosted.weblate.org/engage/flathub/)

# flathub.org

This is the source code for the website, both backend and frontend.

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

## Translations

We're using [Weblate](https://hosted.weblate.org/engage/flathub/) to translate the UI.

## More backend instructions

You can find more backend instructions in the readme in the backend folder.
