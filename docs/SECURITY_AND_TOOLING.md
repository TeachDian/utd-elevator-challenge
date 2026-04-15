# Security And Tooling Notes

## Why I Updated The Tooling First

Before I started the actual challenge, I checked the project setup and saw that the repo was using older test dependencies. After running `npm install`, `npm audit` showed a lot of vulnerabilities, including critical ones from the old Babel-based setup.

Because of that, I decided to clean up the tooling first so I could work on the challenge in a safer and more stable setup.

## What The Main Problems Were

- The repo was using old Babel packages that are no longer recommended.
- Those old packages were pulling in other vulnerable packages behind the scenes.
- The project also had a `server` script that pointed to a folder that does not exist in this repo.
- Since this repo already uses `"type": "module"`, Babel was not really needed for the current Node version.

## What I Changed

- I removed `.babelrc`.
- I removed the old Babel-related packages from `package.json`.
- I removed `nodemon` and the broken `server` script.
- I switched the tests to Node's built-in test runner instead of extra third-party test tools.
- I updated the test file to use native ES modules.
- I set the project to use a modern Node version with `"engines": { "node": ">=20" }`.

## Why I Used Node's Built-In Test Runner

At first, I replaced Babel with a newer test setup, but `npm audit` still showed a few remaining issues from the test dependencies themselves.

Since this repo only needs a simple local test runner, the cleanest option was to use the built-in `node:test` module that already comes with Node. That let me remove extra dependency risk completely.

In simple terms, this made the project lighter and safer:

- no Babel
- no Mocha
- no Chai
- no broken server setup
- fewer moving parts overall

## How I Run The Project Now

1. I run `npm install`.
2. I run `npm test`.
3. I work on `elevator.js` and `person.js`.
4. I rerun `npm test` as I complete each level.

## Scope Note

This tooling cleanup does not mean the challenge itself is finished. It only means I cleaned up the project setup first so I could continue safely.

The elevator logic is still intentionally incomplete because this repo is the challenge itself.
