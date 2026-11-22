import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { eeaPilotSourceUrls, normalizeEeaPilotCatalog } from "../scripts/catalog/vehicle-pilot.mjs";

function sourceResponses() {
  const common = { MS: "SE", Mk: "BMW", Year: 2023, Status: "F", Version_file: "v28" };
  return [
    { results: [{ ...common, Cn: "330E", Ft: "petrol/electric", Fm: "P" }] },
    { results: [{ ...common, Cn: "I4 EDRIVE40", Ft: "electric", Fm: "E" }] },
  ];
}

test("normalizes the Swedish registration records and reproduces the licensed snapshot", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../docs/progress/vehicle-pilot.catalog.json", import.meta.url), "utf8"));
  const input = sourceResponses();
  input[0].results[0].ID = "not-for-export";
  const catalog = normalizeEeaPilotCatalog(input);
  assert.deepEqual(catalog, snapshot);
  assert.equal(catalog.source.license, "CC-BY-4.0");
  assert.deepEqual(catalog.vehicles.map(({ model, powertrain, registrationYear }) => [model, powertrain, registrationYear]), [
    ["330e", "PHEV", 2023],
    ["i4 eDrive40", "BEV", 2023],
  ]);
  for (const vehicle of catalog.vehicles) {
    for (const field of ["modelYear", "batteryCapacity", "chargingPower", "providerCapability", "ID"]) {
      assert.equal(Object.hasOwn(vehicle, field), false);
    }
  }
});

test("uses exact model matches and queries only catalog fields", () => {
  const queries = eeaPilotSourceUrls().map(rawUrl => {
    const url = new URL(rawUrl);
    assert.equal(url.origin, "https://discodata.eea.europa.eu");
    assert.equal(url.searchParams.get("nrOfHits"), "1");
    return url.searchParams.get("query");
  });
  assert.match(queries[0], /SELECT TOP 1 \[MS\],\[Mk\],\[Cn\],\[Ft\],\[Fm\],\[Year\],\[Status\],\[Version_file\]/);
  assert.match(queries[0], /\[Cn\]='330E' AND \[Fm\]='P'$/);
  assert.match(queries[1], /\[Cn\]='I4 EDRIVE40' AND \[Fm\]='E'$/);
});

test("rejects missing, ambiguous, mismatched, and provisional data without a partial catalog", () => {
  for (const change of [
    { MS: "US" }, { Cn: "330E XDRIVE" }, { Fm: "E" }, { Ft: "electric" },
    { Year: 2022 }, { Status: "P" }, { Version_file: "v27" },
  ]) {
    const input = sourceResponses();
    Object.assign(input[0].results[0], change);
    assert.throws(() => normalizeEeaPilotCatalog(input), /bmw-330e/);
  }
  assert.throws(() => normalizeEeaPilotCatalog([sourceResponses()[0]]), /one EEA response/);
  for (const rejected of [
    { results: [] },
    { results: [sourceResponses()[1].results[0], sourceResponses()[1].results[0]] },
    { errors: [{ error: "provider error" }] },
    { results: { 0: sourceResponses()[1].results[0], length: 1 } },
  ]) {
    assert.throws(() => normalizeEeaPilotCatalog([sourceResponses()[0], rejected]), /bmw-i4-edrive40/);
  }
});
