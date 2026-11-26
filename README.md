# Anaplan Lineage Explorer

An interactive, browser-only map of how data flows through an Anaplan model. Load a line item blueprint export, and the explorer traces every formula reference so you can see what feeds a line item and what it feeds.

**Open the app:** use the GitHub Pages link shown in this repository's About section.

## Your data stays on your device

- The whole app is a single `index.html` file. All parsing and drawing happen in your browser.
- Nothing is uploaded. The page's Content Security Policy sets `connect-src 'none'`, which blocks the page from sending network requests.
- The only things loaded from the internet are open-source libraries (Cytoscape.js, dagre and fcose from jsDelivr). Your file is never sent anywhere.
- You don't need an Anaplan login or API access.
- You can check all of this yourself: the code is in [`index.html`](index.html), and your browser's Network tab will show no requests carrying your data.

## Features

- **Module and line item views.** Lineage is traced across modules and within a module.
- **Tracing.** Tap any node to see what feeds it (amber) and what it feeds (green), across the full chain or 1–3 steps.
- **Insights.** Rankings for the most referenced line items, line items used by the most modules, biggest downstream impact, most inputs, longest formulas, and the most depended-on modules. Each ranking can be copied as CSV.
- **Model health.** Line items nothing references, the longest formulas, the most-used line items, and modules with no links.
- **Search** across every module and line item.
- **Heat map, list nodes and an anonymise mode,** so you can share structure without names or formulas.
- **Built for big models.** It has been tested with 60,000 line items. Large models open in the module view, and line items are shown one module or one lineage chain at a time.
- **Export** the graph as an image.

## How to export your blueprint from Anaplan

1. In your model, open **Modules** and go to the **Line Items** tab. To export just one module, open that module's **Blueprint** view instead.
2. Select all rows.
3. Choose **Export** and pick **CSV**.
4. Keep at least these columns: **Module**, **Line Item**, **Formula**. **Format** and **Applies To** are optional but give extra detail.
5. Drag the CSV onto the app, or click **Load CSV export**. You can load several files at once.

Tab-separated files and single-module exports with no Module column also work. In that case the file name is used as the module name.

## How formula references are found

Formulas are split on operators outside quotes, and each piece is matched against the model's module and line item names. Both `Module.Line Item` and `'Module'.'Line Item'` are recognised, as are plain line item names from the same module. Text inside double quotes is ignored.

Known limits:
- References to list properties (for example `Employee.Salary Band`) and saved views are not drawn yet.
- Line items that are used only on pages or in exports, and not in formulas, show as "not referenced". Check before deleting anything.

## Run it locally or offline

Download `index.html` and open it in Chrome, Edge, Safari or Firefox. It needs internet access the first time so it can load the libraries.

## Feedback

Please open an issue with any problems or ideas. If your export doesn't parse, include its header row. Sample data is fine; please don't include real model data.
