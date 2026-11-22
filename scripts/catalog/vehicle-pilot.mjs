import { pathToFileURL } from "node:url";

const source = {
  id: "eea-co2-cars-2023-final-v28",
  publisher: "European Environment Agency (EEA)",
  rightsHolder: "Directorate-General for Climate Action (DG CLIMA)",
  dataset: "Monitoring of CO2 emissions from passenger cars, 2023 - Final",
  url: "https://sdi.eea.europa.eu/catalogue/srv/api/records/87fd2bce-6ad5-46d8-af41-f27cfd2e45a8",
  license: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  changes: "Selected Swedish records and normalized model names and powertrain classifications.",
};

const candidates = [
  { id: "bmw-330e", model: "330e", sourceName: "330E", fuelType: "petrol/electric", fuelMode: "P", powertrain: "PHEV" },
  { id: "bmw-i4-edrive40", model: "i4 eDrive40", sourceName: "I4 EDRIVE40", fuelType: "electric", fuelMode: "E", powertrain: "BEV" },
];

export function eeaPilotSourceUrls() {
  return candidates.map(({ sourceName, fuelMode }) => {
    const url = new URL("https://discodata.eea.europa.eu/sql");
    const query = "SELECT TOP 1 [MS],[Mk],[Cn],[Ft],[Fm],[Year],[Status],[Version_file] " +
      "FROM [CO2Emission].[latest].[co2cars_2023Fv28] " +
      "WHERE [Year]=2023 AND [Status]='F' AND [MS]='SE' AND [Mk]='BMW' " +
      `AND [Cn]='${sourceName}' AND [Fm]='${fuelMode}'`;
    url.search = new URLSearchParams({ query, p: 1, nrOfHits: 1 });
    return url.href;
  });
}

export function normalizeEeaPilotCatalog(responses) {
  if (!Array.isArray(responses) || responses.length !== candidates.length) {
    throw new Error("Expected one EEA response per pilot model");
  }
  const sourceUrls = eeaPilotSourceUrls();
  const vehicles = candidates.map((candidate, index) => {
    const response = responses[index];
    const row = response?.results?.[0];
    if (response?.errors || !Array.isArray(response?.results) || response.results.length !== 1 ||
        row?.MS !== "SE" || row.Mk !== "BMW" || row.Cn !== candidate.sourceName ||
        row.Ft !== candidate.fuelType || row.Fm !== candidate.fuelMode ||
        row.Year !== 2023 || row.Status !== "F" || row.Version_file !== "v28") {
      throw new Error(`Invalid or missing EEA source row for ${candidate.id}`);
    }
    return {
      id: candidate.id,
      make: "BMW",
      model: candidate.model,
      powertrain: candidate.powertrain,
      registeredIn: row.MS,
      registrationYear: row.Year,
      source: { id: source.id, modelName: row.Cn, queryUrl: sourceUrls[index] },
    };
  });
  return { schemaVersion: 1, source, vehicles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const responses = await Promise.all(eeaPilotSourceUrls().map(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`EEA returned HTTP ${response.status}`);
      return response.json();
    }));
    process.stdout.write(`${JSON.stringify(normalizeEeaPilotCatalog(responses), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
