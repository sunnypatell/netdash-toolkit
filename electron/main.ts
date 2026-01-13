import { app, BrowserWindow, ipcMain, shell } from "electron"
import * as path from "path"
import { registerNetworkHandlers } from "./network/handlers"

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === "development"

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "NetDash Toolkit",
    icon: path.join(__dirname, "../public/favicon.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#0f172a",
    show: false,
  })

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"))
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  registerNetworkHandlers()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// IPC Handlers for app info
ipcMain.handle("app:getVersion", () => app.getVersion())
ipcMain.handle("app:getPlatform", () => process.platform)
ipcMain.handle("app:isElectron", () => true)
