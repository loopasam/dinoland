# Dinoland

A browser prototype for placing, hatching, and caring for a growing herd of independently managed dinosaurs in a bounded, single-screen field. The current build deliberately uses labeled placeholder geometry and visible collision shapes so the interaction model can be tested before final art is introduced.

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
