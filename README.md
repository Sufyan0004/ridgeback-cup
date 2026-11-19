# The Ridgeback Cup

SOFE 4850U (Fall 2026), Group 6. A mobile-first website where an animated barista, **Hunter**,
takes a pickup coffee order by voice or typed text.

See **[CONTEXT.md](CONTEXT.md)** for the plan, roles, menu and design decisions.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run lint
```

Voice input needs HTTPS (or localhost) and works best in Chrome on Android or desktop.

## Code layout

```
src/
  engine/       Role 1: conversation engine (types.ts is the shared contract)
  lib/          engine.ts picks the engine; fakeEngine.ts is a temporary stand-in; ui.ts holds UI types/helpers
  components/   Role 2 UI (+ Role 3's Hunter avatar)
  App.tsx       wires user actions → engine → transcript, ticket, Hunter
```
