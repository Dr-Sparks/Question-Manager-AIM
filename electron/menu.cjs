// Native German application menu. On macOS the first menu is always the app
// name (Apple HIG). Windows/Linux use the File menu as the first menu.

const { app, Menu, shell, BrowserWindow, dialog } = require("electron");

function showAboutDialog(parent) {
  const version = app.getVersion();
  const detail = [
    `Version ${version}`,
    "",
    "Verwaltung von Pruefungsfragen, Weiterbildungsgaengen und Pruefungen.",
    "",
    "© AIM",
  ].join("\n");
  dialog.showMessageBox(parent ?? undefined, {
    type: "info",
    title: "Ueber AIM Pruefungs-Manager",
    message: "AIM Pruefungs-Manager",
    detail,
    buttons: ["Schliessen"],
    defaultId: 0,
  });
}

function buildMenu({ onCheckForUpdates }) {
  const isMac = process.platform === "darwin";

  const aboutItem = {
    label: "Ueber AIM Pruefungs-Manager",
    click: () => showAboutDialog(BrowserWindow.getFocusedWindow()),
  };
  const checkUpdatesItem = {
    label: "Nach Updates suchen...",
    click: () => onCheckForUpdates?.(),
  };

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              aboutItem,
              { type: "separator" },
              checkUpdatesItem,
              { type: "separator" },
              { role: "services", label: "Dienste" },
              { type: "separator" },
              { role: "hide", label: "AIM Pruefungs-Manager ausblenden" },
              { role: "hideOthers", label: "Andere ausblenden" },
              { role: "unhide", label: "Alle einblenden" },
              { type: "separator" },
              { role: "quit", label: "AIM Pruefungs-Manager beenden" },
            ],
          },
        ]
      : []),
    {
      label: "Datei",
      submenu: [
        isMac
          ? { role: "close", label: "Fenster schliessen" }
          : { role: "quit", label: "Beenden" },
      ],
    },
    {
      label: "Bearbeiten",
      submenu: [
        { role: "undo", label: "Rueckgaengig" },
        { role: "redo", label: "Wiederherstellen" },
        { type: "separator" },
        { role: "cut", label: "Ausschneiden" },
        { role: "copy", label: "Kopieren" },
        { role: "paste", label: "Einfuegen" },
        { role: "selectAll", label: "Alles auswaehlen" },
      ],
    },
    {
      label: "Ansicht",
      submenu: [
        { role: "reload", label: "Neu laden" },
        { role: "forceReload", label: "Hart neu laden" },
        { type: "separator" },
        { role: "resetZoom", label: "Originalgroesse" },
        { role: "zoomIn", label: "Vergroessern" },
        { role: "zoomOut", label: "Verkleinern" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Vollbild" },
      ],
    },
    {
      label: "Fenster",
      submenu: [
        { role: "minimize", label: "Minimieren" },
        ...(isMac
          ? [
              { role: "zoom", label: "Zoom" },
              { type: "separator" },
              { role: "front", label: "Alle nach vorne" },
            ]
          : [{ role: "close", label: "Schliessen" }]),
      ],
    },
    {
      label: "Hilfe",
      submenu: [
        {
          label: "Projekt auf GitHub oeffnen",
          click: () =>
            shell.openExternal("https://github.com/Dr-Sparks/Question-Manager-AIM"),
        },
        ...(isMac ? [] : [{ type: "separator" }, aboutItem, checkUpdatesItem]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu, showAboutDialog };
