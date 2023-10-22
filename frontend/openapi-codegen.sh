# Clean slate
export TS_POST_PROCESS_FILE="prettier --write --ignore-path .gitignore"

npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json -o src/codegen \
  --enable-post-process-file \
  -g typescript-axios --additional-properties=supportsES6=true
