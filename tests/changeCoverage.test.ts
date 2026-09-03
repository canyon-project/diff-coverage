import { describe, expect, it } from 'vitest'
import { expandBlocksForStatements, extractChangeBlocks, filterBlocksWithUncovered } from '../src/helpers/changeBlocks'
import { calcChangeStatements, formatStatementLocation, getAdditionLinesForStatements, matchFilePath } from '../src/helpers/changeStatements'
import { isLineInUncoveredStatement, renderStatementSegments } from '../src/helpers/renderLine'
import type { ReportFile } from '../src/types'

const sampleFile: ReportFile = {
  path: 'example.ts',
  source: [
    'line1',
    'line2',
    'line3',
    'line4',
    'line5',
    'line6',
    'line7',
    'line8',
    'line9',
    'line10',
  ].join('\n'),
  statementMap: {
    '0': {
      start: { line: 4, column: 2 },
      end: { line: 4, column: 10 },
    },
    '1': {
      start: { line: 5, column: 2 },
      end: { line: 5, column: 10 },
    },
  },
  s: {
    '0': 1,
    '1': 0,
  },
  diff: {
    additions: [4, 5],
  },
}

describe('calcChangeStatements', () => {
  it('counts only statements impacted by added lines', () => {
    const result = calcChangeStatements(sampleFile, sampleFile.diff!.additions)

    expect(result.total).toBe(2)
    expect(result.covered).toBe(1)
    expect(result.pct).toBe(50)
    expect(result.statements.find(item => item.id === '1')?.isCovered).toBe(false)
  })
})

describe('extractChangeBlocks', () => {
  it('returns changed ranges with surrounding context', () => {
    const blocks = extractChangeBlocks(sampleFile.source, [4, 5], 2)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.startLine).toBe(2)
    expect(blocks[0]?.endLine).toBe(7)
    expect(blocks[0]?.lines.filter(line => line.isAdded).map(line => line.lineNumber)).toEqual([4, 5])
  })
})

describe('filterBlocksWithUncovered', () => {
  it('keeps blocks with uncovered statements and preserves all added lines in block', () => {
    const file: ReportFile = {
      ...sampleFile,
      statementMap: {
        '0': { start: { line: 4, column: 0 }, end: { line: 4, column: 5 } },
        '1': { start: { line: 5, column: 0 }, end: { line: 5, column: 5 } },
        '2': { start: { line: 6, column: 0 }, end: { line: 6, column: 5 } },
      },
      s: { '0': 1, '1': 1, '2': 0 },
      diff: { additions: [4, 5, 6] },
    }

    const stats = calcChangeStatements(file, file.diff!.additions)
    const uncovered = stats.statements.filter(item => !item.isCovered)
    const allBlocks = extractChangeBlocks(file.source, file.diff!.additions, 1)
    const blocks = filterBlocksWithUncovered(allBlocks, uncovered)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.lines.filter(line => line.isAdded).map(line => line.lineNumber)).toEqual([4, 5, 6])
  })
})

describe('getAdditionLinesForStatements', () => {
  it('returns only addition lines touched by given statements', () => {
    const stats = calcChangeStatements(sampleFile, sampleFile.diff!.additions)
    const lines = getAdditionLinesForStatements(stats.statements, sampleFile.diff!.additions)

    expect(lines).toEqual([4, 5])
  })
})

describe('matchFilePath', () => {
  it('matches file path by keyword', () => {
    expect(matchFilePath('src/foo/bar.ts', 'foo')).toBe(true)
    expect(matchFilePath('src/foo/bar.ts', 'baz')).toBe(false)
    expect(matchFilePath('src/foo/bar.ts', '')).toBe(true)
  })
})

describe('formatStatementLocation', () => {
  it('formats single-line and multi-line statement ranges', () => {
    expect(formatStatementLocation({
      startLine: 19,
      endLine: 19,
      startCol: 4,
      endCol: 10,
    })).toBe('L19 C5 - L19 C11')

    expect(formatStatementLocation({
      startLine: 19,
      endLine: 24,
      startCol: 4,
      endCol: 9,
    })).toBe('L19 C5 - L24 C10')

    expect(formatStatementLocation({
      startLine: 18,
      endLine: 34,
      startCol: 2,
      endCol: null,
    })).toBe('L18 C3 - L34')
  })
})

describe('expandBlocksForStatements', () => {
  it('expands block range to cover the full related statement span', () => {
    const source = [
      'line1',
      'line2',
      'line3',
      'line4',
      'line5',
      'line6',
      'line7',
      'line8',
      'line9',
      'line10',
      'line11',
      'line12',
    ].join('\n')

    const file: ReportFile = {
      path: 'long.ts',
      source,
      statementMap: {
        '0': { start: { line: 2, column: 0 }, end: { line: 9, column: null } },
      },
      s: { '0': 0 },
      diff: { additions: [8] },
    }

    const stats = calcChangeStatements(file, file.diff!.additions)
    const baseBlocks = extractChangeBlocks(source, [8], 1)
    const expanded = expandBlocksForStatements(
      baseBlocks,
      source,
      file.diff!.additions,
      stats.statements,
      1,
    )

    expect(baseBlocks[0]?.startLine).toBe(7)
    expect(expanded[0]?.startLine).toBe(1)
    expect(expanded[0]?.endLine).toBe(10)
    expect(isLineInUncoveredStatement(2, stats.statements)).toBe(true)
    expect(isLineInUncoveredStatement(9, stats.statements)).toBe(true)
  })
})

describe('renderStatementSegments', () => {
  it('marks the exact statement range on a single line', () => {
    const stats = calcChangeStatements(sampleFile, sampleFile.diff!.additions)
    const uncovered = stats.statements.filter(item => !item.isCovered)
    const segments = renderStatementSegments('  uncovered code', 5, uncovered)

    expect(segments).toEqual([
      { text: '  ', uncovered: false },
      { text: 'uncovered', uncovered: true },
      { text: ' code', uncovered: false },
    ])
  })

  it('marks the full multi-line statement range from start to end positions', () => {
    const file: ReportFile = {
      ...sampleFile,
      source: 'a\n  if (x) {\n    doWork();\n  }\ne',
      statementMap: {
        '0': {
          start: { line: 2, column: 2 },
          end: { line: 4, column: null },
        },
      },
      s: { '0': 0 },
      diff: { additions: [2, 3, 4] },
    }

    const uncovered = calcChangeStatements(file, file.diff!.additions).statements

    expect(isLineInUncoveredStatement(2, uncovered)).toBe(true)
    expect(renderStatementSegments('  if (x) {', 2, uncovered)).toEqual([
      { text: '  ', uncovered: false },
      { text: 'if (x) {', uncovered: true },
    ])
    expect(renderStatementSegments('    doWork();', 3, uncovered)).toEqual([
      { text: '    doWork();', uncovered: true },
    ])
    expect(renderStatementSegments('  }', 4, uncovered)).toEqual([
      { text: '  }', uncovered: true },
    ])
  })
})
