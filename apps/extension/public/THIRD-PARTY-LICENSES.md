# Third-party licences

The WebMCP Today extension is MIT licensed (see `LICENSE`). Its build inlines the
packages below into the shipped bundles, so they are distributed with it and are
listed here with the licence they are distributed under and where to obtain their
source.

This file lives in `public/`, which the build copies verbatim into the packaged
extension — the point is that a _recipient_ of the zip can read it, not only
someone browsing the repository.

## Bundled

| Package                        | Version                                | Licence | Source                                                    |
| ------------------------------ | -------------------------------------- | ------- | --------------------------------------------------------- |
| `zod`                          | `^4.0.0` (see `bun.lock` for resolved) | MIT     | https://github.com/colinhacks/zod                         |
| `@jmespath-community/jmespath` | 1.3.0                                  | MPL-2.0 | https://github.com/jmespath-community/typescript-jmespath |
| `tldts`                        | 7.4.10                                 | MIT     | https://github.com/remusao/tldts                          |

### MPL-2.0 notice

`@jmespath-community/jmespath` is covered by the Mozilla Public License 2.0. MPL-2.0
is file-level copyleft: it attaches to that package's own files (§1.4 "Covered
Software"), which remain under MPL-2.0. Its Source Code Form is available at the URL
above and from npm (`npm pack @jmespath-community/jmespath@1.3.0`); a full copy of the
licence ships in that package as `LICENSE`. The rest of this extension is MIT and is a
Larger Work under §3.3, which MPL-2.0 permits us to license under our own terms.
