// Native German application menu. On macOS the first menu is always the app
// name (Apple HIG). Windows/Linux use the File menu as the first menu.

const fs = require("fs");
const path = require("path");
const { app, Menu, shell, BrowserWindow, dialog } = require("electron");

// Find CHANGELOG.md. In the packaged app it's in process.resourcesPath
// (via build.extraResources). In dev mode it's in the repo root.
function findChangelogPath() {
  const candidates = [
    process.resourcesPath
      ? path.join(process.resourcesPath, "CHANGELOG.md")
      : null,
    path.join(__dirname, "..", "CHANGELOG.md"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.R_OK);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

// Extract the section for the given version. Returns plain text (markdown
// stripped of heading hashes / bullets / inline-code backticks) suitable
// for a native dialog's detail field.
function readReleaseNotes(version) {
  const file = findChangelogPath();
  if (!file) return null;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const marker = `## [${version}]`;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const after = start + marker.length;
  const nextStart = text.indexOf("\n## [", after);
  const section = text
    .slice(after, nextStart === -1 ? undefined : nextStart)
    .trim();
  // Strip markdown chrome so the native dialog renders cleanly.
  return section
    .replace(/^### +/gm, "") // sub-headings
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^- /gm, "• ") // bullets
    .trim();
}

function showAboutDialog(parent) {
  const version = app.getVersion();
  const notes = readReleaseNotes(version);
  const lines = [
    `Version ${version}`,
    "",
    "Verwaltung von Pruefungsfragen, Weiterbildungsgaengen und Pruefungen.",
  ];
  if (notes) {
    lines.push("", "— Neu in dieser Version —", "", notes);
  }
  lines.push("", "© AIM");
  dialog.showMessageBox(parent ?? undefined, {
    type: "info",
    title: "Ueber AIM Pruefungs-Manager",
    message: "AIM Pruefungs-Manager",
    detail: lines.join("\n"),
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
