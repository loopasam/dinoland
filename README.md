# Dinoland

A gentle browser toy where a young child places, hatches, and cares for a growing herd of slowly roaming baby triceratops in a bounded, single-screen field. Every dinosaur has its own repeating bath and play needs, while each four-heart round unlocks another draggable egg.

## Play

The GitHub Pages build is deployed from `main` after tests pass:

<https://loopasam.github.io/dinoland/>

If the link returns 404 after the first push, open the repository’s **Settings → Pages**, set **Source** to **GitHub Actions**, and rerun the `Test and deploy to GitHub Pages` workflow.

## Local development

```bash
npm install
npm run dev
```

Production verification:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Documentation

- [First prototype plan](docs/first-prototype-plan.md)
- [Art guide](docs/art-guide.md)
- [Playtest guide](docs/playtest-guide.md)
