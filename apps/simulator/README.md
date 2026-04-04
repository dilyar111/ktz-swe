# Simulator Utility

The `@ktz/simulator` package produces synthetic telemetry locally for all locomotive models (e.g. `KZ8A`, `TE33A`) and streams this directly to the `apps/backend`.

## Synthetic Dataset Generation (HK-020)

You can turn the dynamic simulation logic directly into a reusable, labeled flat file. Generating a single coherent table is particularly useful for Machine Learning experiments, automated tests, or simply loading historical performance profiles directly into Pandas or Jupyter notebooks.

### Generate Dataset

To generate the dataset from the root of the monorepo, run:

```bash
npm run export-dataset -w @ktz/simulator
```

*Note: Generating datasets operates strictly offline. Having the backend up and running is not required to extract raw metrics, although generating accurate "Class Health Index Labels" offline relies on loading logic located in `@ktz/backend`.*

### Dataset Schema
The simulation calculates and exports directly into a CSV located at `/artifacts/datasets/synthetic_dataset.csv`.

**Columns Exported:**
- **Identifiers:** `timestamp`, `locomotiveType`, `locomotiveId`
- **Labels:** `demoScenario`, `healthScore`, `healthClass`, `healthStatus`
- **Telemetry:** `speedKmh`, `speedLimitKmh`, `engineTempC`, `brakePressureBar`, `tractionCurrentA`... (and many more) 

### Modifying Scenarios
If your data-science experiments require heavier dataset proportions inside failing or critical states, adjust `TICKS_PER` inside `src/exportDataset.js`.
