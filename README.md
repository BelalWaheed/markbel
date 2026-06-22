# Markbel — Understated Bookmarks Vault

Markbel is a standalone, high-performance, and beautifully restyled **Cyberpunk Neon-on-Dark** bookmarks app designed as a companion to the Obel productivity suite. It features a streamlined monorepo architecture: an Express REST API backend, a Vite + React + TypeScript frontend, and an Expo mobile wrapper.

---

## 1. Architectural Overview & Directories

```
markbel/
├── package.json           # Root package defining workspace workspaces
│
├── backend/               # Express REST API (port 3001)
│   ├── src/
│   │   ├── db.ts          # Mongoose connection pooling helper
│   │   ├── middleware/    # Auth token validators (JWT)
│   │   ├── models/        # MongoDB Schemas (User, Bookmark)
│   │   └── server.ts      # Express route handlers & background metadata scraping
│   └── .env               # Database connection strings & JWT secrets
│
├── frontend/              # Vite React SPA (port 5173, proxying /api to 3001)
│   ├── src/
│   │   ├── lib/           # Auth provider and API client helper
│   │   ├── views/         # LoginPage, BookmarksPage, ShareTargetPage
│   │   ├── App.tsx        # App routing & context bindings
│   │   └── index.css      # Cyberpunk design system & styling rules
│   └── vite.config.ts     # Dev proxy configuration
│
└── mobile/                # Expo React Native App (for iOS / Android)
    ├── App.tsx            # WebView container with share intent listener
    └── app.json           # Native package descriptors & intent hooks
```

---

## 2. Core Functional Design & Data Flow

### A. Asynchronous Metadata Scraping
When adding a new link, speed is critical. Rather than forcing the user to wait for slow page fetches or API crawls, Markbel uses an **Asynchronous Scraping Protocol**:
1. **Instant Submission**: When the user enters a URL in the modal (or shares it from a mobile browser) and clicks `Create`, the frontend submits a POST request to `/api/bookmarks`.
2. **Immediate 201 Response**: The server writes a placeholder document immediately using the URL's hostname as the temporary title, returns a successful `201 Created` status, and closes the modal on the frontend immediately.
3. **Background Crawl (IIFE)**: In the background, the server launches an asynchronous Immediately Invoked Function Expression (IIFE). This worker scrapes the page's HTML, extracts metadata (via OpenGraph tags `og:title`/`og:image`/`og:description` or Twitter cards), processes YouTube video IDs to get high-quality thumbnail images (`https://img.youtube.com/vi/<video_id>/hqdefault.jpg`), and writes the enriched data to MongoDB once resolved.
4. **UI Automatic Updates**: The frontend schedules a delayed refresh (`setTimeout` at 3 seconds and 6 seconds) to reload the bookmark catalog, resulting in a smooth, automatic update of page details without locking the UI.

### B. Onboarding & How-to-Use Guide
For first-time users or when the vault contains zero bookmarks:
- The dashboard replaces the folder layout with a prominent **Onboarding Guide**.
- It highlights that **only the URL is required** to add a bookmark—Markbel will handle titles, descriptions, and thumbnails in the background.
- It guides the user on how custom colors and folders work, and how they can save links from mobile devices.

### C. Folder Group Customization
Users can organize bookmarks into custom Vault Groups.
- Group creation forms (both on the dashboard and share sheet) display a **Custom Color Selection Strip** (Cyan, Pink, Green, Yellow).
- Chosen color styles are saved in `localStorage` under `markbel_group_colors`.
- Color preferences persist across sessions in the client's browser without requiring complex changes to the database schemas.

### D. Whole-Card Interactivity
To make the application fast and easy to navigate:
- The **entire bookmark card acts as a link** to the stored URL, opening in a new tab upon click.
- **Edit Relocation**: The `Edit` action has been moved from the hover state (which was invisible on mobile screens) directly to the card's bottom actions footer, replacing the redundant "Visit" button.
- **Bubbling Prevention**: Clicking on action buttons inside the card (Copy, Edit, Delete) intercepts event bubbling via `e.stopPropagation()` and `e.preventDefault()`, ensuring that clicking them fires their specific action instead of opening the link.

---

## 3. Quick Start (Running Locally)

### 1. Database Configuration
By default, Markbel connects to a local MongoDB server at:
`mongodb://127.0.0.1:27017/markbel`

You can change this connection string or credentials in the environment variables file: [backend/.env](file:///d:/dev/projects/bel_projects/markbel/backend/.env).

### 2. Run the Web & API App
Run the following command from the **root directory** (`markbel/`) to start both the Express backend and the Vite frontend simultaneously:
```bash
npm run dev
```
* Vite will run at: `http://localhost:5173`
* Express API will run at: `http://localhost:3001`
* Dev Proxy: Vite is configured to proxy all `/api/*` requests directly to port `3001`.

### 3. Run the Mobile App
Open a second terminal window, navigate to `mobile/`, and run:
```bash
cd mobile
npx expo start
```
Scan the QR code in **Expo Go** on your physical device or emulator to test.

---
Designed with care as part of the Obel family. ⚡
