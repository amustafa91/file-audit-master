# File Audit Master: Setup and Deployment Guide

This guide explains how to set up the File Audit Master application, which consists of two main parts: a background monitoring service and a user interface (UI).

## 1. The Two-Part System: A Crucial Concept

It is essential to understand that this application is split into two distinct parts that work together:

1.  **The Background Service (The "Collector"):**
    *   This is a lightweight Node.js script (`background-service.js`).
    *   Its only job is to run on the machine you want to monitor (e.g., a file server or your local development machine).
    *   It watches for file changes and writes them to log files.
    *   **Crucially, it is now managed directly by the main UI application.** It no longer requires any external tools like PM2.

2.  **The UI Application (The "Viewer"):**
    *   This is the desktop application you interact with.
    *   It can be installed on any user's machine (e.g., your personal laptop).
    *   Its job is to read the log files created by the Collector and display them in a user-friendly dashboard.
    *   **The UI can now reliably start and stop the background service on the local machine.**

This architecture ensures that file changes can always be collected (as long as the service is running), even when the UI application is closed.

---

## 2. Prerequisites

-   **Node.js:** Version 18.x or newer is recommended. You can download it from [nodejs.org](https://nodejs.org/).
-   **npm:** Comes bundled with Node.js.
-   **(Optional) Git:** For cloning the project repository.

## 3. Installation

First, get the application code and install the necessary dependencies.

```bash
# 1. Clone the repository (or download and extract the source code)
git clone <repository_url>
cd file-audit-master

# 2. Install all dependencies for both the UI and the service
npm install
```

## 4. Running the UI in Development Mode

To run the application for development, you must run **two commands in two separate terminals**. This is required because the UI (Vite) and the application window (Electron) are separate processes.

### 👉 Terminal 1: Start the UI Server

First, start the Vite development server. This serves your React code and provides instant updates as you make changes.

```bash
# In your first terminal, run:
npm run dev:ui
```

Wait for the terminal to show that the server is running, typically with a message like `VITE v5.x.x ready in XXXms`.

### 👉 Terminal 2: Start the Application Window

Once the UI server is running, open a **new terminal** and run the command to launch the Electron application window.

```bash
# In your second terminal, run:
npm run dev:electron
```

The Electron window will appear and automatically load the UI from the server you started in the first terminal. You can now make changes to the frontend code (`.tsx`, `.css` files) and see them update live.

---

## 5. Running on a Multi-User Server

When deploying the service on a server where multiple users will be modifying files, a correct permissions setup is **essential** for the application to work correctly.

### Permissions are Critical

The background monitoring service needs to be able to do two things:
1.  Receive file change notifications from the operating system.
2.  Read the "owner" attribute of a changed file to identify the author.

To do this successfully for **all users**, the service must be run by a user account that has at least **Read permissions** for all files and folders within the monitored project directories.

**Recommendation:**
-   On a Windows Server, it is best practice to run the service under a dedicated **Service Account** or an **Administrator** account.
-   Running the service under a standard, limited user account will likely result in the service **only detecting changes made by that user**, and it will fail to identify the correct author for other changes.
-   **Note:** Running as an Administrator can affect author tracking. See the "Troubleshooting" section below for details if the author name is incorrect.

You can start the main `File Audit Master.exe` application as an administrator, which will then launch the background service with the necessary elevated privileges.

---

## 6. Managing the Background Service

The background service is fully managed from within the application. You do not need any external command-line tools.

1.  Launch **File Audit Master**.
2.  In the sidebar at the bottom, locate the **"Monitoring Service"** panel.
3.  Click **"Start"** to begin monitoring for file changes in the background. The service will continue to run and track changes even if you close the main application window.
4.  Click **"Stop"** to pause the background monitoring.

When you add or remove a project folder, the service will automatically restart with the new configuration.

---

## 7. Building for Production (.exe)

When you are ready to distribute the UI application, you can bundle it into a professional Windows installer.

### > ⚠️ IMPORTANT: Creating the Application Icon

For the application and the final installer to have a custom icon, you **must** create an icon file and place it in the correct location before building.

-   **File Name:** `icon.ico`
-   **Location:** It must be placed inside a `build` folder in the root of the project. The final path should be `build/icon.ico`.
-   **Format:** The file must be in the `.ico` format. A resolution of `256x256` pixels is recommended for best results on Windows. You can use free online tools to convert a `.png` to an `.ico` file.

**If this file is missing, Electron Builder will use a generic, default icon.**

### Running the Build

1.  **Run the package script:**
    This command first builds the frontend assets and then packages them into an installer using the configuration in `package.json`.
    ```bash
    npm run package
    ```

2.  **Locate the installer:**
    Find the installer file in the `dist` folder, named something like `File Audit Master Setup 1.0.0.exe`.

---

## 8. Troubleshooting

### Author Name is Incorrect (e.g., Always 'Administrator')

This is a common and complex issue on multi-user servers. It stems from how Windows Server permissions work, **not a bug in the application itself**.

#### The Cause: File "Owner" vs. The User Who *Saved* the File

-   The application determines the "Author" by asking Windows for the legal **"Owner"** of the file.
-   On many servers, shared folders are configured for security so that all new files are automatically owned by a single group (like `Administrators`), regardless of which user creates them.
-   Because our setup guide recommends running the service as an Administrator (to ensure it can see all file changes), the service correctly queries the file owner and gets the answer: `Administrator`.

Essentially, the application is accurately reporting the *legal owner* of the file, which on your server is not the same as the *user who last saved it*.

#### The Solution: Adjusting Server-Side Folder Permissions

The only reliable way to fix this is to configure the monitored project folder so that the user who creates a file automatically becomes its owner. This requires an administrator.

1.  **Right-click** the main project folder you are monitoring and go to **Properties**.
2.  Go to the **Security** tab and click **Advanced**.
3.  In the Advanced Security Settings, you can see the current `Owner`. If this is `Administrators`, it confirms the source of the issue.
4.  An administrator needs to adjust the folder's security settings to apply the **"CREATOR OWNER"** principle, which ensures the user who creates an object becomes its owner.

#### What If This Doesn't Work? A Note on Technical Limitations

In some corporate environments, company-wide rules called **Group Policy Objects (GPOs)** can override any folder-level permission changes an administrator makes.

If the author name is still incorrect after attempting the fix above, it is highly likely that a GPO is enforcing file ownership. In this situation, it is technically infeasible for a background service like this one to reliably determine which user modified a file.

If you face this issue, you can speak with your system administrator and ask specifically: **"Can you configure this folder so that the 'CREATOR OWNER' principle applies to new files, and can you confirm that no Group Policy is overriding this setting?"**

### Packaging Fails with "A required privilege is not held by the client"

When running `npm run package` on Windows, you might see an error about being unable to create a "symbolic link".

#### Solution 1: Run as Administrator (Quick Fix)

Close your current terminal, open a new one **as an Administrator**, navigate to your project directory, and run `npm run package` again.

#### Solution 2: Enable Developer Mode (Recommended)

For a permanent solution, enable Developer Mode in Windows Settings.

1.  Open Windows **Settings** -> **Privacy & security** (or **Update & Security**).
2.  Click on **For developers**.
3.  Toggle **Developer Mode** to **On**.
4.  Restart your terminal and try packaging again.

---

## 9. Frequently Asked Questions (FAQ)

### Q: Do my end-users need to install Node.js to use this application?

**A: No.** The installer (`.exe`) you create with `npm run package` is completely **self-contained**.

It bundles all necessary components—including the Electron framework and the specific Node.js runtime required to run both the main application and the background service. An end-user only needs to run the installer you provide them. No other software or dependencies are required on their machine.
