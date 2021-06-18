// @ts-nocheck

const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const UpdaterStatus = require('./updaterStatus');

/**
 * Main process updater service
 */
class UpdaterService {
  /**
   * Creates updater service object
   *
   * @param {import('electron').BrowserWindow} rendererWindow
   * Renderer window to communicate update status.
   *
   * @param {import('electron').App} app
   * App instance to quit before updating.
   *
   * @param {boolean} shouldAutoDownload
   * Specify if any new update should be downloaded
   * automatically.
   */
  constructor(rendererWindow, app, shouldAutoDownload) {
    this.rendererWindow = rendererWindow;
    this.app = app;
    this.shouldAutoDownload = shouldAutoDownload;

    autoUpdater.autoDownload = false;
  }

  /**
   * Initializes updater with event listeners
   *
   * @param {() => void} onUpdateReady
   * Callback function called when the update is downloaded
   * and is ready to be installed.
   */
  initializeUpdater(onUpdateReady) {
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Cruzer-Blade',
      repo: 'g-assist-unofficial-temp-release',
    });

    log.info('App starting...');
    autoUpdater.checkForUpdates();

    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow(UpdaterStatus.CheckingForUpdates);
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatusToWindow(UpdaterStatus.UpdateAvailable, info);

      if (this.shouldAutoDownload) {
        autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow(UpdaterStatus.UpdateNotAvailable, info);
    });

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow(UpdaterStatus.Error, err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
      logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
      logMessage = `${logMessage} (${progressObj.transferred} / ${progressObj.total})`;
      console.log(logMessage);

      this.sendStatusToWindow(UpdaterStatus.DownloadProgress, progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatusToWindow(UpdaterStatus.UpdateDownloaded, info);
      onUpdateReady();
    });

    // IPC messages

    ipcMain.on('update:checkForUpdates', () => {
      UpdaterService.checkForUpdates();
    });

    ipcMain.on('update:installUpdateAndRestart', () => {
      this.installUpdateAndRestart();
    });

    ipcMain.on('update:downloadUpdate', () => {
      autoUpdater.downloadUpdate();
    });
  }

  /**
   * Sends the updater status and args to renderer process
   *
   * @param {string} status
   * @param {any} arg
   */
  sendStatusToWindow(status, arg) {
    this.rendererWindow.webContents.send(status, arg);
  }

  /**
   * Updates the application and then restarts it
   */
  installUpdateAndRestart() {
    this.app.isQuitting = true;
    autoUpdater.quitAndInstall(true, true);
  }

  /**
   * Quits the application and then updates it
   */
  quitAndInstallUpdate() {
    this.app.isQuitting = true;
    autoUpdater.quitAndInstall(true);
  }

  /**
   * Checks for an update and notifies the user when available
   */
  static checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}

module.exports = UpdaterService;
