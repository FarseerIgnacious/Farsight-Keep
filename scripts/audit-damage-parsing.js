#!/usr/bin/env node
// Read-only audit: scans every monster action in compendium.json for damage-dice
// text that isn't fully captured by the structured `attack` field — the same class
// of gap fixed for Githyanki Dracomancer's "Conjured Dragon's Breath" (see
// extractPlusClause()/parseAttackFromText()/getBlocks() in renderer.js). Never
// writes to the compendium; this only prints/optionally dumps a report.
//
// The regex here intentionally mirrors extractPlusClause() in renderer.js — this
// script can't require() renderer.js directly (it references `electron`/`document`
// at load time via storage.js), so keep the two in sync by hand if that regex changes.
//
// Usage: node scripts/audit-damage-parsing.js [path-to-compendium.json] [--json out.json]

const fs = require('fs')
const os = require('os')
const path = require('path')

function resolveDefaultCompendiumPath() {
  const productName = 'Farsight Keep' // package.json build.productName
  const candidates = []
  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', productName, 'compendium.json'))
  } else if (process.platform === 'win32') {
    candidates.push(path.join(process.env.APPDATA || '', productName, 'compendium.json'))
  } else {
    candidates.push(path.join(os.homedir(), '.config', productName, 'compendium.json'))
  }
  // Legacy pre-migration location (see storage.js migrateLegacyData())
  candidates.push(path.join(os.homedir(), '.dm-companion', 'compendium.json'))
  return candidates.find(p => fs.existsSync(p)) || candidates[0]
}

const ACTION_FIELDS = ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions']

// A single parenthesized dice-damage clause, e.g. "(6d8) Fire damage".
const DICE_CLAUSE_RE = /\(\s*(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s*\)\s*([A-Za-z]+)?\s*damage/gi

// Classify each dice clause found in an action's text as 'primary', 'alt' (preceded
// by ", or") or 'plus' (preceded by "plus") — mirrors the three patterns handled in
// renderer.js (parseAttackFromText Patterns 2/4/5, getBlocks).
function findDamageClauses(text) {
  const clauses = []
  let m
  DICE_CLAUSE_RE.lastIndex = 0
  while ((m = DICE_CLAUSE_RE.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 20), m.index)
    let kind = 'primary'
    if (/\bor\s+\d+\s*$/i.test(before)) kind = 'alt'
    else if (/\bplus\s+\d+\s*$/i.test(before)) kind = 'plus'
    clauses.push({ dice: m[1], type: (m[2] || '').toLowerCase(), kind, index: m.index })
  }
  return clauses
}

function auditMonster(monster, findings) {
  for (const field of ACTION_FIELDS) {
    for (const action of monster[field] || []) {
      const text = action.text || ''
      const clauses = findDamageClauses(text)
      if (!clauses.length) continue

      const hasPlus = clauses.some(c => c.kind === 'plus')
      const attack = action.attack

      // Gap A: no structured attack at all, but text has damage dice.
      if (!attack) {
        findings.gapA.push({ monster: monster.name, action: action.name, text, hasPlus })
      }

      // Gap B: structured attack exists, but a "plus" clause in the text isn't
      // reflected in attack.additionalDiceCount.
      if (attack && hasPlus && !attack.additionalDiceCount) {
        findings.gapB.push({ monster: monster.name, action: action.name, text })
      }

      // Gap C (same class, different pattern): an "or" alt clause exists but isn't
      // reflected in attack.altDiceCount.
      const hasAlt = clauses.some(c => c.kind === 'alt')
      if (attack && hasAlt && !attack.altDiceCount) {
        findings.gapC.push({ monster: monster.name, action: action.name, text })
      }
    }
  }
}

function main() {
  const argPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
  const compendiumPath = argPath || resolveDefaultCompendiumPath()
  const outFlagIdx = process.argv.indexOf('--json')
  const outPath = outFlagIdx >= 0 ? process.argv[outFlagIdx + 1] : null

  console.log(`Reading ${compendiumPath} ...`)
  const data = JSON.parse(fs.readFileSync(compendiumPath, 'utf8'))
  const monsters = data.monsters || []

  const findings = { gapA: [], gapB: [], gapC: [] }
  monsters.forEach(m => auditMonster(m, findings))

  const gapAWithPlus = findings.gapA.filter(f => f.hasPlus)
  const affectedMonsters = new Set([
    ...gapAWithPlus.map(f => f.monster),
    ...findings.gapB.map(f => f.monster)
  ])

  console.log(`\nScanned ${monsters.length} monsters.\n`)
  console.log(`Gap A — no structured attack, text has damage dice (mostly benign; these`)
  console.log(`        are recovered lazily via recoverAttackData() when added to an`)
  console.log(`        encounter): ${findings.gapA.length} actions`)
  console.log(`  of which STILL broken even after recovery (2nd "plus" clause dropped): ${gapAWithPlus.length}`)
  console.log(`Gap B — structured attack exists but drops a "plus" continuation clause: ${findings.gapB.length} actions`)
  console.log(`Gap C — structured attack exists but drops an "or" alternate clause: ${findings.gapC.length} actions`)
  console.log(`\nTotal distinct monsters needing attention: ${affectedMonsters.size}`)

  console.log('\n--- High-priority findings (Gap A-with-plus + Gap B) ---')
  ;[...gapAWithPlus, ...findings.gapB].forEach(f => {
    console.log(`- ${f.monster} :: ${f.action}\n    ${f.text.slice(0, 140)}`)
  })

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(findings, null, 2), 'utf8')
    console.log(`\nFull findings written to ${outPath}`)
  }
}

main()
