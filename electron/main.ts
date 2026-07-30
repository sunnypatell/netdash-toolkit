/**
 * NetDash Toolkit - Electron Main Process
 * Desktop application for network engineering
 *
 * @author Sunny Patel
 * @license MIT
 */

import { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, nativeTheme } from "electron"
import * as path from "path"
import * as http from "http"
import handler from "serve-handler"
import { registerNetworkHandlers } from "./network/handlers"
import { CONTENT_SECURITY_POLICY } from "./csp"
import { appOrigins, decideNavigation, isPermissionAllowed } from "./navigation"

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

function applyContentSecurityPolicy(allowedOrigins: string[]): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let origin: string | null = null
    try {
      origin = new URL(details.url).origin
    } catch {
      origin = null
    }

    // only the app's own documents get the policy. rewriting headers on the
    // third-party api responses the tools fetch would change nothing and would
    // mean parsing every response in the main process.
    if (!origin || !allowedOrigins.includes(origin)) {
      callback({})
      return
    }

    const headers: Record<string, string | string[]> = { ...details.responseHeaders }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "content-security-policy") delete headers[key]
    }
    headers["Content-Security-Policy"] = [CONTENT_SECURITY_POLICY]
    callback({ responseHeaders: headers })
  })
}

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
    // load over localhost, not 127.0.0.1: firebase auth's authorized-domain
    // list contains "localhost" and treats the literal ip as a different
    // origin, so google sign-in failed with auth/unauthorized-domain in the
    // desktop app. the server still binds to 127.0.0.1 only.
    mainWindow.loadURL(`http://localhost:${STATIC_PORT}`)
  }

  const allowedOrigins = appOrigins({ isDev, staticPort: STATIC_PORT })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideNavigation(url, allowedOrigins)
    if (decision.action === "external") shell.openExternal(decision.url)
    return { action: "deny" }
  })

  // setWindowOpenHandler only sees window.open and target=_blank. without this,
  // a location.href assignment or a plain anchor click navigates the window to a
  // remote origin, and preload.js (which exposes portScan, arpScan and friends)
  // runs for every navigation in this webContents.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const decision = decideNavigation(url, allowedOrigins)
    if (decision.action === "allow") return
    event.preventDefault()
    if (decision.action === "external") shell.openExternal(decision.url)
  })

  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault()
  })

  // named to avoid shadowing the imported `session`, which the csp helper uses
  const windowSession = mainWindow.webContents.session
  windowSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isPermissionAllowed(permission))
  })
  windowSession.setPermissionCheckHandler((_wc, permission) => isPermissionAllowed(permission))

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

    // next dev serves eval-based sourcemaps and an hmr websocket, so the policy
    // ships with the packaged build only
    if (!isDev) {
      applyContentSecurityPolicy(appOrigins({ isDev, staticPort: STATIC_PORT }))
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
