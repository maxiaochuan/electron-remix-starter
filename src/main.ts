import { app, BrowserWindow, dialog } from "electron";
import * as path from "path";
import { initRemix } from "./remix";

let win: BrowserWindow

async function createWindow(url: string) {
  // Create the browser window.
  win = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
    show: false,
  });

  // and load the index.html of the app.
  // await win.loadFile(path.join(__dirname, "../index.html"));
  await win.loadURL(url);

  win.show();

  // Open the DevTools.
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  void (async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
        await installExtension(REACT_DEVELOPER_TOOLS);
      }

      const url = await initRemix({
        serverBuild: path.join(__dirname, '../build/index.js'),
      })

      await createWindow(url);

    } catch (error) {
      // dialog.showErrorBox("Error", getErrorStack(error));
    }
  })()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getErrorStack(error: unknown) {
	return error instanceof Error ? error.stack || error.message : String(error)
}