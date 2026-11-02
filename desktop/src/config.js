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

/** The page width where the app draws its desktop layout (src/components/desktop/context.ts, DESKTOP_MIN). */
const DESKTOP_MIN = 1024;
/** Smallest page the window allows (a content size, not the outer frame): never narrower than the desktop
 *  layout, so resizing the window never drops it into the phone layout. Shrunk on smaller screens. */
const MIN_SIZE = { width: DESKTOP_MIN, height: 700 };
/** First-launch page size, shrunk to fit smaller screens. */
const DEFAULT_SIZE = { width: 1440, height: 900 };
/** The self-test's page: a comfortable desktop window on any runner's screen. */
const SMOKE_SIZE = { width: 1280, height: 800 };

module.exports = { PRODUCT_NAME, APP_ID, DATA_FOLDER, APP_SCHEME, APP_HOST, APP_ORIGIN, DESKTOP_MIN, MIN_SIZE, DEFAULT_SIZE, SMOKE_SIZE };
