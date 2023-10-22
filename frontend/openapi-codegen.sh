# Clean slate
rm -rf ./src/codegen

export TS_POST_PROCESS_FILE="prettier --write --ignore-path .gitignore"

npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json -o src/codegen \
  --enable-post-process-file \
  -g typescript-axios --additional-properties=supportsES6=true

# Tidy up unnecessary artifacts
# Not interested in publishing as a separate npm package
rm -rf ./openapitools.json \
  ./src/codegen/.openapi-generator \
  ./src/codegen/.openapi-generator-ignore \
  ./src/codegen/.npmignore \
  ./src/codegen/.gitignore \
  ./src/codegen/git_push.sh
