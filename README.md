# Elqira

Elqira is a scenario-first web application for developers who want to understand API behavior, not just execute HTTP calls.

The product is built around a simple model:

`Project -> Scenario -> Request -> Response`

The focus is on grouping requests into meaningful scenarios, reading responses clearly, and analyzing API behavior in context.

## Core Principles

- scenario-centric, not request-centric
- core product must work without AI
- Smart features are optional and contextual
- clarity and usability over feature sprawl

## Current Features

- project creation, editing, deletion, and switching
- scenario creation, editing, deletion, and selection
- request creation, editing, deletion, and execution
- request builder with method, URL, headers, query params, body, and notes
- response preview, raw view, headers view, and copy support
- local persistence through a storage abstraction backed by `localStorage`
- JSON workspace import/export
- English and Italian UI

### Smart Features

Smart mode is optional and currently includes:

- Explain Response
- Debug Assistant
- Smart Compare
- Scenario Health

If Smart analysis is unavailable, Elqira falls back to local analysis and marks the result as `OFFLINE`.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4

## Development

Requirements:

- Node.js `22.12.0`
- npm

Install dependencies:

```bash
nvm use
npm install
```

Start the dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview production build:

```bash
npm run preview
```

## Implementation Notes

- HTTP requests are executed in the browser with `fetch`
- browser limitations such as CORS still apply
- app settings are persisted locally
- Smart API keys are stored in memory only and are lost on refresh
- current Smart runtime support is implemented for OpenAI and Google/Gemini

## License

This project is licensed under the [Apache License 2.0](./LICENSE).
