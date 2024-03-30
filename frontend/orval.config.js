module.exports = {
  "flathub-file-transfomer": {
    output: {
      mode: "tags-split",
      workspace: "./src/codegen",
      target: "./",
      schemas: "./model",
      client: "react-query",
      mock: true,
      prettier: true,
      clean: true,
    },
    input: {
      target: "http://localhost:8000/openapi.json",
    },
  },
}
