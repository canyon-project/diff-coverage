import { useEffect, useMemo, useState } from 'react'
import { extractChangeBlocks, expandBlocksForStatements, filterBlocksWithUncovered } from './helpers/changeBlocks'
import {
  calcChangeStatements,
  formatStatementLocation,
  getUncoveredChangeStatements,
  matchFilePath,
} from './helpers/changeStatements'
import {
  isLineInUncoveredStatement,
  renderStatementSegments,
} from './helpers/renderLine'
import type { ChangeCodeBlock, ChangeStatementInfo, ReportData, ReportFile } from './types'

export interface DiffCoverageReportProps {
  data: ReportData | ReportFile[]
  contextLines?: number
  defaultPath?: string
  defaultOnlyUncovered?: boolean
  height?: string | number
}

interface FileEntry {
  file: ReportFile
  stats: ReturnType<typeof calcChangeStatements>
  uncoveredStatements: ChangeStatementInfo[]
}

function normalizeFiles(data: ReportData | ReportFile[]) {
  return Array.isArray(data) ? data : (data.files ?? [])
}

function getChangedFiles(files: ReportFile[]) {
  return files.filter(file => (file.diff?.additions?.length ?? 0) > 0)
}

function formatPercent(covered: number, total: number) {
  if (total === 0) return '100%'
  return `${Math.round((covered / total) * 10000) / 100}%`
}

function buildFileEntries(files: ReportFile[]): FileEntry[] {
  return files.map(file => {
    const additions = file.diff?.additions ?? []
    const stats = calcChangeStatements(file, additions)
    return {
      file,
      stats,
      uncoveredStatements: getUncoveredChangeStatements(stats),
    }
  })
}

function CodeBlockView({
  block,
  uncoveredStatements,
}: {
  block: ChangeCodeBlock
  uncoveredStatements: ChangeStatementInfo[]
}) {
  return (
    <div className="dcc-code-block">
      <div className="dcc-code-block-meta">
        L{block.startLine}
        –
        L{block.endLine}
      </div>
      <pre className="dcc-code">
        {block.lines.map(line => {
          const hasUncoveredStatement = isLineInUncoveredStatement(
            line.lineNumber,
            uncoveredStatements,
          )
          const segments = hasUncoveredStatement
            ? renderStatementSegments(line.text, line.lineNumber, uncoveredStatements)
            : [{ text: line.text, uncovered: false }]

          return (
            <div key={line.lineNumber} className="dcc-line">
              <span
                className={[
                  'dcc-line-sign',
                  line.isAdded ? 'dcc-line-sign--added' : '',
                ].join(' ')}
                aria-hidden="true"
              >
                {line.isAdded ? '+' : ''}
              </span>
              <span className="dcc-line-number">{line.lineNumber}</span>
              <code className="dcc-line-content">
                {segments.map((segment, index) =>
                  segment.uncovered
                    ? (
                        <mark key={index} className="dcc-uncovered">
                          {segment.text || ' '}
                        </mark>
                      )
                    : (
                        <span key={index}>{segment.text || ' '}</span>
                      ),
                )}
              </code>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

function FileDetail({
  file,
  contextLines,
  onlyUncovered,
}: {
  file: ReportFile
  contextLines: number
  onlyUncovered: boolean
}) {
  const additions = file.diff?.additions ?? []
  const changeStats = useMemo(
    () => calcChangeStatements(file, additions),
    [file, additions],
  )
  const uncoveredStatements = useMemo(
    () => getUncoveredChangeStatements(changeStats),
    [changeStats],
  )
  const blocks = useMemo(() => {
    const allBlocks = extractChangeBlocks(file.source, additions, contextLines)
    const visibleBlocks = onlyUncovered
      ? filterBlocksWithUncovered(allBlocks, uncoveredStatements)
      : allBlocks

    return expandBlocksForStatements(
      visibleBlocks,
      file.source,
      additions,
      changeStats.statements,
      contextLines,
    )
  }, [file.source, additions, contextLines, onlyUncovered, uncoveredStatements, changeStats.statements])

  if (additions.length === 0) {
    return <div className="dcc-empty">该文件没有新增行</div>
  }

  if (onlyUncovered && uncoveredStatements.length === 0) {
    return <div className="dcc-empty">该文件没有未覆盖的新增语句</div>
  }

  return (
    <div className="dcc-file-detail">
      <div className="dcc-file-summary">
        <span className="dcc-file-path">{file.path}</span>
        <span className="dcc-file-stats">
          变更语句覆盖率：
          {formatPercent(changeStats.covered, changeStats.total)}
          {' '}
          (
          {changeStats.covered}
          /
          {changeStats.total}
          )
          {uncoveredStatements.length > 0 && (
            <span className="dcc-uncovered-count">
              ，未覆盖
              {uncoveredStatements.length}
              处
            </span>
          )}
        </span>
      </div>

      {uncoveredStatements.length > 0 && (
        <div className="dcc-uncovered-list">
          <div className="dcc-uncovered-list-title">未覆盖语句位置</div>
          <ul className="dcc-uncovered-list-items">
            {uncoveredStatements.map(statement => (
              <li key={statement.id} className="dcc-uncovered-list-item">
                {formatStatementLocation(statement)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blocks.length === 0
        ? (
            <div className="dcc-empty">
              {onlyUncovered ? '没有未覆盖相关的变更代码块' : '没有可展示的变更代码块'}
            </div>
          )
        : blocks.map(block => (
            <CodeBlockView
              key={`${block.startLine}-${block.endLine}`}
              block={block}
              uncoveredStatements={uncoveredStatements}
            />
          ))}
    </div>
  )
}

export function DiffCoverageReport({
  data,
  contextLines = 3,
  defaultPath,
  defaultOnlyUncovered = true,
  height = '100vh',
}: DiffCoverageReportProps) {
  const files = useMemo(() => getChangedFiles(normalizeFiles(data)), [data])
  const fileEntries = useMemo(() => buildFileEntries(files), [files])
  const [selectedPath, setSelectedPath] = useState(
    () => defaultPath ?? files[0]?.path ?? '',
  )
  const [fileFilter, setFileFilter] = useState('')
  const [onlyUncovered, setOnlyUncovered] = useState(defaultOnlyUncovered)

  const visibleEntries = useMemo(() => {
    return fileEntries.filter(entry => {
      if (onlyUncovered && entry.uncoveredStatements.length === 0) {
        return false
      }
      return matchFilePath(entry.file.path, fileFilter)
    })
  }, [fileEntries, onlyUncovered, fileFilter])

  useEffect(() => {
    if (visibleEntries.length === 0) return
    if (!visibleEntries.some(entry => entry.file.path === selectedPath)) {
      setSelectedPath(visibleEntries[0]!.file.path)
    }
  }, [visibleEntries, selectedPath])

  const overallStats = useMemo(() => {
    let total = 0
    let covered = 0
    for (const entry of fileEntries) {
      total += entry.stats.total
      covered += entry.stats.covered
    }
    return { total, covered }
  }, [fileEntries])

  const selectedFile = visibleEntries.find(entry => entry.file.path === selectedPath)?.file
    ?? visibleEntries[0]?.file

  if (files.length === 0) {
    return <div className="dcc-root dcc-empty">没有包含变更的文件</div>
  }

  return (
    <div className="dcc-root" style={{ height }}>
      <div className="dcc-body">
        <aside className="dcc-sidebar">
          <div className="dcc-sidebar-summary">
            <h1 className="dcc-title">变更语句覆盖率</h1>
            <p className="dcc-overall">
              总计
              {' '}
              {formatPercent(overallStats.covered, overallStats.total)}
              {' '}
              (
              {overallStats.covered}
              /
              {overallStats.total}
              )
            </p>
          </div>

          <div className="dcc-sidebar-tools">
            <input
              type="search"
              className="dcc-file-filter"
              placeholder="筛选文件路径..."
              value={fileFilter}
              onChange={event => setFileFilter(event.target.value)}
            />
            <label className="dcc-toggle">
              <input
                type="checkbox"
                checked={onlyUncovered}
                onChange={event => setOnlyUncovered(event.target.checked)}
              />
              <span>只显示未覆盖</span>
            </label>
          </div>

          {visibleEntries.length === 0
            ? (
                <div className="dcc-sidebar-empty">
                  {onlyUncovered ? '没有未覆盖的文件' : '没有匹配的文件'}
                </div>
              )
            : (
                <ul className="dcc-file-list">
                  {visibleEntries.map(({ file, stats, uncoveredStatements }) => {
                    const uncoveredCount = uncoveredStatements.length
                    return (
                      <li key={file.path}>
                        <button
                          type="button"
                          className={[
                            'dcc-file-item',
                            selectedFile?.path === file.path ? 'dcc-file-item--active' : '',
                          ].join(' ')}
                          onClick={() => setSelectedPath(file.path)}
                        >
                          <span className="dcc-file-item-name">{file.path}</span>
                          <span className="dcc-file-item-stats">
                            {formatPercent(stats.covered, stats.total)}
                            {uncoveredCount > 0 && (
                              <span className="dcc-file-item-uncovered">
                                {' '}
                                ·
                                {uncoveredCount}
                                未覆盖
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
        </aside>

        <main className="dcc-main">
          {selectedFile
            ? (
                <FileDetail
                  file={selectedFile}
                  contextLines={contextLines}
                  onlyUncovered={onlyUncovered}
                />
              )
            : (
                <div className="dcc-empty">请选择文件</div>
              )}
        </main>
      </div>
    </div>
  )
}

export default DiffCoverageReport
