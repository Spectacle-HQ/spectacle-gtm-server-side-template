# Spectacle GTM Server-Side Template

Official Google Tag Manager Server-Side template for Spectacle analytics integration.

## Features
- 📊 Page tracking with custom properties
- 👤 User identification and traits
- 🎯 Custom event tracking
- 💰 Revenue tracking with transaction-id deduplication
- 🏢 Group/organization tracking
- 🔍 Spectacle Lens support
- 🍪 Anonymous id continuity, including hosts that cannot send the visitor's cookie (a Shopify custom pixel, for instance) — pass one on the event as `sp_anonymous_id`, or set it on the tag
- 🔌 Events from webhooks and other servers (Stripe, your CRM): choose "A server or webhook" as the source and map the visitor's anonymous id or user id from the payload
- 🔒 Consent aware: when a hit says the visitor denied `analytics_storage` (Google consent mode, or Stape's Data Tag), the tag sets no cookie and sends nothing. Hits without a consent state are sent as usual.
- 🐛 Debug mode for development

## Installation
1. Open your Google Tag Manager Server container
2. Go to Templates → Tag Templates
3. Click "Search Gallery"
4. Search for "Spectacle"
5. Add to workspace

## Documentation
Visit [spectaclehq.com/docs/installation/google-tag-manager-gtm](https://www.spectaclehq.com/docs/installation/google-tag-manager-gtm) for the complete setup guide.

## Development

Run `node --test tests/*.test.mjs` with Node.js 22 or later. The tests execute
the template's script with mocked GTM APIs and validate its JSON sections.
`tests/fixtures/before-consent.json` records what the template stored and sent
before it read consent; hits that are not denied must still match it.

## Support
- 📖 [Documentation](https://www.spectaclehq.com/docs/installation/google-tag-manager-gtm)
- 🐛 [Issues](https://github.com/Spectacle-HQ/spectacle-gtm-server-side-template/issues)
- 💬 [Discussions](https://github.com/Spectacle-HQ/spectacle-gtm-server-side-template/discussions)

## License
Apache 2.0 — see the [LICENSE](LICENSE) file for details.
