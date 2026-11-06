# Thailand map data credits

This demo uses simplified WGS84 province polygons for **cartographic visualization**, not legal/survey or confirmed plant-location purposes.

- Polygon data: [`sr4p/thailandgismap`](https://github.com/sr4p/thailandgismap), `data/geojson/web-optimized/thailand-provinces-web.json`; copyright © 2026 Nattapong Tapachoom, repository software MIT license. The local copy is re-keyed to Thai province names and coordinates are rounded to 4 decimal places. The source repository states that its data aggregates from third parties; consult original data licenses for production reuse.
- Province name crosswalk: [`open-admin-data/thailand-administrative-divisions`](https://github.com/open-admin-data/thailand-administrative-divisions), `data/all-province.json`, CC BY 4.0; copyright © 2026 jakkrapongt. Adapted only to match 77 Thai province names to the geometry's English labels.
- Original references listed by the source maintainers include [UN OCHA / HDX](https://data.humdata.org/dataset/cod-ab-tha) and [cvibhagool/thailand-map](https://github.com/cvibhagool/thailand-map). Verify underlying data licenses before commercial redistribution.

**Important:** The 300 markers are algorithmically generated inside each province polygon, with no claim that they represent actual plant GPS coordinates. Published plant coordinates must come from an approved site master and be verified individually.

Source project license details:

- MIT license: <https://opensource.org/license/mit>
- CC BY 4.0 license: <https://creativecommons.org/licenses/by/4.0/>
