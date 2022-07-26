/**
 * The doc doesn't really mention using webpack.config.js, but .storybook/main.js instead.
 *
 * Nevertheless, configuring the webpack.config.js seems to work fine.
 *
 * @param config
 * @param mode
 * @return {Promise<*>}
 * @see https://storybook.js.org/docs/react/configure/webpack
 * @see https://storybook.js.org/docs/react/configure/webpack#using-your-existing-config
 */
module.exports = async ({ config, mode }) => {
  /**
   * Fixes issue with `next-i18next` and is ready for webpack@5
   * @see https://github.com/isaachinman/next-i18next/issues/1012#issuecomment-792697008
   * @see https://github.com/storybookjs/storybook/issues/4082#issuecomment-758272734
   * @see https://webpack.js.org/migrate/5/
   */
  config.resolve.fallback = {
    fs: false,
    tls: false,
    net: false,
    module: false,
    path: require.resolve("path-browserify"),
  }

  return config
}
