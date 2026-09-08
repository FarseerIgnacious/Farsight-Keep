#!/usr/bin/env node
// ONE-TIME PERSONAL DATA CLEANUP SCRIPT — NOT an app feature.
// Never wired into autoLoad() or any shipped migration. Run manually only, and only
// against the user's own real compendium.json/campaigns.json.
//
// Consolidates duplicate/deprecated spell entries — old vs "[2024]" versions, and
// asterisk/"Ritual Version" variants — down to a single canonical spell per name,
// redirecting every reference to the surviving spell before deleting the old ones.
//
// Usage:
//   node scripts/replace-spell-versions.js                 dry run (default, no writes)
//   node scripts/replace-spell-versions.js --report out.json   dry run + full JSON report
//   node scripts/replace-spell-versions.js --apply             apply for real (writes files)
//   node scripts/replace-spell-versions.js --apply --include-spells-field
//       also fix the monster .spells flat field and NPC .spells field (see README note
//       printed by the dry run — these aren't in the original Step 3 list but contain
//       real dangling-reference risk if skipped)

const fs = require('fs')
const os = require('os')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const INCLUDE_SPELLS_FIELD = process.argv.includes('--include-spells-field')
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
console.log(`Mode: ${APPLY ? 'APPLY (will write real changes)' : 'DRY RUN (no writes)'}${APPLY && INCLUDE_SPELLS_FIELD ? ' + --include-spells-field' : ''}`)

const compendium = JSON.parse(fs.readFileSync(COMPENDIUM_PATH, 'utf8'))
const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'))

// Mirrors cleanSpellName() in renderer.js — strips trailing "*" and trailing "(...)"
// annotations so a free-text spell mention matches the compendium by name.
function cleanSpellName(raw) {
  let s = (raw || '').trim()
  let prev
  do {
    prev = s
    s = s.replace(/\*+\s*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  } while (s !== prev)
  return s
}

// Mirrors the 5 line patterns in renderer.js scanLines() — a match only ever hits a
// whole spell-list line, and names are split/cleaned the same way, so a deleted name
// is never confused with a substring of a longer surviving spell's name.
const LINE_PATTERNS = [
  { re: /^cantrips?\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^at will\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)\/day each\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^(\d+)\/day\s*:\s*(.+)/i, listGroup: 2 },
]

const ACTION_FIELDS = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']

// ── STEP 1: identify spells to delete ──────────────────────────────
const spells = compendium.spells
const byName = new Map(spells.map(s => [s.name, s]))

const catA = spells
  .filter(s => !s.name.includes('[2024]') && byName.has(s.name + ' [2024]') && s.name !== 'Counterspell')
  .map(s => s.name)

const catB = spells
  .filter(s => /\*\s*$/.test(s.name) || /ritual version/i.test(s.name))
  .map(s => s.name)

const catASet = new Set(catA)
const deletedSet = new Set([...catA, ...catB])

console.log(`\n=== STEP 1: Spells marked for deletion ===`)
console.log(`Category A ([2024] duplicates, Counterspell excluded): ${catA.length}`)
console.log(`Category B (asterisk / "Ritual Version"): ${catB.length}`)
console.log(`Total: ${deletedSet.size}`)
if (deletedSet.has('Counterspell')) throw new Error('BUG: Counterspell ended up in the deletion set')

// ── STEP 2: compute redirect targets ───────────────────────────────
function stripVersionSuffix(name) {
  let s = name.trim()
  s = s.replace(/\*+\s*$/, '').trim()
  s = s.replace(/[\s,\-–—(]*ritual version[\s)]*$/i, '').trim()
  s = s.replace(/[,\-–—(]+\s*$/, '').trim()
  return s
}

const redirects = new Map() // deletedName -> targetName | null
for (const name of catA) redirects.set(name, name + ' [2024]')
for (const name of catB) {
  const base = stripVersionSuffix(name)
  const with2024 = base + ' [2024]'
  if (byName.has(with2024)) redirects.set(name, with2024)
  else if (byName.has(base) && !catASet.has(base)) redirects.set(name, base)
  else redirects.set(name, null)
}

const dryRunTable = [
  ...catA.map(name => ({ name, category: 'A', target: redirects.get(name) })),
  ...catB.map(name => ({ name, category: 'B', target: redirects.get(name) })),
].sort((a, b) => a.name.localeCompare(b.name))

console.log(`\n=== STEP 2: Deletion + redirect table (${dryRunTable.length} spells) ===`)
for (const row of dryRunTable) {
  console.log(`  [${row.category}] "${row.name}" -> ${row.target || 'NO TARGET - reference will be removed'}`)
}
const noTargetRows = dryRunTable.filter(r => !r.target)
console.log(`\n${noTargetRows.length} spell(s) with NO TARGET.`)

// ── STEP 3: find every reference ───────────────────────────────────
const deletedLower = new Map([...deletedSet].map(n => [n.toLowerCase(), n]))

function findFreeTextRefs(text) {
  const hits = []
  const lines = (text || '').split('\n')
  lines.forEach((raw, lineIdx) => {
    const line = raw.trim()
    for (const pat of LINE_PATTERNS) {
      const m = line.match(pat.re)
      if (!m) continue
      const segments = m[pat.listGroup].split(',')
      segments.forEach((seg, segIdx) => {
        const trimmedSeg = seg.trim()
        const cleanName = cleanSpellName(trimmedSeg)
        const match = deletedLower.get(cleanName.toLowerCase())
        if (match) hits.push({ lineIdx, segIdx, rawSegment: trimmedSeg, cleanName, matchedDeletedName: match, target: redirects.get(match) })
      })
      break
    }
  })
  return hits
}

const references = { monsterSelectedSpells: [], monsterFreeText: [], npcSelectedSpells: [], npcFreeText: [], pcSelectedSpells: [], pcFreeText: [] }
const extraReferences = { monsterSpellsField: [], npcSpellsField: [] } // NOT in the original Step 3 list - see note below

for (const m of compendium.monsters) {
  for (const sp of (m.selectedSpells || [])) {
    const match = deletedLower.get((sp.name || '').toLowerCase())
    if (match) references.monsterSelectedSpells.push({ monster: m.name, oldName: sp.name, matchedDeletedName: match, target: redirects.get(match) })
  }
  for (const field of ACTION_FIELDS) {
    for (const a of (m[field] || [])) {
      if (!/spellcast/i.test(a.name || '')) continue
      const hits = findFreeTextRefs(a.text)
      for (const h of hits) references.monsterFreeText.push({ monster: m.name, field, action: a.name, ...h })
    }
  }
  if (typeof m.spells === 'string' && m.spells) {
    const segs = m.spells.split(',').map(s => s.trim()).filter(Boolean)
    segs.forEach((seg, idx) => {
      const clean = cleanSpellName(seg)
      const match = deletedLower.get(clean.toLowerCase())
      if (match) extraReferences.monsterSpellsField.push({ monster: m.name, idx, rawSegment: seg, matchedDeletedName: match, target: redirects.get(match) })
    })
  }
}

for (const campName of Object.keys(campaigns)) {
  const c = campaigns[campName]
  for (const npc of (c.npcs || [])) {
    const owner = npc.properName || npc.name
    for (const sp of (npc.selectedSpells || [])) {
      const match = deletedLower.get((sp.name || '').toLowerCase())
      if (match) references.npcSelectedSpells.push({ campaign: campName, npc: owner, oldName: sp.name, matchedDeletedName: match, target: redirects.get(match) })
    }
    for (const field of ACTION_FIELDS) {
      for (const a of (npc[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        const hits = findFreeTextRefs(a.text)
        for (const h of hits) references.npcFreeText.push({ campaign: campName, npc: owner, field, action: a.name, ...h })
      }
    }
    if (Array.isArray(npc.spells)) {
      npc.spells.forEach((entry, idx) => {
        const name = typeof entry === 'string' ? entry : entry?.name
        const match = deletedLower.get((name || '').toLowerCase())
        if (match) extraReferences.npcSpellsField.push({ campaign: campName, npc: owner, idx, isObject: typeof entry !== 'string', oldName: name, matchedDeletedName: match, target: redirects.get(match) })
      })
    }
  }
  for (const pc of (c.players || [])) {
    const owner = pc.properName || pc.name || pc.label
    for (const sp of (pc.selectedSpells || [])) {
      const match = deletedLower.get((sp.name || '').toLowerCase())
      if (match) references.pcSelectedSpells.push({ campaign: campName, pc: owner, oldName: sp.name, matchedDeletedName: match, target: redirects.get(match) })
    }
    for (const field of ACTION_FIELDS) {
      for (const a of (pc[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        const hits = findFreeTextRefs(a.text)
        for (const h of hits) references.pcFreeText.push({ campaign: campName, pc: owner, field, action: a.name, ...h })
      }
    }
  }
}

console.log(`\n=== STEP 3: References found (as explicitly requested) ===`)
console.log(`Monster selectedSpells:        ${references.monsterSelectedSpells.length}`)
console.log(`Monster free-text Spellcasting: ${references.monsterFreeText.length} (across ${new Set(references.monsterFreeText.map(r => r.monster)).size} monsters)`)
console.log(`NPC selectedSpells:             ${references.npcSelectedSpells.length}`)
console.log(`NPC free-text Spellcasting:     ${references.npcFreeText.length} (across ${new Set(references.npcFreeText.map(r => r.campaign + '::' + r.npc)).size} NPCs)`)
console.log(`PC selectedSpells:              ${references.pcSelectedSpells.length}`)
console.log(`PC free-text Spellcasting:      ${references.pcFreeText.length}`)

console.log(`\n=== NOT in the original Step 3 list — flagging separately ===`)
console.log(`These two fields aren't in the 4 bullets you specified, but they DO contain`)
console.log(`references to deleted spells. If left unfixed, these become dangling names`)
console.log(`after deletion — the exact "spell falls back to a synthetic Cantrip-labeled`)
console.log(`entry" bug from a previous session, since lookup would fail silently.`)
console.log(`Monster .spells flat field: ${extraReferences.monsterSpellsField.length} references (across ${new Set(extraReferences.monsterSpellsField.map(r => r.monster)).size} monsters)`)
console.log(`NPC .spells field:          ${extraReferences.npcSpellsField.length} references (across ${new Set(extraReferences.npcSpellsField.map(r => r.npc)).size} NPCs)`)
console.log(`These are only fixed if you run with BOTH --apply --include-spells-field.`)

// ── Write full report ───────────────────────────────────────────────
if (REPORT_PATH) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ dryRunTable, references, extraReferences }, null, 2), 'utf8')
  console.log(`\nFull report written to ${REPORT_PATH}`)
}

if (!APPLY) {
  console.log(`\nDry run complete. Re-run with --apply to make changes (add --report <path> any time for full JSON detail).`)
  process.exit(0)
}

// ── STEP 4: apply ──────────────────────────────────────────────────
function snapshotFile(srcPath, label) {
  const dir = path.join(DATA_DIR, 'snapshots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(dir, `${label}-${stamp}.json`)
  fs.copyFileSync(srcPath, dest)
  return dest
}

const compendiumSnapshotPath = snapshotFile(COMPENDIUM_PATH, 'pre-spell-version-cleanup-compendium')
const campaignsSnapshotPath = snapshotFile(CAMPAIGNS_PATH, 'pre-spell-version-cleanup-campaigns')
console.log(`\nSnapshots written:\n  ${compendiumSnapshotPath}\n  ${campaignsSnapshotPath}`)

function rewriteFreeText(text) {
  const lines = (text || '').split('\n')
  const newLines = lines.map(raw => {
    const trimmed = raw.trim()
    for (const pat of LINE_PATTERNS) {
      const m = trimmed.match(pat.re)
      if (!m) continue
      const listPart = m[pat.listGroup]
      const prefix = trimmed.slice(0, trimmed.length - listPart.length)
      const segments = listPart.split(',')
      const newSegments = []
      for (const seg of segments) {
        const trimmedSeg = seg.trim()
        const cleanName = cleanSpellName(trimmedSeg)
        const match = deletedLower.get(cleanName.toLowerCase())
        if (!match) { newSegments.push(trimmedSeg); continue }
        const target = redirects.get(match)
        if (!target) continue // drop this segment entirely
        const annotationSuffix = trimmedSeg.slice(cleanName.length)
        newSegments.push(target + annotationSuffix)
      }
      if (newSegments.length === 0) return null // drop the whole line
      return prefix + newSegments.join(', ')
    }
    return raw
  })
  return newLines.filter(l => l !== null).join('\n')
}

let freeTextLinesFixed = 0
function fixFreeTextFields(owner, fields) {
  for (const field of fields) {
    for (const a of (owner[field] || [])) {
      if (!/spellcast/i.test(a.name || '')) continue
      const before = a.text
      const after = rewriteFreeText(before)
      if (after !== before) { a.text = after; freeTextLinesFixed++ }
    }
  }
}

let selectedSpellsFixed = 0
function fixSelectedSpells(owner) {
  if (!Array.isArray(owner.selectedSpells)) return
  const kept = []
  for (const sp of owner.selectedSpells) {
    const match = deletedLower.get((sp.name || '').toLowerCase())
    if (!match) { kept.push(sp); continue }
    const target = redirects.get(match)
    selectedSpellsFixed++
    if (target) kept.push({ ...sp, name: target })
    // else: drop it (no target)
  }
  owner.selectedSpells = kept
}

for (const m of compendium.monsters) {
  fixSelectedSpells(m)
  fixFreeTextFields(m, ACTION_FIELDS)
}
for (const campName of Object.keys(campaigns)) {
  const c = campaigns[campName]
  for (const npc of (c.npcs || [])) {
    fixSelectedSpells(npc)
    fixFreeTextFields(npc, ACTION_FIELDS)
  }
  for (const pc of (c.players || [])) {
    fixSelectedSpells(pc)
    fixFreeTextFields(pc, ACTION_FIELDS)
  }
}

let spellsFieldFixed = 0
if (INCLUDE_SPELLS_FIELD) {
  for (const m of compendium.monsters) {
    if (typeof m.spells !== 'string' || !m.spells) continue
    const segs = m.spells.split(',').map(s => s.trim()).filter(Boolean)
    const newSegs = []
    for (const seg of segs) {
      const clean = cleanSpellName(seg)
      const match = deletedLower.get(clean.toLowerCase())
      if (!match) { newSegs.push(seg); continue }
      const target = redirects.get(match)
      spellsFieldFixed++
      if (target) newSegs.push(target)
    }
    m.spells = newSegs.join(',')
  }
  for (const campName of Object.keys(campaigns)) {
    const c = campaigns[campName]
    for (const npc of (c.npcs || [])) {
      if (!Array.isArray(npc.spells)) continue
      const newArr = []
      for (const entry of npc.spells) {
        const isObj = typeof entry !== 'string'
        const name = isObj ? entry.name : entry
        const match = deletedLower.get((name || '').toLowerCase())
        if (!match) { newArr.push(entry); continue }
        const target = redirects.get(match)
        spellsFieldFixed++
        if (target) newArr.push(isObj ? { ...entry, name: target } : target)
      }
      npc.spells = newArr
    }
  }
}

// Delete the spells themselves (category A + B, Counterspell already excluded)
const beforeCount = compendium.spells.length
compendium.spells = compendium.spells.filter(s => !deletedSet.has(s.name))
const deletedCount = beforeCount - compendium.spells.length

fs.writeFileSync(COMPENDIUM_PATH, JSON.stringify(compendium), 'utf8')
fs.writeFileSync(CAMPAIGNS_PATH, JSON.stringify(campaigns), 'utf8')

console.log(`\n=== STEP 4: Applied ===`)
console.log(`Spells deleted: ${deletedCount} (Category A: ${catA.length}, Category B: ${catB.length})`)
console.log(`selectedSpells entries redirected/removed: ${selectedSpellsFixed}`)
console.log(`Free-text Spellcasting lines rewritten: ${freeTextLinesFixed}`)
console.log(`Flat .spells field entries redirected/removed: ${INCLUDE_SPELLS_FIELD ? spellsFieldFixed : '0 (skipped - pass --include-spells-field to fix these)'}`)
console.log(`Counterspell present in final spell list: ${compendium.spells.some(s => s.name === 'Counterspell')}`)
console.log(`Counterspell [2024] present in final spell list: ${compendium.spells.some(s => s.name === 'Counterspell [2024]')}`)
console.log(`Snapshots:\n  ${compendiumSnapshotPath}\n  ${campaignsSnapshotPath}`)
