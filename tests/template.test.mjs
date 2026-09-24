import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Execute the shipped track handler with GTM APIs stubbed; no network or browser.
const source = readFileSync(
    new URL(
        "../template.tpl",
        import.meta.url,
    ),
    "utf8",
);
const start = source.indexOf("function handleTrack()");
const handler = source.slice(start, source.indexOf("\n/**", start));

test("template metadata, parameters and permissions are valid JSON", () => {
    for (const section of ["INFO", "TEMPLATE_PARAMETERS", "SERVER_PERMISSIONS"]) {
        const json = source.split(`___${section}___`)[1]?.split(/^___/m)[0];
        assert.ok(json, `Missing ${section} section`);
        assert.doesNotThrow(() => JSON.parse(json), section);
    }
});

function track(
    eventName,
    eventData,
    {
        ecommerce = true,
        seen = new Set(),
        properties = [],
        serverEvent = false,
    } = {},
) {
    const sent = [];
    let completed = 0;
    const run = new Function(
        "data",
        "buildBasePayload",
        "getEventData",
        "makeNumber",
        "hasTransactionId",
        "storeTransactionId",
        "getType",
        "sendToSpectacle",
        "logToConsole",
        "IS_SERVER_EVENT",
        `${handler}\nreturn handleTrack();`,
    );
    run(
        {
            eventName,
            useGA4EcomData: ecommerce,
            eventProperties: properties,
            gtmOnSuccess: () => completed++,
            gtmOnFailure: () => assert.fail("Unexpected failure"),
        },
        () => ({}),
        (key) => eventData[key],
        Number,
        (id) => seen.has(id),
        (id) => seen.add(id),
        (value) => (Array.isArray(value) ? "array" : typeof value),
        (url, payload) => {
            sent.push({ url, payload });
            completed++;
        },
        () => {},
        serverEvent,
    );
    return { sent, completed };
}

test("purchase keeps currency alongside revenue", () => {
    const result = track("purchase", {
        transaction_id: "order1",
        value: 12.99,
        currency: "EUR",
    });
    assert.equal(result.sent[0].payload.properties.currency, "EUR");
    assert.equal(result.sent[0].payload.properties.revenue, "1299");
});

test("refunds, including partial refunds, are not deduplicated by order id", () => {
    const seen = new Set();
    track(
        "purchase",
        { transaction_id: "order1", value: 20, currency: "EUR" },
        { seen },
    );
    for (const amount of [5, 3]) {
        const result = track(
            "refund",
            { transaction_id: "order1", value: amount, currency: "EUR" },
            { seen },
        );
        assert.equal(result.sent.length, 1);
        assert.equal(
            result.sent[0].payload.properties.revenue,
            String(-amount * 100),
        );
        assert.equal(result.completed, 1);
    }
});

test("duplicate purchase completes successfully without a second send", () => {
    const result = track(
        "purchase",
        { transaction_id: "order1" },
        { seen: new Set(["order1"]) },
    );
    assert.equal(result.sent.length, 0);
    assert.equal(result.completed, 1);
});

test("server purchases leave de-duplication to the transaction id", () => {
    const seen = new Set(["order1"]);
    const result = track(
        "purchase",
        { transaction_id: "order1", value: 20, currency: "EUR" },
        { seen, serverEvent: true },
    );
    assert.equal(result.sent.length, 1);
    assert.equal(result.sent[0].payload.properties.transactionId, "order1");
    assert.equal(result.completed, 1);
});

test("custom properties retain zero and false values", () => {
    const result = track(
        "generate_lead",
        {},
        {
            ecommerce: false,
            properties: [
                { key: "campaign", value: "spring" },
                { key: "value", value: 0 },
                { key: "qualified", value: false },
            ],
        },
    );
    assert.deepEqual(result.sent[0].payload.properties, {
        campaign: "spring",
        value: 0,
        qualified: false,
    });
});
