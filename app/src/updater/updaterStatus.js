/**
 * Enum of update states.
 */
const UpdaterStatus = {
  CheckingForUpdates: 'CheckingForUpdates',
  UpdateAvailable: 'UpdateAvailable',
  UpdateNotAvailable: 'UpdateNotAvailable',
  UpdateDownloaded: 'UpdateDownloaded',
  DownloadProgress: 'DownloadProgress',
  InstallingUpdate: 'InstallingUpdate',
  UpdateApplied: 'UpdateApplied',
  Error: 'Error',
};

module.exports = UpdaterStatus;
