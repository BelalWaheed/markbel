# Markbel

Markbel is a fast, simple, and beautiful bookmark manager. Save your favorite links, organize them easily, and access them anywhere. 

Markbel is available everywhere you work:
- **Web App**: Access from any browser.
- **Desktop App**: A standalone app for your computer workspace.
- **Android App**: Save links on the go and share directly from your mobile browser.

## ✨ Features

- **Instant Saving**: Just paste a URL, and Markbel automatically fetches the title, description, and image in the background.
- **Syncs Everywhere**: Your bookmarks are synced across all your devices, and even work offline!
- **TickTick Integration**: Optionally sync your saved links as tasks straight to your TickTick account.
- **Beautiful Design**: A clean, light theme designed for focus and productivity.
- **Quick Organization**: Pin important links, archive old ones, and organize by custom colored groups.

---

## 🛠️ Getting Started (For Developers)

Markbel is built as a modern monorepo containing our web, desktop, mobile, and backend code all in one place.

### Prerequisites
- Node.js
- MongoDB (running locally or via cloud)

### Running Locally
1. Install dependencies from the root folder:
   ```bash
   npm install
   ```
2. Start the development servers using the built-in scripts (we recommend running these in separate terminal windows):
   ```bash
   npm run dev:backend   # Starts the Express API
   npm run dev:web       # Starts the Vite Web App
   npm run dev:desktop   # Starts the Desktop App
   npm run dev:mobile    # Starts the Expo Mobile App
   ```

---
*Built with ❤️ as part of the Obel family.*
