// src/config/changelog.js

// Change this single line whenever you release a new update!
export const APP_VERSION = "1.0.6";

// Add your newest updates to the TOP of this list
export const VERSION_HISTORY_ITEMS = [
  {
    version: "1.0.6",
    date: "2026-04",
    notes:
      "Bug fixing the update ready to install state and ensuring the restart button only works when an update is ready.",
  },
  {
    version: "1.0.5",
    date: "2026-04",
    notes:
      "Updated the auto-update behavior and related updater flow.",
  },
  {
    version: "1.0.4",
    date: "2026-04",
    notes:
      "Updated the updater token ID.",
  },
  {
    version: "1.0.3",
    date: "2026-03",
    notes:
      "Implemented updater status handling in the UI and main process.",
  },
  {
    version: "1.0.2",
    date: "2026-03",
    notes:
      "Bumped the application version to 1.0.2 in package.json and package-lock.json.",
  },
  {
    version: "1.0.1",
    date: "2026-03",
    notes:
      "Updated the document title to reflect version 1.0.0.",
  },
  {
    version: "1.0.0",
    date: "2026-03",
    notes:
      "Reverted deep linking and restored the web setup flow.",
  },
  {
    version: "0.1.10",
    date: "2026-03",
    notes:
      "Reverted deep linking and restored the web setup flow.",
  },
  {
    version: "0.1.9",
    date: "2026-03",
    notes:
      "Updated the version to 0.1.9 and fixed a DeepLinkListener navigation typo.",
  },
  {
    version: "0.1.8",
    date: "2026-03",
    notes:
      "Implemented deep linking support with DesktopRouter for secure token transfer and user prompts.",
  },
  {
    version: "0.1.7",
    date: "2026-03",
    notes:
      "Added delete-user handling with CORS support and authorization checks.",
  },
  {
    version: "0.1.6",
    date: "2026-03",
    notes:
      "Updated the version to 0.1.6 and removed commented-out ticket fields in TicketForm.",
  },
  {
    version: "0.1.5",
    date: "2026-03",
    notes:
      "Added redirect handling for invite links so users land on the Set Password page instead of the dashboard.",
  },
  {
    version: "0.1.4",
    date: "2026-03",
    notes:
      "Bumped the application version to 0.1.4 in package.json and package-lock.json.",
  },
  {
    version: "0.1.3",
    date: "2026-03",
    notes:
      "Bumped the version to 0.1.3 and improved time checks and notifications across the app.",
  },
  {
    version: "0.1.2",
    date: "2026-03",
    notes:
      "Removed Playwright tests and related dependencies.",
  },
  {
    version: "0.1.1",
    date: "2026-03",
    notes:
      "Updated the currency prefix format in providerConfig.js.",
  },
  {
    version: "0.1.0",
    date: "2026-03",
    notes:
      "Updated provider conditions and withdrawal reasons in providerConfig.js.",
  },
  {
    version: "0.0.20",
    date: "2026-03",
    notes:
      "Bumped the version to 0.0.20 and added audio notifications for handover reminders with improved toast messaging.",
  },
  {
    version: "0.0.19",
    date: "2026-03",
    notes:
      "Updated loss script button visibility based on provider type.",
  },
  {
    version: "0.0.18",
    date: "2026-03",
    notes:
      "Updated the version to 0.0.18 in package.json and package-lock.json.",
  },
  {
    version: "0.0.17",
    date: "2026-03",
    notes:
      "Refactored the code structure for readability and maintainability.",
  },
  {
    version: "0.0.16",
    date: "2026-03",
    notes:
      "Implemented handover-enabled notifications with toast and system alerts.",
  },
  {
    version: "0.0.15",
    date: "2026-03",
    notes:
      "Enhanced handover notifications with system alerts and improved checks.",
  },
  {
    version: "0.0.14",
    date: "2026-03",
    notes:
      "Updated Google Sheets response validation to check updatedRows, updatedColumns, and updatedCells.",
  },
  {
    version: "0.0.13",
    date: "2026-03",
    notes:
      "Updated the version to 0.0.13 in package.json and package-lock.json.",
  },
  {
    version: "0.0.12",
    date: "2026-03",
    notes:
      "Updated the version to 0.0.12 in package.json and package-lock.json.",
  },
  {
    version: "0.0.11",
    date: "2026-03",
    notes:
      "Updated the version to 0.0.11 and removed the version from the document title in index.html.",
  },
  {
    version: "0.0.10",
    date: "2026-03",
    notes:
      "Added a comprehensive development guide covering critical issues and implementation steps.",
  },
  {
    version: "0.0.9",
    date: "2026-03",
    notes:
      "Bumped the version to 0.0.9 and improved the presence update mechanism with a heartbeat interval.",
  },
  {
    version: "0.0.8",
    date: "2026-03",
    notes:
      "Improved real-time ticket sync with better subscription management and error handling.",
  },
  {
    version: "0.0.7",
    date: "2026-03",
    notes:
      "Enhanced ticket appending logic to handle empty inputs and deduplicate entries.",
  },
  {
    version: "0.0.6",
    date: "2026-03",
    notes:
      "Updated the version number to 0.0.6 in package.json and package-lock.json.",
  },
  {
    version: "0.0.5",
    date: "2026-03",
    notes:
      "Updated appId and productName in package.json for consistency.",
  },
  {
    version: "0.0.4",
    date: "2026-03",
    notes:
      "Updated appId and productName in package.json for consistency.",
  },
  {
    version: "0.0.3",
    date: "2026-03",
    notes:
      "Updated appId and productName in package.json for consistency.",
  },
  {
    version: "0.0.2",
    date: "2026-02",
    notes:
      "Improved shift transition logic, fixed incoming shift unlock behavior, adjusted target shift calculation, and suspended auto-archiving during shared windows.",
  },
  {
    version: "0.0.1",
    date: "2026-01",
    notes:
      "Added ticket visibility enhancements during shift overlaps, plus installer and release pipeline improvements.",
  },
  {
    version: "0.0.0",
    date: "2025-12",
    notes:
      "Initial production release with core shift handover, Google Sheets integration, ticket management, and real-time duty roster.",
  },
];
