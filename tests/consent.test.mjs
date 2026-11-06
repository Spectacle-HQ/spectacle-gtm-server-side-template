import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadScript, runTemplate } from "./run-template.mjs";
import { cookies, scenarios } from "./scenarios.mjs";

const script = loadScript();
// Recorded from the template before it read consent (d6f772e), with these
// scenarios and cookies.
const before = JSON.parse(
    readFileSync(new URL("./fixtures/before-consent.json", import.meta.url), "utf8"),
);

// Where a hit carries its consent state. Google's tag puts gcs on the
// request's query string; the GA4 client may copy it to the event data.
const fromQuery = (gcs) => ({ query: { gcs } });
const fromEventData = (gcs) => ({ eventData: { "x-ga-gcs": gcs } });
const fromStape = (granted) => ({ eventData: { consent_state: { analytics_storage: granted } } });

function run(name, { data = {}, eventData = {}, query = {} } = {}) {
    const scenario = scenarios[name];
    return runTemplate(script, {
        data: { ...scenario.data, ...data },
        eventData: { ...scenario.eventData, ...eventData },
        cookies,
        query,
    });
}

const nothing = { cookieReads: [], cookieWrites: [], sent: [], outcome: "success" };

const denied = {
    "G100 on the request": fromQuery("G100"),
    "G110 on the request": fromQuery("G110"),
    "G1-0 on the request": fromQuery("G1-0"),
    "G100 in the event data": fromEventData("G100"),
    "G110 in the event data": fromEventData("G110"),
    "Stape's consent_state": fromStape(false),
};

for (const [label, signal] of Object.entries(denied)) {
    for (const name of Object.keys(scenarios)) {
        test(`${name}: denied by ${label} reads, sets and sends nothing`, async () => {
            assert.deepEqual(await run(name, signal), nothing);
        });
    }
}

const unchanged = {
    "no consent state": {},
    "G101 on the request": fromQuery("G101"),
    "G111 on the request": fromQuery("G111"),
    "G101 in the event data": fromEventData("G101"),
    "G111 in the event data": fromEventData("G111"),
    "Stape's consent_state granted": fromStape(true),
    "analytics_storage not set (G1--)": fromQuery("G1--"),
    "analytics_storage not set (G11-)": fromEventData("G11-"),
    "a malformed G1x0": fromQuery("G1x0"),
    "a malformed G10": fromQuery("G10"),
    "a malformed G1000": fromQuery("G1000"),
    "a malformed g100": fromQuery("g100"),
    "a number": fromEventData(100),
};

for (const [label, signal] of Object.entries(unchanged)) {
    for (const name of Object.keys(scenarios)) {
        test(`${name}: ${label} behaves as before`, async () => {
            assert.deepEqual(await run(name, signal), before[name]);
        });
    }
}

test("a tag set to respect consent explicitly is denied the same way", async () => {
    const record = await run("page", { data: { analyticsStorageConsent: "required" }, ...fromQuery("G100") });
    assert.deepEqual(record, nothing);
});

test("a tag set to send data always ignores a denial", async () => {
    for (const name of Object.keys(scenarios)) {
        const record = await run(name, { data: { analyticsStorageConsent: "optional" }, ...fromQuery("G100") });
        assert.deepEqual(record, before[name], name);
    }
});

test("a server event whose visitor denied consent is not sent", async () => {
    const record = await run("purchase", {
        data: { eventSource: "server", serverAnonymousId: "anon-1" },
        ...fromEventData("G100"),
    });
    assert.deepEqual(record, nothing);
});
