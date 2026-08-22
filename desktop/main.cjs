const { app, BrowserWindow, net, protocol, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { APP_ORIGIN, APP_SCHEME, isTrustedAppUrl, resolveBundlePath } = require("./security.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      codeCache: true,
    },
  },
]);

function isSafeExternalUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function registerAppProtocol() {
  const bundleRoot = path.join(app.getAppPath(), "dist", "client");

  protocol.handle(APP_SCHEME, (request) => {
    let target = resolveBundlePath(bundleRoot, request.url);
    if (!target) return new Response("Not found", { status: 404 });

    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      const requestPath = new URL(request.url).pathname;
      if (path.extname(requestPath)) return new Response("Not found", { status: 404 });
      target = path.join(bundleRoot, "index.html");
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

function createWindow() {
  const smokeTest = process.argv.includes("--smoke-test");
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#060b16",
    title: "Living Field",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isTrustedAppUrl(url)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url);
  });

  mainWindow.webContents.once("did-fail-load", (_event, code, description) => {
    if (!smokeTest) return;
    console.error(`Desktop smoke test failed to load: ${code} ${description}`);
    process.exitCode = 1;
    app.quit();
  });

  mainWindow.webContents.once("did-finish-load", async () => {
    if (!smokeTest) return;
    const result = await mainWindow.webContents.executeJavaScript(`({
      title: document.title,
      hasRoot: Boolean(document.getElementById("root")?.textContent?.includes("Living Field")),
      secureContext: window.isSecureContext
    })`);
    console.log(`Desktop smoke test: ${JSON.stringify(result)}`);
    if (result.title !== "Living Field Atlas" || !result.hasRoot || !result.secureContext) process.exitCode = 1;
    app.quit();
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`${APP_ORIGIN}/`);
  return mainWindow;
}

app.setName("Living Field");
app.setAppUserModelId("org.livingfield.desktop");

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

