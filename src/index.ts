export { DiffCoverageReport, type DiffCoverageReportProps } from './DiffCoverageReport'
export {
  calcChangeStatements,
  filterChangeCoverage,
  getAdditionLinesForStatements,
  getUncoveredChangeStatements,
  formatStatementLocation,
  matchFilePath,
} from './helpers/changeStatements'
export { expandBlocksForStatements, extractChangeBlocks, filterBlocksWithUncovered } from './helpers/changeBlocks'
export {
  isLineInUncoveredStatement,
  renderStatementSegments,
  type LineSegment,
} from './helpers/renderLine'
export type {
  ChangeCodeBlock,
  ChangeStatementInfo,
  ChangeStatementResult,
  CodeLine,
  FileDiff,
  ReportData,
  ReportFile,
  SummaryItem,
} from './types'
