const path = require('path')
const fs   = require('fs')
const os   = require('os')
const { ipcRenderer } = require('electron')

const DATA_DIR  = ipcRenderer.sendSync('get-user-data-path')
const COMP_FILE    = path.join(DATA_DIR, 'compendium.json')
const CAMP_FILE    = path.join(DATA_DIR, 'campaigns.json')
const ENC_FILE     = path.join(DATA_DIR, 'encounters.json')
const WELCOME_FILE = path.join(DATA_DIR, 'welcome.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

// One-time migration from the old hand-rolled ~/.dm-companion location to
// Electron's standard userData path. Leaves the legacy folder in place.
function migrateLegacyData() {
  const legacyDir = path.join(os.homedir(), '.dm-companion')
  if (!fs.existsSync(legacyDir)) return

  const hasNewData = fs.existsSync(COMP_FILE) || fs.existsSync(CAMP_FILE) || fs.existsSync(ENC_FILE)
  if (hasNewData) return

  ensureDir()
  for (const [filename, dest] of [
    ['compendium.json', COMP_FILE],
    ['campaigns.json', CAMP_FILE],
    ['encounters.json', ENC_FILE],
  ]) {
    const src = path.join(legacyDir, filename)
    if (fs.existsSync(src)) fs.copyFileSync(src, dest)
  }
}

migrateLegacyData()

function saveCompendium(data) {
  ensureDir()
  fs.writeFileSync(COMP_FILE, JSON.stringify(data), 'utf8')
}

function loadCompendium() {
  try {
    if (!fs.existsSync(COMP_FILE)) return null
    return JSON.parse(fs.readFileSync(COMP_FILE, 'utf8'))
  } catch(e) { return null }
}

// Campaigns: { id: { id, name, art, players, npcs, encounters, notes, treasure } }
function saveCampaigns(data) {
  ensureDir()
  fs.writeFileSync(CAMP_FILE, JSON.stringify(data), 'utf8')
}

function loadCampaigns() {
  try {
    if (!fs.existsSync(CAMP_FILE)) return null
    return JSON.parse(fs.readFileSync(CAMP_FILE, 'utf8'))
  } catch(e) { return null }
}

function saveEncounters(data) {
  ensureDir()
  fs.writeFileSync(ENC_FILE, JSON.stringify(data), 'utf8')
}

function loadEncounters() {
  try {
    if (!fs.existsSync(ENC_FILE)) return null
    return JSON.parse(fs.readFileSync(ENC_FILE, 'utf8'))
  } catch(e) { return null }
}

function saveHasSeenWelcome(seen) {
  ensureDir()
  fs.writeFileSync(WELCOME_FILE, JSON.stringify({ hasSeenWelcome: seen }), 'utf8')
}

function loadHasSeenWelcome() {
  try {
    if (!fs.existsSync(WELCOME_FILE)) return false
    return JSON.parse(fs.readFileSync(WELCOME_FILE, 'utf8')).hasSeenWelcome === true
  } catch(e) { return false }
}

const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots')

// Writes a one-off, timestamped copy of app state before a risky mutation
// (backup restore, one-time data migration). Never overwritten or pruned —
// it's a forensic trail, not a cache, so a real incident always has a
// recoverable prior state to fall back to.
function saveSnapshot(label, data) {
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(SNAPSHOT_DIR, `${label}-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(data), 'utf8')
  return file
}

module.exports = {
  saveCompendium, loadCompendium, saveCampaigns, loadCampaigns, saveEncounters, loadEncounters,
  saveHasSeenWelcome, loadHasSeenWelcome, saveSnapshot
}