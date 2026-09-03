import type { ChangeStatementInfo } from '../types'

export interface LineSegment {
  text: string
  uncovered: boolean
}

function getStatementRangeOnLine(
  lineText: string,
  lineNumber: number,
  statement: ChangeStatementInfo,
) {
  if (lineNumber < statement.startLine || lineNumber > statement.endLine) {
    return null
  }

  const lineLength = lineText.length

  if (statement.startLine === statement.endLine) {
    const endCol = resolveEndColumn(
      lineText,
      statement.startCol,
      statement.endCol,
      true,
    )
    return {
      startCol: statement.startCol,
      endCol,
    }
  }

  if (lineNumber === statement.startLine) {
    return {
      startCol: statement.startCol,
      endCol: lineLength,
    }
  }

  if (lineNumber === statement.endLine) {
    return {
      startCol: 0,
      endCol: resolveEndColumn(lineText, 0, statement.endCol, false),
    }
  }

  return {
    startCol: 0,
    endCol: lineLength,
  }
}

function resolveEndColumn(
  lineText: string,
  startCol: number,
  endCol: number | null,
  sameLine: boolean,
) {
  const lineLength = lineText.length

  if (endCol == null) {
    return lineLength
  }

  if (sameLine && startCol > endCol) {
    return lineLength
  }

  return endCol + 1
}

function mergeRanges(ranges: Array<{ startCol: number; endCol: number }>) {
  if (ranges.length === 0) return []

  const sorted = [...ranges].sort((a, b) => a.startCol - b.startCol)
  const merged: Array<{ startCol: number; endCol: number }> = [sorted[0]!]

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!
    const previous = merged[merged.length - 1]!

    if (current.startCol <= previous.endCol) {
      previous.endCol = Math.max(previous.endCol, current.endCol)
    }
    else {
      merged.push(current)
    }
  }

  return merged
}

export function renderStatementSegments(
  lineText: string,
  lineNumber: number,
  uncoveredStatements: ChangeStatementInfo[],
): LineSegment[] {
  const ranges = mergeRanges(
    uncoveredStatements
      .map(statement => getStatementRangeOnLine(lineText, lineNumber, statement))
      .filter((range): range is { startCol: number; endCol: number } => range !== null),
  )

  if (ranges.length === 0) {
    return [{ text: lineText, uncovered: false }]
  }

  const segments: LineSegment[] = []
  let pos = 0

  for (const range of ranges) {
    const safeStart = Math.max(0, Math.min(range.startCol, lineText.length))
    const safeEnd = Math.max(safeStart, Math.min(range.endCol, lineText.length))

    if (pos < safeStart) {
      segments.push({ text: lineText.slice(pos, safeStart), uncovered: false })
    }
    if (safeStart < safeEnd) {
      segments.push({ text: lineText.slice(safeStart, safeEnd), uncovered: true })
    }
    pos = Math.max(pos, safeEnd)
  }

  if (pos < lineText.length) {
    segments.push({ text: lineText.slice(pos), uncovered: false })
  }

  return segments.length > 0 ? segments : [{ text: lineText, uncovered: false }]
}

export function isLineInUncoveredStatement(
  lineNumber: number,
  uncoveredStatements: ChangeStatementInfo[],
) {
  return uncoveredStatements.some(
    statement => lineNumber >= statement.startLine && lineNumber <= statement.endLine,
  )
}
