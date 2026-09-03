export interface Position {
  line: number
  column: number
}

export interface StatementNode {
  start: Position
  end: Position & { column: number | null }
}

export interface FileDiff {
  additions: number[]
  deletions?: number[]
}

export interface ReportFile {
  path: string
  source: string
  statementMap?: Record<string, StatementNode>
  s?: Record<string, number>
  diff?: FileDiff
  [key: string]: unknown
}

export interface CoverageMetric {
  total: number
  covered: number
  skipped: number
  pct: number
}

export interface SummaryItem extends CoverageMetric {
  path: string
  change?: boolean
  changestatements?: CoverageMetric
}

export interface ReportData {
  summary?: Record<string, SummaryItem>
  files?: ReportFile[]
  generatedAt?: string
  [key: string]: unknown
}

export interface ChangeStatementInfo {
  id: string
  startLine: number
  endLine: number
  startCol: number
  endCol: number | null
  count: number
  isCovered: boolean
}

export interface ChangeStatementResult {
  total: number
  covered: number
  pct: number
  statements: ChangeStatementInfo[]
}

export interface CodeLine {
  lineNumber: number
  text: string
  isAdded: boolean
}

export interface ChangeCodeBlock {
  startLine: number
  endLine: number
  lines: CodeLine[]
}
