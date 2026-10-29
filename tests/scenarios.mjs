// One hit per method, with a returning visitor's cookies, a purchase the
// visitor's dedup cookie has not seen yet, and an email to identify.
export const cookies = {
    sp__anon_id: "anon-from-cookie",
    sp__user_id: "user-from-cookie",
    sp__transaction_ids: "order-0",
};

const eventData = {
    page_location: "https://example.com/pricing?utm_source=google&utm_medium=cpc#plans",
    page_referrer: "https://www.google.com/",
    page_title: "Pricing",
    user_agent: "Mozilla/5.0",
    language: "nl-NL",
    screen_resolution: "1440x900",
    timezone: "Europe/Amsterdam",
};

const tag = {
    workspaceId: "ws_1",
    baseUrl: "https://t.spectaclehq.com",
    cookieDomain: "example.com",
    lensEnabled: true,
};

export const scenarios = {
    page: { data: { ...tag, methodType: "page" }, eventData },
    identify: {
        data: { ...tag, methodType: "identify" },
        eventData: {
            ...eventData,
            "user_data.email_address": "jane@example.com",
            "user_data.first_name": "Jane",
        },
    },
    purchase: {
        data: { ...tag, methodType: "track", useGA4EcomData: true },
        eventData: {
            ...eventData,
            event_name: "purchase",
            transaction_id: "order-1",
            value: 49.5,
            currency: "EUR",
        },
    },
    group: {
        data: { ...tag, methodType: "group", groupId: "acme" },
        eventData,
    },
};
