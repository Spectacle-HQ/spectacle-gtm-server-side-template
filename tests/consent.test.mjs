import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadScript, runTemplate } from "./run-template.mjs";
import { cookies, scenarios } from "./scenarios.mjs";

const script = loadScript();

// What the template did for each scenario before it knew about consent,
// recorded from the commit before this change. Cookie reads and writes and the
// request bodies, byte for byte.
const before = JSON.parse(
    readFileSync(new URL("./fixtures/before-consent.json", import.meta.url), "utf8"),
);

async function run(name, gcs) {
    const scenario = scenarios[name];
    const eventData =
        gcs === undefined ? scenario.eventData : { ...scenario.eventData, "x-ga-gcs": gcs };
    const record = await runTemplate(script, { ...scenario, eventData, cookies });
    return {
        ...record,
        sent: record.sent.map(({ url, options, body }) => ({
            url,
            headers: options.headers,
            body,
        })),
    };
}

const unchanged = {
    "no consent information": undefined,
    "both granted (G111)": "G111",
    "analytics granted, ads denied (G101)": "G101",
    "analytics_storage not set (G1--)": "G1--",
    "a malformed gcs (G1x0)": "G1x0",
    "a malformed gcs (G10)": "G10",
    "a malformed gcs (G1000)": "G1000",
    "a malformed gcs (g100)": "g100",
    "a gcs that is not a string": 100,
};

for (const [label, gcs] of Object.entries(unchanged)) {
    for (const name of Object.keys(scenarios)) {
        test(`${label}: ${name} reads, writes and sends exactly what it did before`, async () => {
            assert.deepEqual(await run(name, gcs), before[name]);
        });
    }
}

const denied = ["G100", "G110", "G1-0"];

for (const gcs of denied) {
    for (const name of ["page", "purchase", "group"]) {
        test(`analytics_storage denied (${gcs}): ${name} is sent without a cookie, flagged`, async () => {
            const result = await run(name, gcs);
            assert.deepEqual(result.cookieReads, []);
            assert.deepEqual(result.cookieWrites, []);
            assert.equal(result.outcome, "success");
            assert.equal(result.sent.length, 1);

            const payload = JSON.parse(result.sent[0].body);
            const expected = JSON.parse(before[name].sent[0].body);
            assert.equal(payload.analyticsStorage, "denied");
            // A per-hit id, not the cookie's
            assert.notEqual(payload.anonymousId, cookies.sp__anon_id);
            assert.match(payload.anonymousId, /^\d{8}-\d{4}-\d{4}-\d{4}-\d{12}$/);
            // The stored user id is a cookie too
            assert.equal(payload.userId, null);
            // Everything else is the granted payload
            delete payload.analyticsStorage;
            delete payload.anonymousId;
            delete payload.userId;
            delete expected.anonymousId;
            delete expected.userId;
            assert.deepEqual(payload, expected);
        });
    }

    test(`analytics_storage denied (${gcs}): identify is not sent and nothing is stored`, async () => {
        const result = await run("identify", gcs);
        assert.deepEqual(result.cookieReads, []);
        assert.deepEqual(result.cookieWrites, []);
        assert.deepEqual(result.sent, []);
        assert.equal(result.outcome, "success");
    });
}

test("analytics_storage denied: a user_id on the event is still sent, as GA4 does", async () => {
    const scenario = scenarios.page;
    const result = await runTemplate(script, {
        ...scenario,
        eventData: { ...scenario.eventData, "x-ga-gcs": "G100", user_id: "u_42" },
        cookies,
    });
    assert.equal(JSON.parse(result.sent[0].body).userId, "u_42");
});

test("analytics_storage denied: a supplied anonymous id is not used either", async () => {
    const scenario = scenarios.page;
    const result = await runTemplate(script, {
        ...scenario,
        eventData: {
            ...scenario.eventData,
            "x-ga-gcs": "G100",
            sp_anonymous_id: "anon-from-shopify",
        },
        cookies,
    });
    assert.notEqual(JSON.parse(result.sent[0].body).anonymousId, "anon-from-shopify");
});

test("analytics_storage denied: a purchase the dedup cookie has seen is still sent", async () => {
    const scenario = scenarios.purchase;
    const result = await runTemplate(script, {
        ...scenario,
        eventData: { ...scenario.eventData, "x-ga-gcs": "G100" },
        cookies: { ...cookies, sp__transaction_ids: "order-1" },
    });
    assert.equal(result.sent.length, 1);
    assert.equal(JSON.parse(result.sent[0].body).properties.transactionId, "order-1");
});

test("a server event ignores x-ga-gcs", async () => {
    const result = await runTemplate(script, {
        data: {
            workspaceId: "ws_1",
            methodType: "page",
            eventSource: "server",
            serverAnonymousId: "anon-from-webhook",
        },
        eventData: { "x-ga-gcs": "G100" },
    });
    const payload = JSON.parse(result.sent[0].body);
    assert.equal(payload.anonymousId, "anon-from-webhook");
    assert.equal(payload.analyticsStorage, undefined);
});
