/* global ExtensionCommon, ChromeUtils, Services */
"use strict";

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

const OBSERVER_TOPIC = "chrome-document-global-created";
const MARK = "__repeatDeletePatched";

var repeatDelete = class extends ExtensionCommon.ExtensionAPI {
  // about:3pane windows that have been patched, so they can be restored on shutdown.
  patched = new Set();
  observer = null;

  isDeleteKey(event) {
    return event.key == "Backspace" || event.key == "Delete";
  }

  // Replaces threadPane._onKeyPress with a version that lets repeated
  // Delete/Backspace key presses through instead of calling preventDefault().
  patch(win) {
    try {
      if (win.location.href != "about:3pane") {
        return;
      }
      const pane = win.threadPane;
      if (!pane || pane[MARK]) {
        return;
      }
      const original = pane._onKeyPress;
      const isDeleteKey = this.isDeleteKey;
      pane._onKeyPress = function (event) {
        if (isDeleteKey(event) && event.repeat) {
          // Do nothing: the normal delete command applies.
          return;
        }
        return original.call(this, event);
      };
      pane[MARK] = original;
      this.patched.add(win);
    } catch (e) {
      console.error("[repeat-delete] cannot patch window:", e);
    }
  }

  unpatchAll() {
    for (const win of this.patched) {
      try {
        const pane = win.threadPane;
        if (pane && pane[MARK]) {
          pane._onKeyPress = pane[MARK];
          delete pane[MARK];
        }
      } catch (e) {
        // Window already closed: nothing to restore.
      }
    }
    this.patched.clear();
  }

  // Patches a window as soon as its content is loaded.
  attach(win) {
    if (win.document.readyState == "complete") {
      this.patch(win);
    } else {
      win.addEventListener("load", () => this.patch(win), { once: true });
    }
  }

  start() {
    if (this.observer) {
      return;
    }
    // Windows and tabs that are already open.
    for (const mainWin of Services.wm.getEnumerator("mail:3pane")) {
      const tabmail = mainWin.document.getElementById("tabmail");
      for (const tab of tabmail?.tabInfo ?? []) {
        const win = tab.chromeBrowser?.contentWindow;
        if (win) {
          this.attach(win);
        }
      }
    }
    // Future tabs and windows.
    this.observer = {
      observe: subject => {
        try {
          subject.addEventListener("load", () => this.patch(subject), {
            once: true,
          });
        } catch (e) {
          // Document without event support: ignore.
        }
      },
    };
    Services.obs.addObserver(this.observer, OBSERVER_TOPIC);
  }

  getAPI() {
    return {
      repeatDelete: {
        start: async () => this.start(),
      },
    };
  }

  onShutdown() {
    if (this.observer) {
      Services.obs.removeObserver(this.observer, OBSERVER_TOPIC);
      this.observer = null;
    }
    this.unpatchAll();
  }
};
