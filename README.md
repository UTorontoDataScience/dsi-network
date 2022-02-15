# dsi-network
A webapp for visualizing data science resources at the University of Toronto

## Stack
The DSI network application is written in [TypeScript](https://www.typescriptlang.org/) using the [React](https://reactjs.org/) framework and the [MaterialUI](https://mui.com/) component library. Visualizations are rendered with [D3](https://github.com/d3/d3), making particular use of the [force layout](https://github.com/d3/d3-force).

## Build instructions
If you have a recent version of [Node.js](https://nodejs.org/en/) on your machine, you can build the project by first installing the dependencies with `yarn install` and then starting the development server with `yarn start` (both commands should be run inside the `react` directory). This project was bootstrapped with [Create-React-App](https://reactjs.org/docs/create-a-new-react-app.html) and additional commands and options can be found in its documentation.

This project also contains a [docker-compose](https://docs.docker.com/compose/) configuration file and can be run in a Docker container. To do so, first make sure you have Docker and docker-compose installed on your system, then install dependencies with `docker-compose run --rm --entrypoint="" react yarn install`, then run `docker-compose up` from the root project directory to bring up the application.
