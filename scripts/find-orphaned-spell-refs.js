#!/usr/bin/env node
// READ-ONLY INVESTIGATION SCRIPT — NOT an app feature, never wired into autoLoad().
// Finds spell-name references (in monster/NPC/PC data) that point to a spell which
// no longer exists anywhere in compendium.json's spells array — orphaned references
// left behind because the user manually deleted some spells before
// scripts/replace-spell-versions.js ran (so that script never saw or redirected them).
//
// Makes NO changes. Usage: node scripts/find-orphaned-spell-refs.js [--report path.json]

const fs = require('fs')
const os = require('os')
const path = require('path')

const reportFlagIdx = process.argv.indexOf('--report')
const REPORT_PATH = reportFlagIdx >= 0 ? process.argv[reportFlagIdx + 1] : null

function resolveDataDir() {
  const productName = 'Farsight Keep'
  const candidates = []
  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', productName))
  } else if (process.platform === 'win32') {
    candidates.push(path.join(process.env.APPDATA || '', productName))
  } else {
    candidates.push(path.join(os.homedir(), '.config', productName))
  }
  candidates.push(path.join(os.homedir(), '.dm-companion'))
  return candidates.find(p => fs.existsSync(path.join(p, 'compendium.json'))) || candidates[0]
}

const DATA_DIR = resolveDataDir()
const COMPENDIUM_PATH = path.join(DATA_DIR, 'compendium.json')
const CAMPAIGNS_PATH = path.join(DATA_DIR, 'campaigns.json')
console.log(`Data dir: ${DATA_DIR}`)
console.log(`Mode: READ-ONLY investigation (no writes)`)

const compendium = JSON.parse(fs.readFileSync(COMPENDIUM_PATH, 'utf8'))
const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'))

// Mirrors cleanSpellName() in renderer.js
function cleanSpellName(raw) {
  let s = (raw || '').trim()
  let prev
  do {
    prev = s
    s = s.replace(/\*+\s*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  } while (s !== prev)
  return s
}

// Mirrors the 5 line patterns in renderer.js scanLines()
const LINE_PATTERNS = [
  { re: /^cantrips?\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^at will\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)\/day each\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^(\d+)\/day\s*:\s*(.+)/i, listGroup: 2 },
]

const ACTION_FIELDS = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']

const spells = compendium.spells
const byNameLower = new Map(spells.map(s => [s.name.toLowerCase(), s.name]))

// Splits a comma-separated spell list WITHOUT breaking apart a single entry whose
// own parenthetical annotation contains internal commas, e.g. "Shapechange (Beast or
// Humanoid form only, no Temporary Hit Points gained from the spell)" is one entry,
// not three. NOTE: the real app's scanLines() in renderer.js does a plain `.split(',')`
// and does NOT have this protection - see the investigation note about Adult Brass
// Dragon [2024]'s "Shapechange" entry, a separate pre-existing bug flagged, not fixed,
// by this script.
function splitSpellList(listStr) {
  const segments = []
  let depth = 0
  let current = ''
  for (const ch of listStr) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      segments.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() || segments.length) segments.push(current)
  return segments
}

function findFreeTextNames(text) {
  const found = []
  const lines = (text || '').split('\n')
  lines.forEach((raw, lineIdx) => {
    const line = raw.trim()
    for (const pat of LINE_PATTERNS) {
      const m = line.match(pat.re)
      if (!m) continue
      const segments = splitSpellList(m[pat.listGroup])
      segments.forEach((seg, segIdx) => {
        const trimmedSeg = seg.trim()
        const cleanName = cleanSpellName(trimmedSeg)
        if (cleanName) found.push({ lineIdx, segIdx, rawSegment: trimmedSeg, cleanName })
      })
      break
    }
  })
  return found
}

// orphanName(lowercase) -> { name, count, locations: [] }
const orphans = new Map()
function recordOrphan(name, location) {
  if (!name) return
  if (byNameLower.has(name.toLowerCase())) return // exists in compendium - not orphaned
  const key = name.toLowerCase()
  if (!orphans.has(key)) orphans.set(key, { name, count: 0, locations: [] })
  const entry = orphans.get(key)
  entry.count++
  entry.locations.push(location)
}

// ── Monsters ──
for (const m of compendium.monsters) {
  for (const sp of (m.selectedSpells || [])) {
    recordOrphan(sp.name, { source: 'monster', owner: m.name, field: 'selectedSpells' })
  }
  if (typeof m.spells === 'string' && m.spells) {
    for (const seg of splitSpellList(m.spells).map(s => s.trim()).filter(Boolean)) {
      recordOrphan(cleanSpellName(seg), { source: 'monster', owner: m.name, field: 'spells (flat)' })
    }
  }
  for (const field of ACTION_FIELDS) {
    for (const a of (m[field] || [])) {
      if (!/spellcast/i.test(a.name || '')) continue
      for (const hit of findFreeTextNames(a.text)) {
        recordOrphan(hit.cleanName, { source: 'monster', owner: m.name, field: `${field}.text (${a.name})`, raw: hit.rawSegment })
      }
    }
  }
}

// ── NPCs / PCs (campaigns.json) ──
for (const campName of Object.keys(campaigns)) {
  const c = campaigns[campName]
  for (const npc of (c.npcs || [])) {
    const owner = npc.properName || npc.name
    for (const sp of (npc.selectedSpells || [])) {
      recordOrphan(sp.name, { source: 'npc', campaign: campName, owner, field: 'selectedSpells' })
    }
    if (Array.isArray(npc.spells)) {
      for (const entry of npc.spells) {
        const name = typeof entry === 'string' ? entry : entry?.name
        recordOrphan(cleanSpellName(name || ''), { source: 'npc', campaign: campName, owner, field: 'spells (flat)' })
      }
    } else if (typeof npc.spells === 'string' && npc.spells) {
      for (const seg of splitSpellList(npc.spells).map(s => s.trim()).filter(Boolean)) {
        recordOrphan(cleanSpellName(seg), { source: 'npc', campaign: campName, owner, field: 'spells (flat)' })
      }
    }
    for (const field of ACTION_FIELDS) {
      for (const a of (npc[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        for (const hit of findFreeTextNames(a.text)) {
          recordOrphan(hit.cleanName, { source: 'npc', campaign: campName, owner, field: `${field}.text (${a.name})`, raw: hit.rawSegment })
        }
      }
    }
  }
  for (const pc of (c.players || [])) {
    const owner = pc.properName || pc.name || pc.label
    for (const sp of (pc.selectedSpells || [])) {
      recordOrphan(sp.name, { source: 'pc', campaign: campName, owner, field: 'selectedSpells' })
    }
    for (const field of ACTION_FIELDS) {
      for (const a of (pc[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        for (const hit of findFreeTextNames(a.text)) {
          recordOrphan(hit.cleanName, { source: 'pc', campaign: campName, owner, field: `${field}.text (${a.name})`, raw: hit.rawSegment })
        }
      }
    }
  }
}

console.log(`\n=== STEP 1: Orphaned spell names found: ${orphans.size} ===`)
const sortedOrphans = [...orphans.values()].sort((a, b) => a.name.localeCompare(b.name))
for (const o of sortedOrphans) {
  console.log(`  "${o.name}" - ${o.count} reference(s)`)
}

// ── STEP 2: classify redirectable vs no-target ──
const redirectable = []
const noTarget = []
for (const o of sortedOrphans) {
  const with2024 = (o.name + ' [2024]').toLowerCase()
  if (byNameLower.has(with2024)) {
    redirectable.push({ ...o, target: byNameLower.get(with2024) })
  } else {
    noTarget.push(o)
  }
}

console.log(`\n=== STEP 2: Classification ===`)
console.log(`Redirectable (has a "[2024]" version already in compendium): ${redirectable.length}`)
for (const r of redirectable) console.log(`  "${r.name}" -> "${r.target}" (${r.count} refs)`)
console.log(`\nNO TARGET (no [2024] version exists - need XML lookup): ${noTarget.length}`)
for (const n of noTarget) console.log(`  "${n.name}" (${n.count} refs)`)

if (REPORT_PATH) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ orphans: sortedOrphans, redirectable, noTarget }, null, 2), 'utf8')
  console.log(`\nFull report written to ${REPORT_PATH}`)
}
