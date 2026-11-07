const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { LocalModelService } = require("./local-models.cjs");
if (process.env.SPECULIB_TEST_PROFILE) {
  app.setPath("userData", path.resolve(process.env.SPECULIB_TEST_PROFILE));
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: "#090c11",
    title: "Speculib",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  const entry =
    process.env.SPECULIB_DEV === "1"
      ? "http://127.0.0.1:5173/"
      : pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  win.webContents.session.setPermissionRequestHandler(
    (_contents, permission, callback, details) =>
      callback(
        permission === "fullscreen" &&
          details.isMainFrame &&
          details.requestingUrl === entry,
      ),
  );
  win.loadURL(entry);
}
app.whenReady().then(async () => {
  const models = new LocalModelService(app.getPath("userData"));
  await models.init();
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || event.senderFrame !== event.sender.mainFrame)
        throw new Error("Unsupported model request");
      return fn(event, ...args);
    });
  handle("models:settings", () => models.settings);
  handle("models:list", () => models.list());
  handle("models:save", (_event, value) => models.save(value));
  for (const action of ["plan", "classify", "answer", "agentStep"])
    handle("models:" + action, (event, input, key) => {
      if (typeof key !== "string" || key.length > 100)
        throw new Error("Invalid request");
      return models[action](input, event.sender.id + ":" + key);
    });
  handle("models:cancel", (event, key) =>
    models.cancel(event.sender.id + ":" + String(key)),
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
