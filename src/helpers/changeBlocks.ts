import type { ChangeCodeBlock, ChangeStatementInfo, CodeLine } from '../types'

function groupConsecutiveLines(lines: number[]) {
  if (lines.length === 0) return []

  const sorted = [...lines].sort((a, b) => a - b)
  const groups: Array<{ start: number; end: number }> = []
  let start = sorted[0]!
  let end = sorted[0]!

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!
    if (current === end + 1) {
      end = current
    }
    else {
      groups.push({ start, end })
      start = current
      end = current
    }
  }

  groups.push({ start, end })
  return groups
}

function buildBlockLines(
  sourceLines: string[],
  startLine: number,
  endLine: number,
  additionsSet: Set<number>,
): CodeLine[] {
  const lines: CodeLine[] = []
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    lines.push({
      lineNumber,
      text: sourceLines[lineNumber - 1] ?? '',
      isAdded: additionsSet.has(lineNumber),
    })
  }
  return lines
}

function mergeBlocks(
  blocks: ChangeCodeBlock[],
  sourceLines: string[],
  additionsSet: Set<number>,
) {
  if (blocks.length <= 1) return blocks

  const sorted = [...blocks].sort((a, b) => a.startLine - b.startLine)
  const merged: ChangeCodeBlock[] = []
  let current = sorted[0]!

  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!
    if (next.startLine <= current.endLine + 1) {
      const endLine = Math.max(current.endLine, next.endLine)
      current = {
        startLine: current.startLine,
        endLine,
        lines: buildBlockLines(sourceLines, current.startLine, endLine, additionsSet),
      }
    }
    else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

export function extractChangeBlocks(
  source: string,
  additions: number[],
  contextLines = 3,
): ChangeCodeBlock[] {
  if (additions.length === 0) return []

  const sourceLines = source.split('\n')
  const totalLines = sourceLines.length
  const additionsSet = new Set(additions)
  const groups = groupConsecutiveLines(additions)

  const blocks = groups.map(({ start, end }) => {
    const blockStart = Math.max(1, start - contextLines)
    const blockEnd = Math.min(totalLines, end + contextLines)
    return {
      startLine: blockStart,
      endLine: blockEnd,
      lines: buildBlockLines(sourceLines, blockStart, blockEnd, additionsSet),
    }
  })

  return mergeBlocks(blocks, sourceLines, additionsSet)
}

export function blockHasUncoveredStatements(
  block: ChangeCodeBlock,
  uncoveredStatements: Array<{ startLine: number; endLine: number }>,
) {
  for (const statement of uncoveredStatements) {
    for (const line of block.lines) {
      if (!line.isAdded) continue
      if (line.lineNumber >= statement.startLine && line.lineNumber <= statement.endLine) {
        return true
      }
    }
  }
  return false
}

export function filterBlocksWithUncovered(
  blocks: ChangeCodeBlock[],
  uncoveredStatements: Array<{ startLine: number; endLine: number }>,
) {
  if (uncoveredStatements.length === 0) return []
  return blocks.filter(block => blockHasUncoveredStatements(block, uncoveredStatements))
}

function statementRelatesToBlock(
  statement: { startLine: number; endLine: number },
  block: ChangeCodeBlock,
) {
  return block.lines.some(
    line => line.isAdded
      && line.lineNumber >= statement.startLine
      && line.lineNumber <= statement.endLine,
  )
}

export function expandBlockForStatements(
  block: ChangeCodeBlock,
  sourceLines: string[],
  additionsSet: Set<number>,
  statements: Array<{ startLine: number; endLine: number }>,
  contextLines = 0,
): ChangeCodeBlock {
  const related = statements.filter(statement => statementRelatesToBlock(statement, block))
  if (related.length === 0) return block

  let startLine = block.startLine
  let endLine = block.endLine

  for (const statement of related) {
    startLine = Math.min(startLine, statement.startLine)
    endLine = Math.max(endLine, statement.endLine)
  }

  startLine = Math.max(1, startLine - contextLines)
  endLine = Math.min(sourceLines.length, endLine + contextLines)

  return {
    startLine,
    endLine,
    lines: buildBlockLines(sourceLines, startLine, endLine, additionsSet),
  }
}

export function expandBlocksForStatements(
  blocks: ChangeCodeBlock[],
  source: string,
  additions: number[],
  statements: Array<{ startLine: number; endLine: number }>,
  contextLines = 0,
): ChangeCodeBlock[] {
  if (blocks.length === 0 || statements.length === 0) return blocks

  const sourceLines = source.split('\n')
  const additionsSet = new Set(additions)
  const expanded = blocks.map(block =>
    expandBlockForStatements(block, sourceLines, additionsSet, statements, contextLines),
  )

  return mergeBlocks(expanded, sourceLines, additionsSet)
}
