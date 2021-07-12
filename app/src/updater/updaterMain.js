// @ts-nocheck

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { ipcMain, dialog } = require('electron');
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
    this.postUpdateDownloadInfo = null;

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

    /** @type {string?} */
    this.currentStatus = null;

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Cruzer-Blade',
      repo: 'g-assist-unofficial-temp-release',
    });

    log.info('Starting Updater Service...');
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
      this.postUpdateDownloadInfo = info;
      this.sendStatusToWindow(UpdaterStatus.UpdateDownloaded, info);
      onUpdateReady();
    });

    // IPC messages

    ipcMain.on('update:checkForUpdates', () => {
      UpdaterService.checkForUpdates();
    });

    ipcMain.on('update:installUpdateAndRestart', () => {
      this.installUpdateAndRestart(this.postUpdateDownloadInfo);
    });

    ipcMain.on('update:downloadUpdate', () => {
      autoUpdater.downloadUpdate();
    });
  }

  /**
   * Sends the updater status and args to renderer process.
   * Also updates the current status in the updater service.
   *
   * @param {string} status
   * @param {any} arg
   */
  sendStatusToWindow(status, arg) {
    this.currentStatus = status;
    this.rendererWindow.webContents.send(status, arg);
  }

  /**
   * Installs update on MacOS
   * 
   * @param {() => void} onUpdateApplied
   * Callback function called after update is installed
   */
  installMacUpdate(onUpdateApplied) {
    const { downloadedFile } = this.postUpdateDownloadInfo;
    const cacheFolder = path.dirname(downloadedFile);

    // Path to the `.app` folder
    const appPath = path.resolve(this.app.getAppPath(), '../../..');
    const appPathParent = path.dirname(appPath);

    this.sendStatusToWindow(UpdaterStatus.InstallingUpdate, {
      downloadedFile,
      cacheFolder,
      appPath,
      appPathParent,
    });

    if (fs.existsSync(`${cacheFolder}/Google Assistant.app`)) {
      child_process.execSync(`rm -rf "${cacheFolder}/Google Assistant.app"`);
    }

    // Extract the downloaded archive
    const appExtractionCmd = `ditto -x -k "${downloadedFile}" "${cacheFolder}"`;

    child_process.exec(appExtractionCmd, (err, stdout, stderr) => {
      if (err) {
        dialog.showMessageBoxSync({
          type: 'error',
          message: 'Error occurred while extracting archive',
          detail: err.message,
        });

        return;
      }

      // Delete existing `.app` in application directory
      // to avoid problems with moving the updated version
      // to the destination.

      child_process.execSync(`rm -rf "${appPath}"`);

      // Copy the extracted `.app` to the application directory
      child_process.execSync([
        'mv',
        `"${cacheFolder}/Google Assistant.app"`,
        `"${appPathParent}"`,
      ].join(' '));

      this.sendStatusToWindow(UpdaterStatus.UpdateApplied, null);
      onUpdateApplied();
    });
  }

  /**
   * Restarts the application after applying update
   */
  installUpdateAndRestart() {
    this.app.isQuitting = true;

    if (process.platform !== 'darwin') {
      autoUpdater.quitAndInstall(true, true);
    }
    else {
      this.installMacUpdate(() => {
        this.app.relaunch();
        this.app.quit();
      });
    }
  }

  /**
   * Quits the application after applying update
   */
  installUpdateAndQuit() {
    this.app.isQuitting = true;

    if (process.platform != 'darwin') {
      autoUpdater.quitAndInstall(true);
    }
    else {
      this.installMacUpdate(() => {
        this.app.quit();
      });
    }
  }

  /**
   * Checks for an update and notifies the user when available
   */
  static checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}

module.exports = UpdaterService;
