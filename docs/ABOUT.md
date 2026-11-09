# About Wormage

> A turn-based artillery game for the browser, built in the open by one developer.
> **Demo build.** This is the first playable version of Wormage. Campaign, progression and online play are on the [roadmap](ROADMAP.md).

## The developer

Wormage is designed and built by **Fabio Ritzel Borges** — Fabio Borges — a full-stack web developer and AI engineer based in Joinville, Brazil.

For more than ten years he has shipped frontend, backend, testing, DevOps and AI systems for companies in the US, Europe and Brazil. Wormage is where those trades meet: a simulation that has to be correct, a frontend that has to feel fast, a backend that has to own the result, and a test suite that has to prove it.

- [flabs.tech](https://flabs.tech)
- [github.com/fworks-tech](https://github.com/fworks-tech)
- [linkedin.com/in/fabiorborges](https://www.linkedin.com/in/fabiorborges)

## One developer, no hand-offs

There is no team behind Wormage. One person decides the architecture, writes the engine, draws the worms, tunes the AI and ships the deploy. That is a constraint, and it is also the point: every line exists because someone can explain why.

The project is built in the open. The [roadmap](ROADMAP.md), the [decision records](adr/README.md), the issues and the pull requests are all public. The repository is the making-of.

## What you can play today

The live build is a **complete skirmish**, not a teaser: two teams of three worms, a destructible island, wind that bends every shot, four weapons, and an AI that solves the same ballistics you do.

Around the match there is a real product surface: menus, options, a ranking board, match history, mobile controls and a seeded, browser-driven test suite.

It is also a **first version**. There are no accounts, no campaign and no online play yet. Match data lives in your browser. The game you can play today is the foundation the real Wormage is being built on.

## What the real Wormage will be

The name is Worm + mage, and Worm + age: a battlefield that grows into an RPG.

- **A campaign** — authored missions with objectives and bosses, not just skirmishes.
- **Progression** — XP, levels and unlocks that change how the game opens up.
- **Online play** — hotseat first, then challenge links, then server-authoritative matches with replays.
- **A real backend** — AWS, accounts and persistent records, with the server owning the result.
- **Every screen** — an installable PWA with touch parity, not a desktop demo with a mobile afterthought.

The plan is staged on purpose: make the simulation reproducible, turn content into data, stand up the backend, then build the campaign on top. The [roadmap](ROADMAP.md) has the details.

## Why the long game

Artillery is a small ruleset with a deep engineering cost. Destructible terrain, ballistics, wind, turn state and an AI that plans are hard enough to be interesting, and small enough that one developer can take them all the way.

Wormage is not a weekend prototype. It is a game being built one issue at a time, in public, with the boring parts done properly: types, tests, CI, deployment and decision records.

If that sounds like your kind of project, follow along.

## Follow

- Play: [wormage.flabs.tech](https://wormage.flabs.tech)
- Code: [github.com/fworks-tech/wormage](https://github.com/fworks-tech/wormage)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Developer: [flabs.tech](https://flabs.tech)
