# diff-coverage

简单的 JavaScript 变更语句覆盖率展示组件，数据结构兼容 `data/report-data.json`（Istanbul + diff.additions）。

## 特性

- 变更语句覆盖率算法与 [canyon](https://github.com/canyon-project/canyon) 一致：语句行范围与 `diff.additions` 相交即计入变更语句
- 仅展示变更代码块及上下文行，不渲染全量文件
- 无语法高亮，仅对未覆盖语句块做 `<mark>` 标注
- 原生 CSS，样式朴素

## 使用

```tsx
import { DiffCoverageReport } from 'diff-coverage'
import 'diff-coverage/style.css'
import reportData from './report-data.json'

export function App() {
  return (
    <DiffCoverageReport
      data={reportData}
      contextLines={3}
      height="100vh"
    />
  )
}
```

`data` 可传入完整 `reportData` 对象，或 `files` 数组。

## 开发

```bash
npm install
npm run play    # 启动 playground，加载 data/report-data.json
npm test
npm run build
```

## API

### `<DiffCoverageReport />`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `data` | `ReportData \| ReportFile[]` | - | 覆盖率报告数据 |
| `contextLines` | `number` | `3` | 变更块上下各保留的上下文行数 |
| `defaultPath` | `string` | 首个变更文件 | 初始选中文件 |
| `height` | `string \| number` | `100vh` | 容器高度 |

### 工具函数

- `calcChangeStatements(file, additions)` — 计算单文件变更语句覆盖率
- `extractChangeBlocks(source, additions, contextLines)` — 提取带上下文的变更代码块
- `getUncoveredChangeStatements(result)` — 获取未覆盖的变更语句
