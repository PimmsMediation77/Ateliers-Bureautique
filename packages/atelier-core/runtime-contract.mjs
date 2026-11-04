export const BROWSER_RUNTIME_MODULES = [
  "model",
  "storage",
  "home",
  "themes",
  "exercise",
  "route",
  "ui-events",
  "persistence",
  "session",
  "workfile",
  "reminder-modal",
  "user-setup",
  "progress",
  "profile",
  "view",
  "controller",
  "app-runtime",
  "app-bootstrap",
];

// Feuilles CSS communes, chargees avant styles.css / styles-redesign-v2.css de chaque atelier.
export const BROWSER_RUNTIME_STYLES = ["base", "redesign"];

export const BROWSER_RUNTIME_FILES = [
  ...BROWSER_RUNTIME_MODULES.map((moduleName) => ({
    src: `browser/${moduleName}.js`,
    dst: `js/core/${moduleName}.js`,
  })),
  ...BROWSER_RUNTIME_STYLES.map((styleName) => ({
    src: `browser/styles/${styleName}.css`,
    dst: `css/core/${styleName}.css`,
  })),
];

export const REQUIRED_DOM_IDS = [
  "exercise-workfile-btn",
  "header-user-switch-btn",
  "progress-change-user-btn",
  "themes-affinity-list",
  "affinity-theme-list",
  "user-setup-modal",
  "save-reminder-modal",
  "exercise-feedback-modal",
  "progress-usability-summary",
  "progress-usability-list",
];

export const SHARED_RUNTIME_SCRIPT_ORDER = [
  "js/core/home.js",
  "js/core/themes.js",
  "js/core/exercise.js",
  "js/core/route.js",
  "js/core/ui-events.js",
  "js/core/persistence.js",
  "js/core/session.js",
  "js/core/workfile.js",
  "js/core/reminder-modal.js",
  "js/core/user-setup.js",
  "js/core/progress.js",
  "js/core/profile.js",
  "js/core/controller.js",
];

export const APP_RUNTIME_SETUP_SCRIPT_ORDER = [
  "js/app-config.js",
  "js/core/model.js",
  "js/core/view.js",
  "js/core/storage.js",
  ...SHARED_RUNTIME_SCRIPT_ORDER.slice(0, 5),
  ...SHARED_RUNTIME_SCRIPT_ORDER.slice(5),
  "js/core/app-runtime.js",
];

export const APP_BOOTSTRAP_SCRIPT_ORDER = [
  ...APP_RUNTIME_SETUP_SCRIPT_ORDER,
  "js/core/app-bootstrap.js",
];
