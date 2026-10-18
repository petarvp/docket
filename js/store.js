const SETTINGS_KEY = 'docket.settings';
const ONBOARDED_KEY = 'docket.onboarded';
const SNAPSHOT_KEY = 'docket.snapshot';
const OUTBOX_KEY = 'docket.outbox';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function isOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

export function setOnboarded() {
  localStorage.setItem(ONBOARDED_KEY, 'true');
}

export function getSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function saveSnapshot(categories, tasks) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ categories, tasks }));
}

export function getOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveOutbox(ops) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
}
