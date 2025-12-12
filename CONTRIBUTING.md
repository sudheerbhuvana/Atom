# Contributing to Atom Homepage

We love your input! We want to make contributing to Atom as easy and transparent as possible, whether it's:

*   Reporting a bug
*   Discussing the current state of the code
*   Submitting a fix
*   Proposing new features

## Development Workflow

1.  **Fork the repo** and create your branch from `main`.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run the app**:
    ```bash
    npm run dev
    ```
4.  **Run tests** (we use Jest):
    ```bash
    npm test
    ```
    Please ensure all tests pass before submitting your PR.
5.  **Lint your code**:
    ```bash
    npm run lint
    ```

## Project Structure

*   `src/app`: Next.js App Router pages and API routes.
*   `src/components`: React components.
    *   `widgets/`: Dashboard widgets (Docker, System, etc.).
    *   `modals/`: Dialogs for adding/editing content.
    *   `ui/`: Reusable primitive components.
*   `src/lib`: Utility functions and server-side logic.
*   `src/types`: TypeScript definitions.

## Widget Development

To add a new widget preset:
1.  Open `src/lib/widgetPresets.ts`.
2.  Add a new `WidgetPreset` object to the `WIDGET_PRESETS` array.
3.  Define the default endpoint, fields, and suffix/format options.

## Pull Request Process

1.  Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2.  Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3.  You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.
