import { readFileSync } from "node:fs";

// Runs the template's whole sandboxed script with GTM's APIs stubbed, and
// records every cookie read, cookie write and request it makes.
export function loadScript(path = new URL("../template.tpl", import.meta.url)) {
    const source = readFileSync(path, "utf8");
    return source
        .split("___SANDBOXED_JS_FOR_SERVER___")[1]
        .split("___SERVER_PERMISSIONS___")[0];
}

function getType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function parseUrl(url) {
    try {
        const parsed = new URL(url);
        return {
            pathname: parsed.pathname,
            search: parsed.search,
            hash: parsed.hash,
            searchParams: Object.fromEntries(parsed.searchParams),
        };
    } catch {
        return undefined;
    }
}

export async function runTemplate(
    script,
    { data, eventData = {}, cookies = {} },
) {
    const record = { cookieReads: [], cookieWrites: [], sent: [], outcome: null };
    const apis = {
        sendHttpRequest: (url, options, body) => {
            record.sent.push({ url, options, body });
            return Promise.resolve({ statusCode: 200 });
        },
        JSON,
        getEventData: (key) => eventData[key],
        getAllEventData: () => eventData,
        getCookieValues: (name) => {
            record.cookieReads.push(name);
            return name in cookies ? [cookies[name]] : [];
        },
        setCookie: (name, value, options) => {
            record.cookieWrites.push({ name, value, options });
        },
        getRequestHeader: (name) => (name === "user-agent" ? "Header agent" : undefined),
        sha256Sync: () => "",
        getTimestampMillis: () => 1767225600000,
        logToConsole: () => {},
        generateRandom: (min) => min,
        parseUrl,
        getType,
        makeString: String,
        makeInteger: (value) => parseInt(value, 10),
        makeNumber: Number,
        Math,
        getRemoteAddress: () => "203.0.113.7",
    };
    let settle;
    const done = new Promise((resolve) => (settle = resolve));
    const run = new Function("require", "data", script);
    run((name) => apis[name], {
        ...data,
        gtmOnSuccess: () => settle((record.outcome = "success")),
        gtmOnFailure: () => settle((record.outcome = "failure")),
    });
    await done;
    return record;
}
