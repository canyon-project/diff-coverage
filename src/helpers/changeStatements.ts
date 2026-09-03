import type { ChangeStatementInfo, ChangeStatementResult, ReportFile, StatementNode } from '../types'

function getLineRange(node: StatementNode) {
  const startLine = node.start.line
  const endLine = node.end.line
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return null
  return {
    startLine,
    endLine,
    startCol: node.start.column,
    endCol: node.end.column,
  }
}

function isImpactedByAdditions(
  range: { startLine: number; endLine: number },
  additionsSet: Set<number>,
) {
  for (const line of additionsSet) {
    if (line >= range.startLine && line <= range.endLine) return true
  }
  return false
}

export function calcChangeStatements(
  file: Pick<ReportFile, 'statementMap' | 's'>,
  additions: number[],
): ChangeStatementResult {
  const statementMap = file.statementMap ?? {}
  const hits = file.s ?? {}
  const additionsSet = new Set(additions)
  const statements: ChangeStatementInfo[] = []

  for (const [id, node] of Object.entries(statementMap)) {
    const range = getLineRange(node)
    if (!range || additionsSet.size === 0) continue
    if (!isImpactedByAdditions(range, additionsSet)) continue

    const count = Number(hits[id] ?? 0)
    const isCovered = Number.isFinite(count) && count > 0
    statements.push({
      id,
      ...range,
      count: Number.isFinite(count) ? count : 0,
      isCovered,
    })
  }

  statements.sort((a, b) => a.startLine - b.startLine || a.startCol - b.startCol)

  const total = statements.length
  const covered = statements.filter(item => item.isCovered).length
  const pct = total > 0 ? Math.round((covered / total) * 10000) / 100 : 100

  return { total, covered, pct, statements }
}

export function getUncoveredChangeStatements(result: ChangeStatementResult) {
  return result.statements.filter(item => !item.isCovered)
}

export function getAdditionLinesForStatements(
  statements: ChangeStatementInfo[],
  additions: number[],
) {
  const additionsSet = new Set(additions)
  const lines = new Set<number>()

  for (const statement of statements) {
    for (let line = statement.startLine; line <= statement.endLine; line += 1) {
      if (additionsSet.has(line)) {
        lines.add(line)
      }
    }
  }

  return [...lines].sort((a, b) => a - b)
}

export function matchFilePath(path: string, query: string) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  return path.toLowerCase().includes(keyword)
}

export function formatStatementLocation(statement: {
  startLine: number
  endLine: number
  startCol: number
  endCol: number | null
}) {
  const start = `L${statement.startLine} C${statement.startCol + 1}`

  if (statement.endLine > statement.startLine) {
    const end = statement.endCol != null
      ? `L${statement.endLine} C${statement.endCol + 1}`
      : `L${statement.endLine}`
    return `${start} - ${end}`
  }

  if (statement.endCol != null && statement.endCol !== statement.startCol) {
    return `${start} - L${statement.endLine} C${statement.endCol + 1}`
  }

  return start
}

export function filterChangeCoverage(file: ReportFile, additions: number[]) {
  const additionsSet = new Set(additions)
  const statementMap = file.statementMap ?? {}
  const hits = file.s ?? {}
  const newStatementMap: Record<string, StatementNode> = {}
  const newHits: Record<string, number> = {}

  for (const [key, statement] of Object.entries(statementMap)) {
    const startLine = statement.start.line
    const endLine = statement.end.line
    for (let line = startLine; line <= endLine; line += 1) {
      if (additionsSet.has(line)) {
        newStatementMap[key] = statement
        newHits[key] = hits[key] ?? 0
        break
      }
    }
  }

  return {
    path: file.path,
    statementMap: newStatementMap,
    s: newHits,
  }
}
