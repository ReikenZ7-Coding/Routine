'use strict';

// Names the Windows app keeps for good.
//
// Saved data (routines, groceries, the look) lives in the window's localStorage, which Chromium files under the
// page's origin inside the data folder. Changing APP_SCHEME, APP_HOST or DATA_FOLDER would make everyone's saved
// data look gone, the same way the Android package id and the routine.*.v1 storage keys must never change.
// APP_ID is the Windows app id (taskbar grouping, notifications, the installer's uninstall entry): changing it
// would install a second copy instead of upgrading the first. It must match build.appId in package.json and must
// not reuse the Android package id (com.reikenz7.routine).

const PRODUCT_NAME = 'Symphony OS';
const APP_ID = 'com.reikenz7.symphonyos';
const DATA_FOLDER = 'Symphony OS';

const APP_SCHEME = 'app';
const APP_HOST = 'symphony';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Smallest window the desktop layout is designed for (it switches to the desktop shell at 1024 wide). */
const MIN_SIZE = { width: 1024, height: 700 };
/** First-launch window size, shrunk to fit smaller screens. */
const DEFAULT_SIZE = { width: 1440, height: 900 };

module.exports = { PRODUCT_NAME, APP_ID, DATA_FOLDER, APP_SCHEME, APP_HOST, APP_ORIGIN, MIN_SIZE, DEFAULT_SIZE };
