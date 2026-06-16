const path = require('path')
const fs   = require('fs')
const os   = require('os')

const DATA_DIR  = path.join(os.homedir(), '.dm-companion')
const COMP_FILE = path.join(DATA_DIR, 'compendium.json')
const CAMP_FILE = path.join(DATA_DIR, 'campaigns.json')
const ENC_FILE  = path.join(DATA_DIR, 'encounters.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

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

module.exports = { saveCompendium, loadCompendium, saveCampaigns, loadCampaigns, saveEncounters, loadEncounters }