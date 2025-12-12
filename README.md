# Atom

Atom is a modern, self-hosted dashboard and monitoring tool designed for simplicity and performance. It features a sleek UI, Docker integration, and a flexible widget system.

![Atom Dashboard](https://raw.githubusercontent.com/yourusername/atom/main/public/screenshot.png)

## Features

*   **Service Monitoring:** Track the status of your applications and bookmarks with visual indicators (ping/HTTP).
*   **System Stats:** Real-time CPU, Memory, and Storage usage.
*   **Docker Integration:** Monitor container counts and status directly from the dashboard.
*   **Widgets:**
    *   **Generic Widget:** Connect to any JSON API.
    *   **Presets:** Pre-configured templates for Sonarr, Radarr, Pi-hole, Glances, Tautulli, and more.
*   **Customizable:** Drag-and-drop ordering (coming soon), themes, and configurable layouts.
*   **Secure:** Built-in authentication.

## Tech Stack

*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** CSS Modules with minimal utility classes
*   **Icons:** [Lucide React](https://lucide.dev/) & [Simple Icons](https://simpleicons.org/)
*   **Validation:** Zod
*   **Testing:** Jest & React Testing Library

## Getting Started

### Prerequisites
 
*   Node.js 18+
*   Docker (optional, for Docker widget support)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/atom.git
    cd atom
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) with your browser.

## Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up -d --build
```

Access the dashboard at `http://localhost:3000`.

## Configuration

Configuration is stored in `data/config.json`. You can edit this file directly or use the in-app Settings menu.

## License

[MIT](LICENSE)
