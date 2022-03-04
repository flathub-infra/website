const { i18n } = require('./next-i18next.config')

module.exports = {
  i18n,
  images: {
    loader: 'custom',
    domains: ['flathub.org', 'dl.flathub.org'],
    swcMinify: true,
  },
  experimental: {
    outputStandalone: true,
  },
}
