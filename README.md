# File Audit Master

**A professional, Windows-style desktop application for real-time file monitoring, detailed change logging, and visual reporting.**

<p align="center">
  <img src="https://via.placeholder.com/800x450.png?text=File+Audit+Master+Screenshot" alt="Application Screenshot">
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

Download the latest pre-built installers for your operating system using the links below.

| Operating System | Download Link                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **Windows**      | [**Download .exe**](https://your-download-host.com/file-audit-master-latest.exe)             |
| **macOS (Intel/Apple)**| [**Download .dmg**](https://your-download-host.com/file-audit-master-latest.dmg)       |
| **Linux**        | [**Download .AppImage**](https://your-download-host.com/file-audit-master-latest.AppImage)   |

> **Note:** These are placeholder links. You will need to replace `https://your-download-host.com/...` with the actual URLs where you host your installer files.

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