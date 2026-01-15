/**
 * NetDash Toolkit - Electron Main Process
 * Desktop application for network engineering
 *
 * @author Sunny Patel
 * @license MIT
 */

import { app, BrowserWindow, ipcMain, shell, Menu, dialog, nativeTheme } from "electron"
import * as path from "path"
import * as http from "http"
import handler from "serve-handler"
import { registerNetworkHandlers } from "./network/handlers"

// ============================================================================
// CONSTANTS
// ============================================================================

const APP_NAME = "NetDash Toolkit"
const isDev = process.env.NODE_ENV === "development"
const STATIC_PORT = 17890 // Port for static file server

// ============================================================================
// STATIC FILE SERVER
// ============================================================================

let staticServer: http.Server | null = null

function startStaticServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const outDir = path.join(__dirname, "../out")

    staticServer = http.createServer((req, res) => {
      return handler(req, res, {
        public: outDir,
        cleanUrls: true,
        directoryListing: false,
      })
    })

    staticServer.listen(STATIC_PORT, "127.0.0.1", () => {
      console.log(`[NetDash] Static server running at http://127.0.0.1:${STATIC_PORT}`)
      resolve(STATIC_PORT)
    })

    staticServer.on("error", (err) => {
      console.error("[NetDash] Static server error:", err)
      reject(err)
    })
  })
}

function stopStaticServer(): void {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
}

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
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      webSecurity: true,
    },
  })

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // Load from local static server
    mainWindow.loadURL(`http://127.0.0.1:${STATIC_PORT}`)
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Don't open our local server externally
      if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        shell.openExternal(url)
      }
    }
    return { action: "deny" }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ============================================================================
// MENU
// ============================================================================

function createMenu(): void {
  const isMac = process.platform === "darwin"

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
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
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
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
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

function registerAppHandlers(): void {
  ipcMain.handle("app:getVersion", () => app.getVersion())
  ipcMain.handle("app:getPlatform", () => process.platform)
  ipcMain.handle("app:isElectron", () => true)
  ipcMain.handle("app:getTheme", () => (nativeTheme.shouldUseDarkColors ? "dark" : "light"))

  ipcMain.handle("dialog:showOpenDialog", async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] }
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    // Start static server for production
    if (!isDev) {
      try {
        await startStaticServer()
      } catch (err) {
        console.error("[NetDash] Failed to start static server:", err)
        dialog.showErrorBox("Error", "Failed to start application server")
        app.quit()
        return
      }
    }

    createWindow()
    createMenu()
    registerAppHandlers()
    registerNetworkHandlers()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  stopStaticServer()
})

process.on("uncaughtException", (error) => {
  console.error("[NetDash] Error:", error)
})
