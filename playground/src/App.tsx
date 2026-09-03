import { DiffCoverageReport } from '../../src'
import reportData from '../../data/report-data.json'
import '../../src/style.css'
import './style.css'

export function App() {
  return (
    <DiffCoverageReport
      data={reportData}
      height="100vh"
      contextLines={3}
    />
  )
}
