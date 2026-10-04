# Country boundaries

`countries.topo.json` is generated from Natural Earth's **1:50m Admin 0 –
Countries**, version **5.1.2**. Natural Earth data is public domain.

- Dataset: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/
- License: https://www.naturalearthdata.com/about/terms-of-use/
- Pinned source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
- Source SHA-256: `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`

Regenerate from the `frontend` directory:

```sh
node scripts/generate-country-map.mjs
```

The generator verifies the source checksum, keeps `ISO_A2_EH` as `countryCode`,
combines multiple features with the same code, and uses pinned
`mapshaper@0.7.74` to simplify the geometry to 10% while retaining shapes.
Mapshaper is regeneration tooling only; normal installs and builds use the
checked-in asset and do not download boundary data.

The asset contains 237 unique country/territory codes, including Natural Earth's
`XK` code for Kosovo. Somaliland, Northern Cyprus, and Siachen Glacier have no
two-letter country code in this dataset and are omitted. Natural Earth does not
provide a separate feature for every API territory or aggregate (for example,
the European Union); the statistics page's country list still includes all API
entries. Small territories can be difficult to target at world-map scale.

Against the site-wide statistics checked during generation, 233 of 247 codes
have a matching boundary. The remaining codes are `EU`, `GF`, `GP`, `MQ`, `RE`,
`GI`, `YT`, `BQ`, `CX`, `UM`, `CC`, `TK`, `SJ`, and `BV`. Some are represented
inside another country's geometry; this asset does not invent separate shapes
or reassign their statistics.

To update, change the source version and checksum in the generator, regenerate,
check country-code coverage and the map at desktop/mobile sizes, and update this
attribution. The checksum, tool version, and feature-count check make dataset
changes explicit.
