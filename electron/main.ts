import { app, BrowserWindow, ipcMain, session, shell, Menu, dialog } from "electron"
import * as path from "path"
import * as http from "http"
import handler from "serve-handler"
import { registerNetworkHandlers, shutdownNetworkHandlers } from "./network/handlers"
import { CONTENT_SECURITY_POLICY } from "./csp"
import { appOrigins, decideNavigation, isPermissionAllowed } from "./navigation"

const APP_NAME = "NetDash Toolkit"
const isDev = process.env.NODE_ENV === "development"
const STATIC_PORT = 17890

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
  if (!staticServer) return
  // close() alone waits on the renderer's keep-alive sockets, so the listener outlives the app
  staticServer.closeAllConnections()
  staticServer.close()
  staticServer = null
}

let mainWindow: BrowserWindow | null = null

function applyContentSecurityPolicy(allowedOrigins: string[]): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let origin: string | null = null
    try {
      origin = new URL(details.url).origin
    } catch {
      origin = null
    }

    // app documents only: rewriting headers on the third-party responses tools fetch buys nothing
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

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // localhost, not 127.0.0.1: firebase auth treats them as different origins.
    // see docs/src/content/docs/self-hosting/desktop-build.md
    mainWindow.loadURL(`http://localhost:${STATIC_PORT}`)
  }

  const allowedOrigins = appOrigins({ isDev, staticPort: STATIC_PORT })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideNavigation(url, allowedOrigins)
    if (decision.action === "external") shell.openExternal(decision.url)
    return { action: "deny" }
  })

  // setWindowOpenHandler misses location.href and anchor clicks, and preload runs for every
  // navigation in this webContents, so a remote origin would get portScan and arpTable
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

// only what preload.ts bridges: the old dialog and theme handlers were unreachable but still
// forwarded raw renderer objects into native dialogs
function registerAppHandlers(): void {
  ipcMain.handle("app:getVersion", () => app.getVersion())
  ipcMain.handle("app:getPlatform", () => process.platform)
  ipcMain.handle("app:isElectron", () => true)
}

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

    // packaged build only: next dev serves eval sourcemaps and an hmr websocket
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
  // quitting mid-scan used to leave its child processes and sockets running
  shutdownNetworkHandlers()
  stopStaticServer()
})

process.on("uncaughtException", (error) => {
  console.error("[NetDash] Error:", error)
})
