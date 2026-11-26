# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

### Added

- Nine architect checks in the Model profile:
  - **DISCO structure:** inputs in calculation modules, calculations in data or input modules, and subsidiary views.
  - **Formulas:** hard-coded list members, hard-coded numbers, repeated formulas and deeply nested IFs.
  - **Performance:** costly functions and large Text line items, both on line items over 1 million cells.
- Architect checks are ordered by severity.
- With Anonymise on, findings that quote a formula are hidden.

## [1.0.0] - 2026-11-27

First release.

### Features

- Four drill-down levels: model (DISCO layers or model sections), layer or section, module as a blueprint grid, and line item lineage, with module-to-module lineage alongside.
- Lineage from Anaplan's **Referenced By** column when the export has it, otherwise from reading formulas, plus dynamic cell access (DCA) drivers. Exports with and without the column can be loaded together.
- Colour by format, summary method, time scale, versions, calculation effort, cell count or formula length.
- Model profile with architect checks, rankings that copy as CSV, search, image export, and light and dark themes.
- **Anonymise** replaces module, line item, section, list, version and time range names with neutral labels, and hides formulas, notes, codes and data tags, so screenshots can be shared.
- Runs entirely in the browser. Nothing is uploaded.
- A made-up sample model, in the app and as `examples/sample-model.csv`.

### Fixed since the first upload

- Models with more than about 150,000 line items no longer fail to load with "Maximum call stack size exceeded".
- Anonymise no longer shows list, version, time range, parent, access driver, code, data tag or section names, and module names no longer appear in the page's internal attributes.
- Formula reading now handles unquoted names that contain AND, OR or IF, ignores the keyword in `[LOOKUP: ...]` and `[SUM: ...]`, and no longer links a line item that is named like a function (for example `Value` in `VALUE(x)`).
- Plain-text summary methods such as `FIRST_NON_BLANK` now get the same name and legend colour as the JSON form.
- Counts read "1 module" and "1 ref" instead of "1 modules" and "1 refs".

### Security

- Cytoscape.js is pinned to 3.30.2 and loaded with a Subresource Integrity hash. The page shows a clear message if it cannot load.

[1.0.0]: https://github.com/karankochhar123/anaplan-lineage/releases/tag/v1.0.0
