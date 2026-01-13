/**
 * NetDash Toolkit - Electron Main Process
 * Enterprise-grade desktop application for network engineering
 *
 * @author Sunny Patel
 * @license MIT
 */

import { app, BrowserWindow, ipcMain, shell, Menu, dialog, nativeTheme } from "electron"
import * as path from "path"
import { registerNetworkHandlers } from "./network/handlers"

// ============================================================================
// CONSTANTS
// ============================================================================

const APP_NAME = "NetDash Toolkit"
const isDev = process.env.NODE_ENV === "development"

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: APP_NAME,
    icon: path.join(__dirname, "../public/favicon.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for network operations
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    // macOS specific styling
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 15, y: 15 },
    // Theme-aware background
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f172a" : "#ffffff",
    show: false, // Don't show until ready
  })

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"))
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow opening external URLs
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url)
    }
    return { action: "deny" }
  })

  // Handle navigation attempts
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // Prevent navigation away from the app in production
    if (!isDev && !url.startsWith("file://")) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ============================================================================
// APPLICATION MENU
// ============================================================================

function createMenu(): void {
  const isMac = process.platform === "darwin"

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const, label: `About ${APP_NAME}` },
              { type: "separator" as const },
              {
                label: "Preferences...",
                accelerator: "CmdOrCtrl+,",
                click: () => {
                  // Could open preferences window
                  mainWindow?.webContents.send("open-preferences")
                },
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: "File",
      submenu: [
        {
          label: "Export Results...",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow?.webContents.send("export-results")
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ type: "separator" as const }, { role: "toggleDevTools" as const }] : []),
      ],
    },

    // Tools menu
    {
      label: "Tools",
      submenu: [
        {
          label: "Ping",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow?.webContents.send("navigate-tool", "ping"),
        },
        {
          label: "Port Scanner",
          accelerator: "CmdOrCtrl+2",
          click: () => mainWindow?.webContents.send("navigate-tool", "port-scanner"),
        },
        {
          label: "Subnet Calculator",
          accelerator: "CmdOrCtrl+3",
          click: () => mainWindow?.webContents.send("navigate-tool", "subnet-calculator"),
        },
        { type: "separator" },
        {
          label: "Network Interfaces",
          click: async () => {
            const { response } = await dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "Network Interfaces",
              message: "Network interface information is available in the dashboard.",
              buttons: ["OK", "Open Dashboard"],
            })
            if (response === 1) {
              mainWindow?.webContents.send("navigate-tool", "dashboard")
            }
          },
        },
      ],
    },

    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },

    // Help menu
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => {
            shell.openExternal("https://github.com/sunnypatell/netdash-toolkit#readme")
          },
        },
        {
          label: "Report Issue",
          click: () => {
            shell.openExternal("https://github.com/sunnypatell/netdash-toolkit/issues")
          },
        },
        { type: "separator" },
        {
          label: `About ${APP_NAME}`,
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: `About ${APP_NAME}`,
              message: APP_NAME,
              detail: `Version: ${app.getVersion()}\n\nA professional network engineering toolkit with real networking capabilities.\n\nBuilt with Electron, Next.js, and TypeScript.\n\n© 2024-2025 Sunny Patel`,
              buttons: ["OK"],
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

function registerAppHandlers(): void {
  // App info
  ipcMain.handle("app:getVersion", () => app.getVersion())
  ipcMain.handle("app:getPlatform", () => process.platform)
  ipcMain.handle("app:isElectron", () => true)
  ipcMain.handle("app:getName", () => app.getName())

  // Theme handling
  ipcMain.handle("app:getTheme", () => {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light"
  })

  ipcMain.handle("app:setTheme", (_event, theme: "dark" | "light" | "system") => {
    nativeTheme.themeSource = theme
    return true
  })

  // Window controls
  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize()
  })

  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle("window:close", () => {
    mainWindow?.close()
  })

  // Dialog handlers
  ipcMain.handle("dialog:showSaveDialog", async (_event, options) => {
    if (!mainWindow) return { canceled: true }
    return dialog.showSaveDialog(mainWindow, options)
  })

  ipcMain.handle("dialog:showOpenDialog", async (_event, options) => {
    if (!mainWindow) return { canceled: true }
    return dialog.showOpenDialog(mainWindow, options)
  })

  ipcMain.handle("dialog:showMessageBox", async (_event, options) => {
    if (!mainWindow) return { response: 0 }
    return dialog.showMessageBox(mainWindow, options)
  })
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// Handle app ready
app.whenReady().then(() => {
  console.log(`[NetDash] Starting ${APP_NAME} v${app.getVersion()}`)
  console.log(`[NetDash] Platform: ${process.platform}, Arch: ${process.arch}`)
  console.log(`[NetDash] Development mode: ${isDev}`)

  createWindow()
  createMenu()
  registerAppHandlers()
  registerNetworkHandlers()

  // macOS: Re-create window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
})

// Handle all windows closed
app.on("window-all-closed", () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// Handle before quit
app.on("before-quit", () => {
  console.log("[NetDash] Application shutting down")
})

// Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    // Focus main window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

// Handle certificate errors (for development)
app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

// Security: Disable navigation to unknown protocols
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    // Allow localhost in dev, file:// in production
    if (isDev) {
      if (parsedUrl.origin !== "http://localhost:3000") {
        event.preventDefault()
      }
    } else {
      if (parsedUrl.protocol !== "file:") {
        event.preventDefault()
      }
    }
  })
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on("uncaughtException", (error) => {
  console.error("[NetDash] Uncaught Exception:", error)
  dialog.showErrorBox("Error", `An unexpected error occurred: ${error.message}`)
})

process.on("unhandledRejection", (reason) => {
  console.error("[NetDash] Unhandled Rejection:", reason)
})
