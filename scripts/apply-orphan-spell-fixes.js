#!/usr/bin/env node
// ONE-TIME PERSONAL DATA CLEANUP SCRIPT — NOT an app feature, never wired into
// autoLoad(). Applies the confirmed fixes from the orphaned-spell-reference
// investigation: redirects 51 orphaned free-text/flat-field/selectedSpells
// references to their existing "[2024]" (or plain, where no [2024] exists)
// equivalents, fixes 3 one-off corrupted source-text entries, and resolves
// Ssendam's ambiguous "power word (any)" mention into two explicit spells.
//
// Usage:
//   node scripts/apply-orphan-spell-fixes.js              dry run (default)
//   node scripts/apply-orphan-spell-fixes.js --apply       apply for real

const fs = require('fs')
const os = require('os')
const path = require('path')

const APPLY = process.argv.includes('--apply')

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
console.log(`Mode: ${APPLY ? 'APPLY (will write real changes)' : 'DRY RUN (no writes)'}`)

const compendium = JSON.parse(fs.readFileSync(COMPENDIUM_PATH, 'utf8'))
const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_PATH, 'utf8'))
const byName = new Map(compendium.spells.map(s => [s.name, s]))

function assertExists(name) {
  if (!byName.has(name)) throw new Error(`Expected spell "${name}" to exist in compendium - aborting.`)
}

// ── The 51 confirmed simple redirects (orphaned name -> real spell name) ──
// Case-insensitive match on the ORPHANED name as it actually appears in the data
// (after standard cleanSpellName cleanup already strips trailing */parens).
const REDIRECTS = {
  // 38 directly-matched (no extra normalization needed beyond the usual clean)
  'acid splash': 'Acid Splash [2024]', 'aid': 'Aid [2024]', 'alarm': 'Alarm [2024]',
  'alter self': 'Alter Self [2024]', 'animal friendship': 'Animal Friendship [2024]',
  'animal messenger': 'Animal Messenger [2024]', 'animal shapes': 'Animal Shapes [2024]',
  'animate dead': 'Animate Dead [2024]', 'animate objects': 'Animate Objects [2024]',
  'antilife shell': 'Antilife Shell [2024]', 'antimagic field': 'Antimagic Field [2024]',
  'arcane eye': 'Arcane Eye [2024]', 'arcane gate': 'Arcane Gate [2024]',
  'arcane lock': 'Arcane Lock [2024]', 'armor of agathys': 'Armor of Agathys [2024]',
  'arms of hadar': 'Arms of Hadar [2024]', 'astral projection': 'Astral Projection [2024]',
  'augury': 'Augury [2024]', 'aura of purity': 'Aura of Purity [2024]', 'awaken': 'Awaken [2024]',
  'bane': 'Bane [2024]', 'banishing smite': 'Banishing Smite [2024]', 'banishment': 'Banishment [2024]',
  'barkskin': 'Barkskin [2024]', 'beacon of hope': 'Beacon of Hope [2024]', 'beast sense': 'Beast Sense [2024]',
  'befuddlement': 'Befuddlement [2024]', 'bestow curse': 'Bestow Curse [2024]',
  'chill touch': 'Chill Touch [2024]', 'contact other plane': 'Contact Other Plane [2024]',
  "drawmij's instant summons": "Drawmij's Instant Summons [2024]", 'eldritch blast': 'Eldritch Blast [2024]',
  'elementalism': 'Elementalism [2024]', 'invisibility': 'Invisibility [2024]',
  "jallarzi's storm of radiance": "Jallarzi's Storm of Radiance [2024]", 'plane shift': 'Plane Shift [2024]',
  'polymorph': 'Polymorph [2024]', 'shapechange': 'Shapechange [2024]',
  // 13 needing text-normalization (trailing periods, nested parens, leading stray
  // punctuation, literal backslash-slash, official-content typos) - see the
  // investigation report for how each was confirmed.
  'fire bolt': 'Fire Bolt [2024]',                 // ".fire bolt" (stray leading period)
  'blindness/deafness': 'Blindness/Deafness [2024]', // literal "\/" in source text
  'cure wounds': 'Cure Wounds [2024]',             // "cure wounds (at 3rd level" - see one-off fix below too
  'detect good and evil': 'Detect Evil and Good [2024]', // word-order typo, confirmed in original XML - key is the GARBLED text as it actually appears
  'enlarge/reduce': 'Enlarge/Reduce [2024]',
  'hallow spell': 'Hallow [2024]',                  // key is the GARBLED text as it actually appears ("hallow" + redundant " spell")
  "otiluke's freezing sphere": "Otiluke's Freezing Sphere [2024]", // nested parens
  'ray of frost': 'Ray of Frost [2024]',            // trailing period
  'seeming': 'Seeming [2024]',                      // trailing period
  'speak with plants': 'Speak with Plants [2024]', // "speak with plant" - pluralization typo, confirmed in original XML
  'suggestion': 'Suggestion [2024]',                // trailing period
  'true seeing': 'True Seeing [2024]',              // trailing period
  'dispel magic': 'Dispel Magic [2024]',            // half of the "dispel magic.faerie fire" merge
  'faerie fire': 'Faerie Fire [2024]',              // other half of that merge
  'thunderwave': 'Thunderwave [2024]',              // half of the Djinni merge
  'create food and water': 'Create Food and Water [2024]', // other half of that merge
  'revivify': 'Revivify [2024]',                    // Dermot Wurder's stranded next-line entry
}
for (const target of Object.values(REDIRECTS)) assertExists(target)
console.log(`\n${Object.keys(REDIRECTS).length} confirmed redirect keys loaded, all targets verified present.`)

// Extra cleanup: strip a leading stray period/punctuation and any trailing period,
// on top of the standard cleanSpellName() asterisk/parenthetical stripping, and
// normalize a literal backslash-escaped slash back to a plain slash. Handles nested
// parens by stripping repeatedly from the innermost outward.
// Depth-aware trailing-parenthetical stripper - handles nesting like
// "(45 (13d6) damage)", which a single-level regex ([^()]*) can't match because the
// inner "(13d6)" breaks its "no parens inside" assumption.
function stripTrailingParenthetical(s) {
  s = s.replace(/\s+$/, '')
  if (!s.endsWith(')')) return s
  let depth = 0
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++
    else if (s[i] === '(') {
      depth--
      if (depth === 0) return s.slice(0, i).replace(/\s+$/, '')
    }
  }
  return s // unbalanced - leave alone
}

function cleanSpellNameForOrphanFix(raw) {
  let s = (raw || '').trim()
  s = s.replace(/^[.\s]+/, '') // leading stray punctuation, e.g. ".fire bolt"
  s = s.replace(/\\\//g, '/')  // literal "\/" -> "/"
  let prev
  do {
    prev = s
    s = s.replace(/\*+\s*$/, '').trim()
    s = s.replace(/\.\s*$/, '').trim() // trailing period
    s = stripTrailingParenthetical(s).trim()
  } while (s !== prev)
  return s
}

function lookupRedirect(rawSegment) {
  const cleaned = cleanSpellNameForOrphanFix(rawSegment).toLowerCase()
  return REDIRECTS[cleaned] || null
}

// ── Free-text line patterns (mirrors renderer.js scanLines()) ──
const LINE_PATTERNS = [
  { re: /^cantrips?\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]*\)\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^at will\s*:\s*(.+)/i, listGroup: 1 },
  { re: /^(\d+)\/day each\s*:\s*(.+)/i, listGroup: 2 },
  { re: /^(\d+)\/day\s*:\s*(.+)/i, listGroup: 2 },
]

function splitSpellList(listStr) {
  const segments = []
  let depth = 0
  let current = ''
  for (const ch of listStr) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { segments.push(current); current = '' }
    else current += ch
  }
  if (current.trim() || segments.length) segments.push(current)
  return segments
}

let freeTextLinesChanged = 0
let freeTextRefsFixed = 0
function rewriteFreeText(text, ownerLabel) {
  const lines = (text || '').split('\n')
  let changedAny = false
  const newLines = lines.map(raw => {
    const trimmed = raw.trim()
    for (const pat of LINE_PATTERNS) {
      const m = trimmed.match(pat.re)
      if (!m) continue
      const listPart = m[pat.listGroup]
      const prefix = trimmed.slice(0, trimmed.length - listPart.length)
      const segments = splitSpellList(listPart)
      let lineChanged = false
      const newSegments = segments.map(seg => {
        const trimmedSeg = seg.trim()
        const target = lookupRedirect(trimmedSeg)
        if (!target) return trimmedSeg
        const cleaned = cleanSpellNameForOrphanFix(trimmedSeg)
        const cleanedIdx = trimmedSeg.toLowerCase().indexOf(cleaned.toLowerCase())
        // Reconstruct: target name + whatever TRAILING annotation surrounded the
        // original name (parenthetical, asterisk, sentence period - all legitimate
        // content). Anything stripped from the FRONT is only ever stray leading
        // punctuation (see cleanSpellNameForOrphanFix's /^[.\s]+/ rule) - never
        // meaningful content - so it's always discarded, never preserved.
        const after = cleanedIdx >= 0 ? trimmedSeg.slice(cleanedIdx + cleaned.length) : ''
        lineChanged = true
        freeTextRefsFixed++
        return (target + after).trim()
      })
      if (lineChanged) { changedAny = true; freeTextLinesChanged++ }
      return prefix + newSegments.join(', ')
    }
    return raw
  })
  if (changedAny && !APPLY) console.log(`  [DRY RUN] ${ownerLabel}: would rewrite ${lines.length > 1 ? 'a line' : 'text'}`)
  return newLines.join('\n')
}

let selectedSpellsFixed = 0
function fixSelectedSpells(owner) {
  if (!Array.isArray(owner.selectedSpells)) return
  for (const sp of owner.selectedSpells) {
    const target = lookupRedirect(sp.name || '')
    if (target && sp.name !== target) { sp.name = target; selectedSpellsFixed++ }
  }
}

let flatSpellsFixed = 0
function fixFlatSpellsString(str) {
  const segs = splitSpellList(str).map(s => s.trim()).filter(Boolean)
  const newSegs = segs.map(seg => {
    const target = lookupRedirect(seg)
    if (!target) return seg
    flatSpellsFixed++
    return target
  })
  return newSegs.join(',')
}
function fixFlatSpellsArray(arr) {
  return arr.map(entry => {
    const isObj = typeof entry !== 'string'
    const name = isObj ? entry?.name : entry
    const target = lookupRedirect(name || '')
    if (!target) return entry
    flatSpellsFixed++
    return isObj ? { ...entry, name: target } : target
  })
}

const ACTION_FIELDS = ['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']
function fixOwner(owner, label) {
  fixSelectedSpells(owner)
  if (typeof owner.spells === 'string' && owner.spells) owner.spells = fixFlatSpellsString(owner.spells)
  if (Array.isArray(owner.spells)) owner.spells = fixFlatSpellsArray(owner.spells)
  for (const field of ACTION_FIELDS) {
    for (const a of (owner[field] || [])) {
      if (!/spellcast/i.test(a.name || '')) continue
      a.text = rewriteFreeText(a.text, `${label} :: ${field}.${a.name}`)
    }
  }
}

for (const m of compendium.monsters) fixOwner(m, m.name)
for (const campName of Object.keys(campaigns)) {
  const c = campaigns[campName]
  for (const npc of (c.npcs || [])) fixOwner(npc, `${campName}::${npc.properName || npc.name}`)
  for (const pc of (c.players || [])) fixOwner(pc, `${campName}::${pc.properName || pc.name || pc.label}`)
}

// ── One-off structural fixes (not simple name substitution) ──
let oneOffFixes = []

// Dermot Wurder (Tier 3): the raw text is "...cure wounds (at 3rd level\n\n)1/day:
// revivify" - an unbalanced "(" with no closing paren on that line at all, so the
// generic pass's cleaner (which only strips a BALANCED trailing parenthetical) can't
// match "cure wounds (at 3rd level" and leaves it untouched. It also stranded
// "1/day: revivify" starting with ")" instead of a digit, making it invisible to
// scanLines() entirely. Fix the raw text directly: restore the missing ")" and put
// "1/day: revivify" on its own real line, redirecting both names at the same time.
{
  const m = compendium.monsters.find(x => x.name === 'Dermot Wurder (Tier 3)')
  if (m) {
    for (const field of ACTION_FIELDS) {
      for (const a of (m[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        if (a.text.includes('cure wounds (at 3rd level\n\n)1/day: revivify')) {
          a.text = a.text.replace(
            'cure wounds (at 3rd level\n\n)1/day: revivify',
            'Cure Wounds [2024] (at 3rd level)\n\n1/day: Revivify [2024]'
          )
          oneOffFixes.push('Dermot Wurder (Tier 3): restored stray line-break/closing paren, unstranded "1/day: Revivify [2024]"')
        }
      }
    }
  }
}

// Arrant Quill: "dispel magic.faerie fire" - a period was used instead of a comma,
// merging two spell names into one unrecognizable segment. The generic pass above
// can't split this (it's one segment to the line-scanner), so fix the raw text
// directly: insert the missing comma before the generic redirect pass would have run.
// (Handled here explicitly since the merge itself, not just the name, needs fixing.)
{
  const m = compendium.monsters.find(x => x.name === 'Arrant Quill')
  if (m) {
    for (const field of ACTION_FIELDS) {
      for (const a of (m[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        if (a.text.includes('dispel magic.faerie fire')) {
          a.text = a.text.replace('dispel magic.faerie fire', 'Dispel Magic [2024], Faerie Fire [2024]')
          oneOffFixes.push('Arrant Quill: split merged "dispel magic.faerie fire" into two spells')
        }
      }
    }
  }
}

// Djinni: "thunderwave 3/day each: create food and water (can create wine instead of
// water)" - missing separator merged an "At will" entry with the start of a whole new
// "3/day each:" section onto one line. Split it into two proper lines.
{
  const m = compendium.monsters.find(x => x.name === 'Djinni')
  if (m) {
    for (const field of ACTION_FIELDS) {
      for (const a of (m[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        if (a.text.includes('thunderwave 3/day each: create food and water (can create wine instead of water)')) {
          a.text = a.text.replace(
            'thunderwave 3/day each: create food and water (can create wine instead of water)',
            'Thunderwave [2024]\n\n3/day each: Create Food and Water [2024] (can create wine instead of water)'
          )
          oneOffFixes.push('Djinni: split merged "thunderwave 3/day each: create food and water..." into a proper At-will entry plus its own 3/day each: line')
        }
      }
    }
  }
}

// Ssendam, Lord Of Madness: "power word (any)" is ambiguous shorthand for two
// specific spells (confirmed via the original XML's structured <spells> field:
// Power Word Kill + Power Word Stun). Per explicit decision, list both.
{
  assertExists('Power Word Kill [2024]')
  assertExists('Power Word Stun [2024]')
  const m = compendium.monsters.find(x => x.name === 'Ssendam, Lord Of Madness')
  if (m) {
    for (const field of ACTION_FIELDS) {
      for (const a of (m[field] || [])) {
        if (!/spellcast/i.test(a.name || '')) continue
        if (a.text.includes('power word (any)')) {
          a.text = a.text.replace('power word (any)', 'Power Word Kill [2024], Power Word Stun [2024]')
          oneOffFixes.push('Ssendam, Lord Of Madness: resolved "power word (any)" into Power Word Kill [2024] + Power Word Stun [2024]')
        }
      }
    }
  } else {
    throw new Error('Ssendam, Lord Of Madness not found - aborting before writing anything')
  }
}

console.log(`\n=== Summary ===`)
console.log(`selectedSpells entries redirected: ${selectedSpellsFixed}`)
console.log(`Flat .spells field entries redirected: ${flatSpellsFixed}`)
console.log(`Free-text Spellcasting references redirected: ${freeTextRefsFixed} (across ${freeTextLinesChanged} lines)`)
console.log(`One-off structural fixes applied: ${oneOffFixes.length}`)
oneOffFixes.forEach(f => console.log(`  - ${f}`))

if (process.argv.includes('--debug-samples')) {
  const names = ['Adult Brass Dragon [2024]', 'Cryonax', 'Siren', 'Pirate Deck Wizard', 'Ssendam, Lord Of Madness', 'Dermot Wurder (Tier 3)', 'Arrant Quill', 'Djinni', 'Goblin Hexer [2024]', 'Navid', 'Baalzebul', 'Forsworn', 'Tarul Var']
  console.log(`\n=== DEBUG SAMPLES (in-memory, post-fix) ===`)
  for (const name of names) {
    const m = compendium.monsters.find(x => x.name === name)
    if (!m) { console.log(`${name}: NOT FOUND`); continue }
    const sc = (m.actions || []).find(a => /spellcast/i.test(a.name)) || (m.traits || []).find(a => /spellcast/i.test(a.name))
    console.log(`\n--- ${name} ---`)
    console.log(sc ? sc.text : '(no spellcasting entry)')
  }
}

if (!APPLY) {
  console.log(`\nDry run complete - no files written. Re-run with --apply to write for real.`)
  process.exit(0)
}

function snapshotFile(srcPath, label) {
  const dir = path.join(DATA_DIR, 'snapshots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(dir, `${label}-${stamp}.json`)
  fs.copyFileSync(srcPath, dest)
  return dest
}

// NOTE: snapshots must be taken from the ORIGINAL on-disk files, so this script
// re-reads them fresh here rather than snapshotting the in-memory (already-mutated)
// objects above.
const compendiumSnapshotPath = snapshotFile(COMPENDIUM_PATH, 'pre-orphan-spell-fix-compendium')
const campaignsSnapshotPath = snapshotFile(CAMPAIGNS_PATH, 'pre-orphan-spell-fix-campaigns')
console.log(`\nSnapshots written:\n  ${compendiumSnapshotPath}\n  ${campaignsSnapshotPath}`)

fs.writeFileSync(COMPENDIUM_PATH, JSON.stringify(compendium), 'utf8')
fs.writeFileSync(CAMPAIGNS_PATH, JSON.stringify(campaigns), 'utf8')
console.log(`\nWrote updated compendium.json and campaigns.json.`)
