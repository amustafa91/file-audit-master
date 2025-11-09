# File Audit Master

**A professional, Windows-style desktop application for real-time file monitoring, detailed change logging, and visual reporting.**

<p align="center">
  <img src="https://github.com/amustafa91/file-audit-master/blob/main/Images/Screenshot.png" alt="Application Screenshot">
  <em>(Replace this with a real screenshot of the application)</em>
</p>

---

## ✨ Key Features

-   **Real-time File Monitoring:** Automatically tracks file creation, modification, and deletion within your project folders.
-   **Detached Background Service:** The monitoring service runs independently, capturing all changes even when the main application is closed.
-   **Detailed Change Logs:** View a comprehensive history of all file events, filterable by date, path, and author.
-   **Visual Reports & Dashboards:** Understand project activity at a glance with charts summarizing changes by type and author.
-   **In-depth Diff Viewer:** Inspect the exact content changes for any modified file with a side-by-side and intra-line diff view.
-   **Data Export:** Export filtered log data to CSV for external analysis or record-keeping.
-   **Modern Windows UI:** A clean, responsive interface designed to feel native to the Windows ecosystem.

---

## 🚀 Download & Install

You can download the latest version of File Audit Master for Windows, macOS, and Linux directly from the project's **[GitHub Releases page](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/releases)**.

On the Releases page, simply find the latest version and download the appropriate installer for your operating system (`.exe` for Windows, `.dmg` for macOS, `.AppImage` for Linux).

> **Note:** Please replace `YOUR_USERNAME/YOUR_REPOSITORY` in the link above with your actual GitHub username and repository name.

---

## 👨‍💻 Development Setup

This guide explains how to set up the File Audit Master application for local development.

### The Two-Part System

It is essential to understand that this application is split into two distinct parts that work together:

1.  **The Background Service (The "Collector"):**
    *   A lightweight Node.js script (`background-service.js`) that runs locally.
    *   Its only job is to watch for file changes in your configured project folders and write them to log files.
    *   It is managed directly by the main UI application and runs even when the UI is closed.

2.  **The UI Application (The "Viewer"):**
    *   The desktop application you interact with.
    *   Its job is to read the log files created by the Collector and display them in a user-friendly dashboard.
    *   The UI can reliably start and stop the background service on the local machine.

This architecture ensures that file changes can always be collected (as long as the service is running), even when the UI application is closed.

### Prerequisites

-   **Node.js:** Version 18.x or newer is recommended. You can download it from [nodejs.org](https://nodejs.org/).
-   **npm:** Comes bundled with Node.js.
-   **(Optional) Git:** For cloning the project repository.

### Installation

First, get the application code and install the necessary dependencies.

```bash
# 1. Clone the repository (or download and extract the source code)
git clone <repository_url>
cd file-audit-master

# 2. Install all dependencies for both the UI and the service
npm install
```

### Running in Development Mode

To run the application for development, you must run **two commands in two separate terminals**. This is required because the UI (Vite) and the application window (Electron) are separate processes.

#### 👉 Terminal 1: Start the UI Server

First, start the Vite development server. This serves your React code and provides instant updates as you make changes.

```bash
# In your first terminal, run:
npm run dev:ui
```

Wait for the terminal to show that the server is running, typically with a message like `VITE v5.x.x ready in XXXms`.

#### 👉 Terminal 2: Start the Application Window

Once the UI server is running, open a **new terminal** and run the command to launch the Electron application window.

```bash
# In your second terminal, run:
npm run dev:electron
```

The Electron window will appear and automatically load the UI from the server you started in the first terminal. You can now make changes to the frontend code (`.tsx`, `.css` files) and see them update live.

---

## 📦 Building for Production

When you are ready to distribute the application, you can bundle it into a professional installer (`.exe`, `.dmg`, etc.).

### > ⚠️ IMPORTANT: Application Icons

For the application and the final installer to have a custom icon, you **must** create icon files and place them in the correct location before building. If these files are missing, Electron Builder will use a generic, default icon.

-   **Windows:**
    -   **File:** `build/icon.ico`
    -   **Format:** `.ico`, `256x256` pixels recommended.
-   **macOS:**
    -   **File:** `build/icon.icns`
    -   **Format:** `.icns`. You can use online tools or specific software to convert a PNG to ICNS.
-   **Linux:**
    -   **File:** `build/icon.png`
    -   **Format:** `.png`, `512x512` pixels recommended.

### Build Commands

The following commands will build the frontend assets and then package them into an installer for the specified operating system. The output files will be located in the `dist` folder.

-   **To build for the current OS:**
    ```bash
    npm run package
    ```

-   **To build specifically for Windows:**
    ```bash
    npm run package:win
    ```

-   **To build specifically for macOS:**
    ```bash
    # Note: This command must be run on a macOS machine.
    npm run package:mac
    ```

-   **To build specifically for Linux:**
    ```bash
    npm run package:linux
    ```

---

## 🚢 Publishing a Release

Instead of committing large installer files to your Git repository, the best practice is to use **GitHub Releases**. This provides a dedicated space to host your compiled application files for users to download.

You can do this manually or automate it with a script.

### Method 1: Manual Release (Simple)

1.  **Build your application:** Run the appropriate packaging command for each OS you want to support.
    ```bash
    npm run package:win
    npm run package:mac
    npm run package:linux
    ```
    This will create the installers in the `dist/` directory.

2.  **Navigate to GitHub Releases:** Go to your repository on GitHub and click on the "Releases" tab on the right-hand sidebar.

3.  **Draft a new release:** Click the "Draft a new release" button.

4.  **Tag your release:** Create a new tag for your version (e.g., `v1.0.0`). This marks the specific point in your code's history that this release corresponds to.

5.  **Add release notes:** Give your release a title (e.g., `v1.0.0`) and write a description of the changes, new features, and bug fixes.

6.  **Upload installers:** Drag and drop the installer files (`.exe`, `.dmg`, `.AppImage`) from your local `dist/` folder into the "Attach binaries" box.

7.  **Publish:** Click "Publish release". Your installers are now publicly available for download!

### Method 2: Automated Release (Advanced)

`electron-builder` can automatically create a GitHub Release and upload your built files.

1.  **Create a Personal Access Token (PAT):**
    *   Go to your GitHub **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
    *   Click "Generate new token".
    *   Give it a descriptive name (e.g., `electron-builder-release`).
    *   Set an expiration date.
    *   Check the `repo` scope. This grants the token permission to create releases in your public and private repositories.
    *   Click "Generate token" and **copy the token immediately**. You won't be able to see it again.

2.  **Set the token as an environment variable:** Before running the publish command, you must make this token available in your terminal session. **Do not commit this token to your code.**
    *   **macOS/Linux:** `export GH_TOKEN="YOUR_TOKEN_HERE"`
    *   **Windows (Command Prompt):** `set GH_TOKEN=YOUR_TOKEN_HERE`
    *   **Windows (PowerShell):** `$env:GH_TOKEN="YOUR_TOKEN_HERE"`

3.  **Run the publish script:** With the `GH_TOKEN` set, run the new `publish` script.
    ```bash
    npm run publish
    ```
    This command will build your application, create a draft release on GitHub, and upload the assets. You may need to go to the releases page to finalize and publish the draft.

---

## 🔧 Troubleshooting

### Author Name is Incorrect (e.g., Always 'Administrator')

This is a common issue on multi-user servers and almost always stems from how Windows Server permissions are configured, **not a bug in the application itself**. The application determines the "Author" by asking Windows for the legal **"Owner"** of the file. On many servers, shared folders are configured so that all new files are automatically "owned" by a single group (like `Administrators`).

To fix this, you may need to apply the `CREATOR OWNER` permission to the root of your shared folder. Please consult with your system administrator.

### Packaging Fails with "A required privilege is not held by the client"

When running a package script on Windows, you might see an error about being unable to create a "symbolic link".

**Solution 1: Run as Administrator (Quick Fix)**

Close your current terminal, open a new one **as an Administrator**, navigate to your project directory, and run the package command again.

**Solution 2: Enable Developer Mode (Recommended)**

For a permanent solution, enable Developer Mode in Windows Settings.

1.  Open Windows **Settings** -> **Privacy & security** (or **Update & Security**).
2.  Click on **For developers**.
3.  Toggle **Developer Mode** to **On**.
4.  Restart your terminal and try packaging again.

---

## 📄 License

This project is licensed under the MIT License.
