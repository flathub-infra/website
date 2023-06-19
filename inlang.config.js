export async function defineConfig(env) {
    const { default: i18nextPlugin } = await env.$import(
      "./frontend/node_modules/@inlang/plugin-i18next/dist/index.js"
    );
    const { default: standardLintRules } = await env.$import(
      "./frontend/node_modules/@inlang/plugin-standard-lint-rules/dist/index.js"
    );
  
    return {
      referenceLanguage: "en",
      plugins: [
        i18nextPlugin({
          pathPattern: "./frontend/public/locales/{language}/common.json",
        }),
        standardLintRules(),
      ],
    };
  }