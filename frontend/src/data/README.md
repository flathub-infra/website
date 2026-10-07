# Country boundaries

`countries.topo.json` is generated from Natural Earth's **1:10m Admin 0 –
Countries, Germany point of view**, version **5.1.2**. Natural Earth data is
public domain.

- Dataset: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- License: https://www.naturalearthdata.com/about/terms-of-use/
- Pinned source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_admin_0_countries_deu.geojson
- Source SHA-256: `fc4d56c6bc256f779e0ba21579f81d64885f5296dba3c23c3e78a9b89a7aa0fb`

Regenerate from the `frontend` directory:

```sh
node scripts/generate-country-map.mjs
```

The generator verifies the source checksum, keeps `ISO_A2_EH` as `countryCode`,
combines multiple features with the same code, and uses pinned
`mapshaper@0.7.74` to simplify the geometry to 1.5% while retaining shapes.
Mapshaper is regeneration tooling only; normal installs and builds use the
checked-in asset and do not download boundary data.

The asset contains 239 unique country/territory codes, including Natural Earth's
`XK` code for Kosovo. Akrotiri, Dhekelia, Guantanamo Bay, Bir Tawil, Wake
Island, and Scarborough Shoal have no two-letter country code in this dataset
and are omitted. Natural Earth does not
provide a separate feature for every API territory or aggregate (for example,
the European Union); the statistics page's country list still includes all API
entries. Small territories can be difficult to target at world-map scale.

Against the site-wide statistics checked during generation, 235 of 247 codes
have a matching boundary. The remaining codes are `EU`, `GF`, `GP`, `MQ`, `RE`,
`YT`, `BQ`, `CX`, `CC`, `TK`, `SJ`, and `BV`. Some are represented
inside another country's geometry; this asset does not invent separate shapes
or reassign their statistics.

To update, change the source version and checksum in the generator, regenerate,
check country-code coverage and the map at desktop/mobile sizes, and update this
attribution. The checksum, tool version, and feature-count check make dataset
changes explicit.
