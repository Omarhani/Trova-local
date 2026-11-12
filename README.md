# Trova-local

The test project of the local Trova account (Test on this computer), kept apart from Trova's own source - the way a
client keeps its tests. Trova reads it through Settings - Workspace - Code repository.

| Folder | What is in it |
|---|---|
| `automation-ts/` | the TypeScript tests (Playwright for web, Appium for phones, API calls) |
| `src/`, `pom.xml` | the Java test framework (pages, screens, API client, Trova's helpers) |
| `suiteFiles/` | the suites Trova runs (`ts/` names TS specs) |
| `bugcycle/`, `testingActivity/`, `jenkins/` | suite -> bug -> retest cycle, story reader, CI pages |
| `tools/` | `suite-check.js` (every suite class exists), `wait-check.js` (no bare sleeps) |

Test logins and test data come from Trova's Test Data, never from files here. Nothing secret is committed.
