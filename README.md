# Elqira

Elqira is a scenario-first tool for exploring and understanding API behavior.

Instead of treating each HTTP call as an isolated action, Elqira helps you organize your work around scenarios: meaningful groups of requests that represent a real use case, such as authentication, onboarding, or profile updates. The goal is not simply to send requests, but to make responses easier to read, compare, and reason about in context.

At the center of the experience is a simple structure:

`Project -> Scenario -> Request -> Response`

This makes it easier to move from a broad area of work to a specific API call while keeping the surrounding context visible.

![Elqira home screen](./public/screens/v1.0.0/Home.PNG)

## What You Can Do With Elqira

With Elqira you can create projects, organize scenarios inside them, and build requests with method, URL, headers, query parameters, body, and notes. Once a request is executed, the response can be inspected in a readable way, copied, and used as the basis for further analysis.

The application is designed so that the core experience works on its own, without requiring AI features. Local persistence is built in, workspace data can be imported or exported as JSON, and the interface currently supports both English and Italian.

At the moment, local persistence is based on `localStorage`. This is a temporary choice tied to the current development phase of the project, not the intended long-term storage strategy.

## Smart Features

Elqira also includes an optional Smart layer for contextual analysis. When configured, it can help explain a response, assist with debugging, compare a current response with a saved baseline, and generate a scenario health view across executed requests.

These features are enhancements, not dependencies. If Smart analysis is unavailable, Elqira falls back to local analysis and clearly marks the result as `OFFLINE`.

## Running the Project Locally

If you want to run Elqira locally, use Node.js `22.12.0`.

Install dependencies with:

```bash
nvm use
npm install
```

Start the development server with:

```bash
npm run dev
```

To build the project:

```bash
npm run build
```

To run the linter:

```bash
npm run lint
```

To preview the production build locally:

```bash
npm run preview
```

## Notes

Requests are executed directly in the browser, so standard browser constraints still apply, including CORS. Application settings and workspace data are stored locally. Smart API keys are kept in memory only and are lost on refresh.

## Feature Requests

If you want to suggest a feature or propose an improvement, please open an issue in this repository.

## Security

If you discover a security vulnerability, do not open a public issue. Report it privately by email at `tommasosacramone.box@gmail.com`.

## License

This project is licensed under the [Apache License 2.0](./LICENSE).
