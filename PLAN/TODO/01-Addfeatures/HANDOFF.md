# Glx.SimpleCalculator 任务计划书（HANDOFF）

| 项 | 内容 |
|---|---|
| 文档版本 | v0.1（调研完成，待评审） |
| 编写日期 | 2026-11-19 |
| 仓库 | `E:\GitHub\Glx.SimpleCalculator` |
| 说明 | 需求中提到的 `E:\GitHub\fork\Glx.SimpleCalculator` 不存在，按实际仓库路径落盘 |
| 关联设计 | [design.md](../../UIDesign/soft-ui/design.md)（柔和界面风 soft-ui） |
| 布局参考 | 截图：Windows 计算器式布局（自定义标题栏 + 左侧模式导航栏 + 右对齐显示区 + 按键网格 / 单位转换表单） |
| 当前代码状态 | 空项目，仅 `README.md` 与设计稿，initial commit `48498a0` |
| 当前进度 | **T6 完成**（2026-11-19）：历史存储/抽屉/恢复/删除/清空/复制与设置联动；下一步 T7 |

> 本文档只做调研与规划，尚未修改任何应用代码。

---

## 0. 结论摘要（TL;DR）

1. **从零搭建**：Tauri 2 + Rust 计算内核 + React 19 + TypeScript + Vite 8。
2. **计算逻辑全部放 Rust**（独立 crate `calc-core`，不依赖 Tauri，可纯 `cargo test`），Tauri 命令层只做薄适配；前端只负责输入、展示、路由、i18n、主题。
3. **状态归属**：标准/科学/程序员/统计采用 **Rust 端有状态会话**（`CalcSession`），保证「输入 → 运算符 → 连算 → 退格」语义与 Windows 计算器一致且可测；单位/日期/工作表为**纯函数**。
4. **Node 已安装但不在 PATH**：位于 `E:\node`（Node v24.21.0 / npm 11.19.0 / corepack 可用），所有构建命令前需把 `E:\node` 加入 PATH；不引入 pnpm，统一使用 npm。
5. **两项需要先做技术验证（M0 spike）**：
   - 无边框窗口 + 自定义标题栏在 Windows 上的拖拽、双击最大化、缩放、阴影、Snap 行为；
   - 本机为 **Windows Server 2022（10.0.20348）**，**Mica 不可用**，Acrylic 需实测，必须准备纯色降级。
6. **汇率数据源已实测可用**：欧洲央行 ECB 每日 XML，HTTP 200，29 种货币（含 CNY），基准 EUR，数据日期 2026-11-18，无需 API Key。
7. 按 **T0–T19 任务表**（第 6 节）推进，任务映射到 M0–M9 里程碑，每阶段以「构建 + 测试 + 文档更新 + 可评审提交」收尾。
8. 文档内的模块边界、职责、验证方式、T 任务依赖与产物清理规则已统一口径（见 3.10、3.11、6.0、7.0、12、13 节）。

---

## 1. 调研记录（环境证据）

### 1.1 本机环境实测

| 项 | 实测结果 | 结论 |
|---|---|---|
| `rustc` / `cargo` | 1.98.1（stable-x86_64-pc-windows-msvc） | ✅ 可用 |
| Rust target | `x86_64-pc-windows-msvc` | ✅ 可用 |
| MSVC | Visual Studio 2022（另有 `18` 目录）已安装 | ✅ 可用 |
| WebView2 Runtime | 157.0.4341.46 / 157.0.4341.60 | ✅ 可用 |
| `node` / `npm` | `E:\node\node.exe` v24.21.0；npm 11.19.0；corepack 存在；**未加入 PATH** | ✅ 可用，需配置 PATH（见 1.2） |
| `pnpm` | 未安装 | 不使用；统一 npm 11 |
| `tauri-cli` | 未安装 | 用 npm devDependency `@tauri-apps/cli` 即可，无需全局安装 |
| 网络 | crates.io index / registry.npmjs.org 可达 | ✅ 可用 |
| 操作系统 | Windows Server 2022，10.0.20348 | ⚠️ 无 Mica（Win11 专属），Acrylic 待验证 |
| ECB 汇率 | `eurofxref-daily.xml` 返回 200，29 币种，含 CNY，基准 EUR | ✅ 可作默认汇率源 |

### 1.2 Node 与 PATH 约定

- 解释器：`E:\node\node.exe`；包管理：`E:\node\npm.cmd`。
- Git Bash（本仓库默认终端）：

```bash
export PATH="/e/node:$PATH"
node --version    # v24.21.0
npm --version     # 11.19.0
```

- PowerShell / cmd（新开终端生效）：

```powershell
setx PATH "%PATH%;E:\node"
```

- npm scripts 一律通过 `npm run <script>` 调用，不在脚本中硬编码 node 绝对路径；CI 使用 `actions/setup-node` 固定 24.x。
- 不提交 `node_modules/`；首次开发执行 `npm install`，锁文件 `package-lock.json` 入库。

### 1.3 依赖版本（调研日 crates.io / npm 最新稳定版）

| 包 | 版本 | 用途 |
|---|---|---|
| `tauri` | 2.12.7 | 应用框架 |
| `@tauri-apps/api` / `@tauri-apps/cli` | 2.12.x | 前端 API / 构建 |
| `rust_decimal` | 1.43.0 | 十进制精确运算 |
| `chrono` | 0.4.45 | 日期计算 |
| `reqwest`（rustls） | 0.13.x | 汇率拉取 |
| `quick-xml` | 0.42.0 | ECB XML 解析 |
| `thiserror` / `serde` | 2.0.x / 1.0.x | 错误类型 / 序列化 |
| `proptest` | 1.12.0 | 属性测试（可选） |
| `tauri-plugin-clipboard-manager` | 2.5.0 | 剪贴板 |
| `tauri-plugin-store` | 2.5.1 | 设置 / 历史持久化 |
| `tauri-plugin-window-state` | 2.5.0 | 窗口尺寸记忆 |
| `tauri-plugin-opener` | 2.7.3 | 打开外部链接 |
| `tauri-plugin-log` | 2.10.2 | 诊断日志 |
| `react` | 19.3.1 | UI |
| `vite` | 8.3.8 | 构建 |
| `typescript` | 7.0.2 | 类型 |
| `zustand` | 5.1.0 | 前端 UI 状态 |
| `i18next` / `react-i18next` | 27.2.1 / 18.0.2 | 多语言 |
| `vitest` | 5.1.1 | 前端测试 |

> 注意：`tauri-plugin-clipboard-manager` 与 `tauri-plugin-window-state` 存在 `3.0.0-alpha`，**必须使用 2.x 稳定线**，不要误装 alpha。
> 实施时用 `cargo add` / `npm i` 锁定到当时最新稳定版，并把 `Cargo.lock` / `package-lock.json` 一并提交。

**T1 实测记录（2026-11-19）**

- 实际解析版本：`tauri@2.11.6`、`@tauri-apps/api@2.11.1`、`@tauri-apps/cli@2.11.5`、`react@19.3.1`、`vite@8.3.8`、`typescript@7.0.2`、`vitest@5.1.1`；五个插件（clipboard-manager / log / opener / store / window-state）均落在 2.x 稳定线。
- **Tauri 版本对齐**：`tauri dev` 会校验 Rust crate 与 `@tauri-apps/api` 的 major/minor 是否一致；crates.io 当前 2.x 最新为 `2.11.6`，而 npm 侧已到 2.12.x。因此 npm 两个包用 `~2.11.x` 固定（而非 `^2.12`），避免 “Found version mismatched Tauri packages”。crates.io 发布 2.12 后可同步升级。
- **ESLint 偏差**：`typescript-eslint@8.73` 的 peer 范围仍为 `typescript >=4.8.4 <6.1.0`，与最新 `typescript@7.0.2` 冲突。因此 lint 门禁改用 `oxlint@1.94`（原生 TS 解析，含 react/typescript 插件），脚本名保持 `npm run lint`；待 typescript-eslint 支持 TS 7 后可直接替换，不影响其他门禁。
- 图标：`src-tauri/icons/app-icon.png` 为程序化生成的占位源图（紫底白色等号），经 `tauri icon` 展开为多尺寸 PNG/ICO/ICNS；`android/`、`ios/` 产物已删除（本迭代不做移动端，见 2.2）。
- 本地验证：`npm run typecheck` / `npm run lint` / `npm run test` / `npm run build`、`cargo fmt --check` / `cargo clippy -D warnings` / `cargo test --workspace` 全部通过；前端产物 JS 219.7 kB（gzip 68.7 kB），低于 250 kB 预算。

**T2 实测记录（2026-11-19）**

- 依赖实际解析：`i18next@27.2.1`、`react-i18next@18.0.2`。
- 字体：`src/assets/fonts/inter-latin-var.woff2`（Google Fonts v20 latin 子集，48.25 kB，可变字重 400–700），`@font-face` 自托管，CSP 不放开远程字体。
- 主题：`src/styles/tokens.css` 全量令牌 + 深浅两套值，`prefers-color-scheme` 作为首屏兜底；启动时 `src/lib/theme.ts` 依据 `localStorage["glx.theme"]` 在 React 渲染前写入 `<html data-theme>`，避免白闪。存储键暂由前端管理，T3 迁移到 Rust 设置。
- i18n：12 个命名空间 × zh-CN/en-US，静态资源导入；语言键 `glx.language` 与 `<html lang>` 同步；`scripts/check-i18n.mjs` 校验文件清单、键集合、空值与 `{{placeholder}}`，已接入 `npm run check:i18n` 与 CI。
- 控件：`SoftButton / SoftCard / SoftInput / SoftTooltip / SoftToast`（CSS Modules；覆盖 hover/active/focus-visible/disabled/loading/error，tooltip 400ms 延迟、toast 3s 自动关闭）。
- 临时画廊页 `src/features/dev/GalleryPage.tsx` 用于 T2 视觉验收，已于 T3 移除。
- 构建产物：JS 289.68 kB（gzip 91.86 kB）、CSS 14.12 kB（gzip 3.42 kB）、字体 48.25 kB；按 §8 的 gzip 预算（250 kB）通过。i18next 使 raw 体积高于 T1，门禁口径统一按 gzip。
- 视觉检查：Edge headless 440 宽，light/dark × zh/en；tooltip 聚焦显示、toast 四态与关闭均正常，页面无未翻译的裸键。截图仅作过程验证，未入库。

**T3 实测记录（2026-11-19）**

- 窗口：`decorations:false`、`transparent:false`、`shadow:true`；默认 440×820、最小 380×640。实测 175% 缩放（DPI 168）下逻辑尺寸仍为 440×820。
- 权限根因：`core:default` 只含窗口读取与 drag-region 的双击最大化（`allow-internal-toggle-maximize`），**不含**拖拽与窗口操作。已在 `capabilities/default.json` 增加 `allow-start-dragging`、`allow-minimize`、`allow-toggle-maximize`、`allow-close`；否则自绘按钮与拖拽会被静默拒绝。
- Spike A（Win32 输入注入 + 窗口样式）：窗口具备 `WS_THICKFRAME / WS_MINIMIZEBOX / WS_MAXIMIZEBOX`，无分层透明；双击标题栏最大化/还原、标题栏拖拽移动、拖到屏幕顶部 Snap、右下角边缘缩放、自绘最小化/最大化/还原/关闭全部通过。
- Spike B（DPI/特效）：系统为 Windows Server 2022（10.0.20348），Mica 不可用；窗口保持 opaque + 纯色主题，不启用 Acrylic。设备模拟 1.0 / 1.25 / 1.5 / 1.75 / 2.0 五档下 `scrollWidth/scrollHeight` 均未超出 440×820，无溢出；175% 实际渲染清晰。
- 设置：Rust `settings_get/set/reset` 写入 `%APPDATA%\com.glx.calculator\settings.json`；重启后 dark/en-US 恢复成功；恢复默认写回 `system/zh-CN`。前端仅保留 `glx.theme`/`glx.language` 启动镜像。
- 覆盖层：设置弹层（焦点陷阱、Esc、遮罩关闭）与历史抽屉可开合；`Ctrl+H` 打开历史。全局滚动条改为 8px 圆角自定义样式，无原生滚动条。
- 路由：hash 路由 `#/basic…worksheets`，7 个占位页；设置/历史不占主导航主项。
- 控制台：修复 favicon 404（内联 data SVG）后为 0 error/0 warning。
- 测试：前端 31 项（含设置归一化、store 回滚、路由、UI store）；Rust 10 项（契约 5 + 设置 5）。
- 构建：JS 321.04 kB（gzip 100.50 kB）、CSS 21.43 kB（gzip 4.57 kB）、字体 48.25 kB，按 §8 gzip 预算通过。
- 截图归档：`docs/qa/2026-11-19/`（light/dark × zh/en + 设置弹层，5 张，共约 148 kB）。

**T4 实测记录（2026-11-19）**

- 依赖：新增 `rust_decimal@1.43.0`（`maths` 特性，用于 `Decimal::sqrt`），仅 `calc-core` 使用，不进入 Tauri 层。
- 模块：`value`（解析/分组剥离/全角与排版符号归一化/规范化输出/极值窗口）、`parser`（tokenizer + 递归下降，`+ -` < `* /` < `^` 右结合 < 一元负号，`%` 为后缀除以 100）、`engine`（会话状态机）、`ops::basic`（四则/取余/整数幂/百分比/一元）、`ops::evaluate`（AST 求值）。`format.rs` 未单列，canonical 输出收敛在 `value::canonical`，避免空壳模块。
- 语义决策：`=` 按表达式优先级求值（`2+3×4=14`，非 Windows 标准模式的立即执行 20）；百分比采用 Windows 语义（`50+10%=55`、`200×10%=20`、单独 `50%=0.5`）；错误后数字/退格/运算符恢复，`C` 立即清除；重复 `=` 复用最后一次二元运算；一元函数对当前值生效并保留待处理表达式。
- 契约内但未在 M1 实现：科学函数（T8）、位运算/进制视图（T9）、统计（T11）；当前返回 `UNSUPPORTED`，不 panic。
- 测试：82 项（lib 76 + 契约 5 + 黄金 1 组 6 用例）；覆盖优先级/括号/幂右结合、连算与重复 `=`、百分比三种语义、除零/溢出/定义域/语法/非法输入、记忆四操作、退格与 CE/C、错误恢复、粘贴表达式、负数补零与分组解析。黄金用例 `tests/golden/basic.json` 由引擎直接执行，后续 TS 侧可复用同一文件。
- 门禁：`cargo fmt --check` / `cargo clippy --workspace --all-targets -D warnings` / `cargo test --workspace`（87 项）全绿；前端未修改。
- 记忆为单槽（`CalcView.memory: Option<String>`），记忆面板列表属前端展示层；多值记忆栈留待 M2 按 UI 需要扩展。

**T5 实测记录（2026-11-19）**

- Tauri 适配：新增 `src-tauri/src/session.rs`，`SessionMap` 以窗口 label 为键持有 `Engine`，提供 `calc_command`（参数 `cmd`）与 `session_reset`（参数 `mode`）两个薄命令；窗口 `Destroyed` 时清理会话。`calc_command` 的业务错误仍通过 `CalcView.error` 返回，`Result` 仅保留协议级失败。单测覆盖窗口隔离、重置、销毁后重建。
- 前端契约：`src/lib/ipc.ts` 增加 `CalcView/CalcCommand/ErrorInfo/ProgrammerView` 窄类型（禁止 `any`）、响应归一化与 `calcCommand/resetSession`；`src/stores/calc.ts` 按模式镜像最近视图，路由切换不丢显示（Rust 仍是唯一事实源）。
- 标准页：`Display`（表达式行 + 主值 + 错误 + 自动缩字号 + 防抖 `aria-live` + M 指示）、`Keypad`（4 列 6 行，含 `% CE C ⌫ / 1/x x² √x ÷ / 7-9 / 4-6 / 1-3 / ± 0 . =`）、`MemoryBar`（MC/MR/M+/M−/MS；无记忆时 MC/MR 禁用）。`SoftButton` 扩展 `number/operator/function/warning` 分组变体；新增 `--color-warning-text` 令牌保证清除键文字在浅色主题下满足 AA。
- 格式化：`lib/format.ts` 负责分组、16 位有效数字（第 17 位四舍五入、远离零）与 E 记法；指数 `≥16` 或 `≤−16` 转 E，避免长串数字溢出。输入中的 `0.`、`12.000` 等保留原样；表达式行把 `* / -` 显示为 `× ÷ −` 并本地化 `sqrt(`/`inv(`。
- 键盘：数字、`.`/`,`、`+ - * /`、`Enter`/`=`、`Esc`/`Delete`、`Backspace`、`%`、`F9`（±）、`R`（1/x）、`Q`（x²）、`@`（√x）。带 Ctrl/Alt/Meta 的组合一律不拦截；设置/历史覆盖层打开时不响应；输入框聚焦时不响应。
- CE 语义修正（T4 遗留）：CE 保留待处理表达式并显示 `0`（`2 + 3 CE` → 表达式 `2 +`、值 `0`）；无待处理表达式时清空显示与结果。新增 2 项引擎测试。
- 预览模式：前端不复制算术；浏览器 `npm run dev` 下首次按键只显示「不执行计算」提示，真实计算必须走 Tauri，避免两套逻辑漂移。
- 测试：Rust 92 项（calc-core 84 = lib 78 + 契约 5 + 黄金 1；shell 8 = 设置 5 + 会话 3）；前端 55 项（新增 `format` 12、`keyboard` 5、`BasicPage` 组件 7）。
- 门禁：`cargo fmt --check` / `cargo clippy --workspace --all-targets -D warnings` / `cargo test --workspace`；`npm run typecheck` / `lint` / `test` / `check:i18n` / `build` 全绿。产物 JS 331.46 kB（gzip 104.18 kB）、CSS 25.43 kB（gzip 5.26 kB），仍在 250 kB gzip 预算内。
- QA：Edge headless CDP 在 440×820 下输出 light/dark × zh-CN/en-US 四张截图，`scrollWidth/clientWidth = 440`、`scrollHeight/clientHeight = 820`，24 个按键全部位于视口内；Tauri dev + WebView2 CDP 实测 `2+3×4=14`、除零本地化错误、分组 `1,000,000`、CE 续算 `2+CE 4=6`、MS/MR，控制台 0 error；`calc_command` 20 次均延迟 1.77 ms、p95 2.5 ms（目标 <15 ms）。
- 未纳入 T5：记忆面板（核心为单槽，需先做多槽记忆）、复制按钮/剪贴板（T7）、历史（T6）、小数位设置。复制按钮与右键菜单由 T7 在 `Display` / `Keypad` 上接入。

**T6 实测记录（2026-11-19）**

- 核心契约：新增 `CalcCommand::Recall { expression, value }`（tag `recall`）。与 `SetExpression` 不同，恢复历史时**不重新求值**：表达式仅用于展示，`value` 解析后成为可被替换的当前输入；`validate` 拒绝空串与超长（>1000 字符）。引擎保留待处理表达式以外的输入语义，恢复后直接键入数字会替换结果，按运算符可从恢复值继续计算。
- Tauri 存储：新增 `src-tauri/src/history.rs`。`HistoryLog` 为纯内存日志（最新在前、连续重复折叠、上限截断、按 id 删除、按模式清空），`HistoryState` 通过 store 插件读写 `history.json`（键 `entries`）。命令 `history_list/history_add/history_delete/history_clear(mode)`；`history_add` 读取设置中的历史开关与上限，关闭时直接返回现有列表且不写盘。条目形如 `{id, mode, expression, value, ts}`，`ts` 为 Unix 毫秒、`id` 为纳秒字符串；本任务未引入 `meta` 字段。
- 设置联动：`settings_set` / `settings_reset` 接收 `HistoryState`，在限制下调后立即截断并在内存/文件同步；截断写盘失败只记日志，不回滚设置保存。启动时按已加载设置的上限恢复历史。
- 剪贴板：新增 `clipboard::clipboard_copy`（Rust `ClipboardExt`，长度上限 10,000），避免为 T6 提前引入插件 JS 包；读/粘贴仍留 T7。
- 前端契约：`ipc.ts` 增加 `HistoryEntry/HistoryInput`、`recall` 命令、`fetchHistory/addHistory/deleteHistory/clearHistory(mode)/copyText`；历史响应做同构归一化，浏览器预览用 `glx.history.preview` 本地回退。
- 记录触发：`lib/history.ts::isCompletedCalculation` 仅在命令为 `equals`、无错误、值为非空且表达式以 `=` 结尾时判定完成；`BasicPage` 在设置开启时调用 `history_add`（后续模式复用同一判据）。`session_reset` + `recall` 由抽屉恢复流程调用，完成后导航到条目所属模式并关闭抽屉。
- 抽屉：按当前页面模式过滤条目；按本地日期分组（今天/昨天/具体日期），时间与数值使用 `Intl` 与 `formatNumber`；每条支持恢复、复制原始值、删除；清空需二次确认（取消/确定），清空范围限定当前模式。空状态、加载中、存储错误分别展示；焦点/键盘行为沿用 `SoftDialog`。
- 测试：Rust 103 项（calc-core 87 = lib 81 + 契约 5 + 黄金 1；shell 16 = 设置 5 + 会话 3 + 历史 8）；前端 67 项（新增 `lib/history` 3、`HistoryDrawer` 7、`BasicPage` 历史记录/开关 2）。
- 门禁：`cargo fmt --check` / `clippy -D warnings` / `cargo test --workspace`；`npm run typecheck` / `lint` / `test` / `check:i18n` / `build` 全绿。产物 JS 338.33 kB（gzip 105.91 kB）、CSS 28.18 kB（gzip 5.61 kB），仍在 250 kB gzip 预算内。
- QA（Tauri dev + WebView2 CDP）：`2 + 3 =`、`10 × 2 =` 各生成一条，抽屉最新在前且分组正确；恢复 `2 + 3 =` 后显示 `5` 并保留表达式，继续 `× 2 =` 得 `10` 并新增条目；复制写入剪贴板原始值 `10`；删除/清空（确认→取消→确认）即时更新 `history.json`；重启应用后条目保留而会话归零；关闭历史开关后 `9 × 9 =` 不记录；105 条后将上限改为 100，内存列表与文件均截断为 100（保留最新）。控制台 0 error。
- 截图：`docs/qa/2026-11-19/t6-{light,dark}-{zh-CN,en-US}-history.png`（Edge headless 440×820，`scrollWidth/Height` 与视口一致，四语/主题组合无溢出）。


### 1.4 参考截图 → 布局结论

- 自定义标题栏：左侧应用名 + `dev` 徽标，右侧最小化/最大化/关闭；内容区可拖拽。
- 左侧竖向图标导航栏（约 64px）：汉堡菜单 + 各模式/转换类目图标 + 底部设置。
- 显示区：右对齐超大字号数字，支持自动缩放；下方记忆键行（MC / MR / M+ / M− / MS / M▾）。
- 按键区：等宽网格、按钮间明显间隙、圆角、operator 与 function 分组着色；`=` 为主色按钮。
- 单位转换页：标题 + 「输入值」标签 + 带下拉的单位输入框 + 居中换向按钮 + 「到」+ 目标单位下拉；下拉列表为自定义样式（非原生 select）。
- 截图整体为深色半透明风格 → **设计稿 light 主题与截图 dark 主题需要成对实现**。

---

## 2. 需求拆解与优先级

优先级：**P0 必须** / **P1 应该** / **P2 可选（后续迭代）**。

### 2.0 导航与页面清单（唯一口径）

后续文档、任务与验收一律使用此表，避免「7 个模式 / 9 个占位页」混用。

| 导航项 | 页面 id | 形态 | 内容 |
|---|---|---|---|
| 基本 | `basic` | 主页面 | 数字键盘、记忆行 |
| 科学型 | `scientific` | 主页面 | 函数键盘、角度制、括号 |
| 程序员 | `programmer` | 主页面 | 进制/字宽切换、位运算、位网格 |
| 统计型 | `statistics` | 主页面 | 数据集 + 统计函数 |
| 日期计算 | `datecalc` | 主页面 | 日期差 / 日期加减 |
| 单位转换 | `converter` | 主页面 + 二级类目 | 11 个类目（汇率/长度/面积/体积/质量/温度/速度/角度/压力/功率/时间） |
| 工作表 | `worksheets` | 主页面 + 二级列表 | 抵押/油耗/租赁（注册表可扩展） |
| 历史 | `history` | 覆盖层（抽屉） | 不占导航主项，Ctrl+H 或显示区按钮打开 |
| 设置 | `settings` | 覆盖层（弹层/页） | 主题/语言/分组/角度制/字宽/进制/历史 |

- M0 的占位验收为 **7 个主页面** + 历史抽屉与设置弹层 **2 个覆盖层**。
- 二级类目（单位 11 类、工作表 N 个）不单独计数。
- 记忆行在 basic / scientific / programmer 三个模式显示；statistics 不显示。

### 2.1 模式与功能矩阵

| 模块 | 功能点 | 优先级 | 验收要点 |
|---|---|---|---|
| 基本 | `+ − × ÷ =`、`%`、`±`、`√`、`x²`、`1/x`、`CE`、`C`、`⌫`、连续运算、重复 `=` | P0 | 结果/表达式双行显示；除以零、溢出有明确错误 |
| 基本 | 记忆：`MC/MR/M+/M−/MS/M▾`（记忆面板） | P0 | 记忆值保留在面板列表（会话内，不跨重启）；MR 插入当前值 |
| 科学型 | `sin/cos/tan` + 反三角 + 双曲、`ln`、`log`、`exp`、`x^y`、`x³`、`∛`、`n!`、`|x|`、`floor/ceil/round`、`π/e`、`rand`、括号、`F-E`、角度制 DEG/RAD/GRAD | P1 | 运算优先级正确；角度制切换即时生效；定义域错误可恢复 |
| 程序员 | 进制切换 2/8/10/16；位运算 `AND OR XOR NOT LSH RSH ROL ROR MOD`；字节宽度 `QWORD/DWORD/WORD/BYTE`；位网格（点击翻转位） | **P0（重点）** | 宽度截断、移位环绕、负数补码显示正确；非法数字输入被拦截 |
| 统计型 | 数据集录入/编辑；`Σx`、`Σx²`、`x̄`、`s`（样本）、`σ`（总体）、`n`、中位数、众数、极差、最小/最大、方差 | P1 | 空集/单元素有明确提示；浮点误差处理一致 |
| 单位转换 | 汇率、长度、面积、体积、重量(质量)、温度、速度、角度、压力、功率、时间（11 类） | P0 | 双向换算、换向按钮、精度与分组正确；温度走仿射公式 |
| 单位转换-汇率 | ECB 每日汇率 + 本地缓存 + 手动刷新 + 离线提示 | P0 | 离线时展示缓存时间与警告；缓存为空时给重试入口 |
| 日期计算 | 两日期差（年/月/日 + 总天数/周数）；指定日期 ± 天数/周/月/年 | P1 | 闰年、月末夹取（1/31 + 1 月）正确；本地化日期格式 |
| 工作表 | 抵押贷款、油耗、租赁（首批 3 个，注册表可扩展） | P2 | 输入校验（正数/范围）；结果含明细与复制 |
| 横切 | 历史记录（按模式、复制、删除、清空、恢复） | P0 | 重启后保留；上限与去重策略明确 |
| 横切 | 数字分组开关（1,000） | P0 | 显示分组、复制始终为原始值、解析兼容带分组输入 |
| 横切 | 复制/粘贴（Ctrl+C/V、右键菜单、粘贴 0x/0b） | P0 | 非法粘贴不崩溃、给出提示 |
| 横切 | 异常值校验（NaN/∞/溢出/定义域/语法） | P0 | 永不显示 NaN；错误可用 Esc/C 恢复 |
| 横切 | 日夜主题（跟随系统/手动） | P0 | 无闪烁切换；两套令牌全覆盖 |
| 横切 | 高 DPI（100%–200%） | P0 | 文字/图标清晰，布局不破；跨屏拖动正常 |
| 横切 | 菜单多语言（zh-CN / en-US） | P0 | 即时切换，含错误文案、单位名、菜单 |
| 横切 | 自定义控件替换原生控件 | P0 | 无原生 select/date/scrollbar/checkbox/标题栏 |

### 2.2 明确不做（Out of Scope）

- 函数绘图、方程求解、矩阵/复数模式。
- 单位转换中的「能量/数据/燃料效率」类目（可后续按注册表扩展，本迭代不做）。
- 云同步、账号体系、插件系统、自动更新（更新器留到后续版本评估）。
- 移动端/Web 端发布（代码保持可移植，但不做适配验收）。

---

## 3. 技术架构

### 3.1 分层

```
┌─────────────────────────────────────────────────────────────┐
│ React 19 + TS（WebView2）                                     │
│  UI 组件 / 路由 / i18n / 主题 / 格式化展示 / 剪贴板 / 快捷键      │
└──────────────────────────┬──────────────────────────────────┘
                           │ typed invoke（tagged enum，serde camelCase）
┌──────────────────────────┴──────────────────────────────────┐
│ src-tauri（薄适配层）                                          │
│  commands/（会话、单位、日期、工作表、设置、历史）                 │
│  state（SessionMap / Settings）、插件注册、窗口与菜单              │
└──────────────────────────┬──────────────────────────────────┘
                           │ 纯 Rust 调用
┌──────────────────────────┴──────────────────────────────────┐
│ crates/calc-core（无 Tauri 依赖，100% 可单测）                   │
│  decimal / parser / engine / ops{basic,scientific,programmer, │
│  statistics} / units / date / worksheet / format / error      │
└─────────────────────────────────────────────────────────────┘
```

**为什么不用 WASM 把内核搬到前端**：Tauri IPC 延迟远低于人眼感知（目标 p95 < 15ms），保留单一 Rust 事实源、可用 `cargo test` 覆盖全部算法；若 M1 实测输入出现卡顿，再评估 WASM 方案（记录在风险表）。

### 3.2 技术选型

| 决策 | 选择 | 理由 / 备选 |
|---|---|---|
| 桌面框架 | Tauri 2.12 | 需求指定；体积小、Rust 原生 |
| 前端框架 | React 19 + TS | 组件化成熟、生态好；备选 Svelte（更轻）/ Vue |
| 构建 | Vite 8 | Tauri 官方模板默认 |
| 样式 | **CSS 变量令牌 + CSS Modules** | 设计稿是令牌体系；主题切换零成本；备选 Tailwind v4（会重复一套设计语言） |
| 前端状态 | Zustand 5 | 仅 UI/设置状态，轻量 |
| 计算 | `rust_decimal` + `f64` + `i64` | 见 3.5 精度策略 |
| 持久化 | `tauri-plugin-store` | JSON 原子写入，无原生依赖；历史/设置各一个文件 |
| 剪贴板 | `tauri-plugin-clipboard-manager` | 官方，权限可控 |
| 汇率 | ECB XML + `reqwest(rustls)` + `quick-xml` | 免 Key、权威、每日更新 |
| 菜单 | 应用内自定义菜单/抽屉 | 与 modern UI 一致；不启用原生菜单栏 |
| 测试 | `cargo test` + Vitest + RTL | 内核全覆盖；UI 关键逻辑单测 |

### 3.3 目录结构（目标）

```
Glx.SimpleCalculator/
├─ Cargo.toml                  # workspace：src-tauri + crates/calc-core
├─ package.json                # React/Vite/Tauri CLI 脚本
├─ vite.config.ts
├─ tsconfig.json
├─ index.html
├─ scripts/check-i18n.mjs      # 多语言键集合一致性校验（CI 用）
├─ src/
│  ├─ main.tsx / App.tsx
│  ├─ app/                     # 路由、窗口、快捷键、启动初始化
│  ├─ components/ui/           # Soft UI 控件库（见 4.3）
│  ├─ components/layout/       # TitleBar / NavRail / HistoryDrawer
│  ├─ features/
│  │  ├─ basic/ scientific/ programmer/ statistics/
│  │  ├─ converter/ datecalc/ worksheets/ history/ settings/
│  ├─ lib/                     # ipc.ts、format.ts、keyboard.ts、clipboard.ts
│  ├─ stores/                  # settings / ui / history（zustand）
│  ├─ i18n/                    # index.ts + locales/{zh-CN,en-US}/*.json
│  └─ styles/                  # tokens.css / base.css / themes.css
├─ src-tauri/
│  ├─ Cargo.toml / tauri.conf.json / build.rs
│  ├─ capabilities/default.json
│  ├─ icons/
│  └─ src/{main.rs, lib.rs, commands/, state.rs, error.rs, menu.rs}
└─ crates/calc-core/
   ├─ Cargo.toml
   └─ src/{lib.rs, value.rs, parser.rs, engine.rs, format.rs, error.rs,
           ops/, units/, date.rs, worksheet/, tests/}
```

### 3.4 状态模型

| 状态 | 归属 | 说明 |
|---|---|---|
| 当前模式 / 抽屉开关 / 弹层 | 前端 Zustand | 纯 UI |
| 标准/科学/程序员/统计会话 | **Rust** `SessionMap<WindowLabel, Session>` | 每窗口独立；含表达式 token、pending op、memory、radix、word size、angle unit |
| 单位/日期/工作表输入 | 前端表单状态 | 提交时走纯函数命令 |
| 设置 | Rust store + 前端镜像 | 单一写入方为 Rust 命令，避免双写 |
| 历史 | Rust store（默认 500，设置范围 100–1000） | 引擎完成 `=`/函数时返回 entry，由前端调用 `history_add` 落盘 |

### 3.5 精度策略（必须写进代码注释与测试）

| 模式 | 数值类型 | 显示规则 | 错误边界 |
|---|---|---|---|
| 基本 / 汇率 | `rust_decimal`（28–29 位有效数字） | 最多 16 位有效数字；指数 ≥16 或 ≤−16 用 E 记法；汇率结果按 6 位有效数字显示 | 超出 Decimal 范围 → `Overflow` |
| 工作表（金额） | `rust_decimal`（整数指数 `powi`） | 中间值保留 8 位小数，最终金额 `round_dp_with_strategy(2, MidpointAwayFromZero)` | 期限/利率非法 → `InvalidInput` |
| 工作表（mpg 等非线性辅助） | `f64` | 结果按 4 位有效数字显示 | 仅展示用，不参与金额累计 |
| 科学型 | `f64`（三角/对数/幂） | 12–15 位有效数字；`|x|≥1e12` 或 `<1e-9` 用 E 记法；去尾零 | 定义域错误 → `DomainError`；`n!` 限 0–170 |
| 程序员 | `i64` + `wrapping_*` + 字宽掩码 | 按进制分组：二进制/十六进制 4 位、八进制 3 位、十进制 3 位 | 非整数/非法字符 → `InvalidInput`；除法零 |
| 统计 | `f64` + Kahan 求和 | 6–12 位有效数字（可配置） | 空集/样本数不足 → `DomainError` |

> 格式化（分组、有效数字、E 记法、进制分组）统一在 TS `lib/format.ts` 实现，Rust 只返回**规范化原始值**（decimal 字符串 / i64 / f64），避免前后端两套格式化逻辑。
> 贷款月供使用 `(1+r)^-n` 的整数指数形式（`Decimal::powi`），不使用小数幂；除不尽时只允许在最终展示阶段舍入。

### 3.6 IPC 契约（示例，实施时以此为准）

```rust
// crates/calc-core/src/view.rs（T0 已冻结）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalcView {
    pub mode: Mode,
    pub expression: String,      // 供展示的表达式行（ASCII 运算符）
    pub value: String,           // 规范化原始值，未分组
    pub memory: Option<String>,
    pub programmer: Option<ProgrammerView>, // radix/wordSize/四种进制/bits
    pub error: Option<ErrorInfo>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorInfo { pub code: ErrorCode, pub args: Vec<String> }

#[derive(serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    DivideByZero, Overflow, InvalidInput, DomainError,
    Syntax, Unsupported, CurrencyOffline, UnknownUnit,
    StorageError, NetworkError, Internal,
}
```

```rust
// 单一会话入口，tagged enum 便于扩展
#[tauri::command]
fn calc_command(state: State<'_, SessionMap>, window: Window, cmd: CalcCommand)
    -> Result<CalcView, ErrorInfo>;

#[serde(tag = "type", rename_all = "camelCase")]
pub enum CalcCommand {
    Digit { digit: u8 }, Dot, Backspace, ClearAll, ClearEntry,
    Unary { op: UnaryOp }, Binary { op: BinaryOp }, Equals, Percent, ToggleSign,
    Memory { op: MemoryOp },
    SetAngleUnit { unit: AngleUnit },
    SetRadix { radix: u8 }, SetWordSize { size: u8 },
    OpenGroup, CloseGroup, Constant { id: String }, ToggleBit { bit: u8 },
    SetExpression { text: String },   // 粘贴/编辑
}
```

其余命令：`session_reset(mode)`、`convert_unit`、`currency_status/refresh`、`date_diff/date_add`、`worksheet_compute`、`stats_compute`、`history_list/add/delete/clear`、`settings_get/set/reset`、`app_info`。

> T5 已实现 `calc_command` 与 `session_reset`。业务错误走 `CalcView.error`；`Result<_, ErrorInfo>` 仅表示协议级失败（当前恒为 `Ok`），前端仍按错误码统一处理。
> T6 新增 `CalcCommand::Recall { expression, value }` 与 `history_list/add/delete/clear(mode)`、`clipboard_copy`。历史条目随 `history.json` 持久化，恢复采用「不重新求值」语义。

契约测试位于 `crates/calc-core/tests/contract.rs`（T0 已通过：命令 tag/camelCase、错误码、视图 null 字段、往返、校验）。

TS 侧 `src/lib/ipc.ts` 用**手写窄类型**镜像 serde 结构，禁止 `any`；枚举用字符串字面量联合。

### 3.7 持久化

| 文件（AppData） | 内容 | 策略 |
|---|---|---|
| `settings.json` | 主题、语言、分组开关、角度制、字宽/进制默认值、小数位、历史开关 | store 插件；启动时读取，变更即时写入 |
| `history.json` | `{id, mode, expression, value, ts}` | 默认上限 500（设置范围 100–1000），按时间倒序；连续重复（与最新一条完全相同）折叠、不跨模式去重；列表与清空按当前模式；add/delete/clear 全部走 Rust；`meta` 暂未使用 |
| `currency-cache.json` | `{base:"EUR", date, fetchedAt, rates}` | 与设置共用 store 抽象；TTL 24h；失败保留旧缓存 |
| 窗口位置 | window-state 插件自动管理 | 不手写 |

### 3.8 汇率方案

- 数据源：`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`（实测 200）。
- 基准 EUR，29 种货币，含 CNY；**不含 RUB**，缺失币种在 UI 中不出现。
- 交叉汇率：`rate(A→B) = rate(EUR→B) / rate(EUR→A)`。
- 启动时后台刷新（不阻塞 UI）；缓存 `fetchedAt` 超过 24h 才自动刷新（启动即触发）。失败 → 使用缓存 + 顶部提示「汇率更新失败，使用 2026-11-18 数据」；无缓存 → 显示重试按钮，不崩溃。
- 手动刷新始终可用（速率限制：同一窗口 5s 内最多一次）。
- 请求超时 8s，UA 标识应用名；仅 HTTPS；所有网络请求在 Rust 侧，CSP 不需要放开网络。
- 合规：UI 标注数据来源与更新日期；不用于交易建议。

### 3.9 安全基线

- CSP：`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ipc: http://ipc.localhost`（按 Tauri 2 实际要求调整）。
- capabilities 最小化：`core:default`、`clipboard-manager`、`store`、`window-state`、`opener`；自绘标题栏额外需要 `core:window:allow-start-dragging / allow-minimize / allow-toggle-maximize / allow-close`（`core:default` 不含窗口写操作）；**不引入 shell / fs 全量权限**。
- 不加载远程脚本/字体；Inter 字体本地打包（woff2）。
- 粘贴输入先清洗再交给内核，长度上限（如 1,000 字符）防止构造超长表达式。

### 3.10 模块边界与职责（T0 冻结）

#### 3.10.1 不可破坏的分层规则

1. `calc-core` **不依赖 Tauri、不做 I/O、不含用户可见文案**；只返回规范化值与错误码。
2. 前端**不实现业务算术**：只负责输入清洗、展示格式化、i18n、主题与交互。
3. 展示格式化**只在 TS**（`lib/format.ts`）；Rust 只输出 canonical 原始值。
4. 网络请求**只在 src-tauri**；`calc-core` 只接收已获取的汇率表并做纯换算。
5. 错误跨边界只传 `{ code, args }`，文案由前端 i18n 解析。
6. 每个 crate/目录只通过 `lib.rs` / `index.ts` 的公开 API 被外部使用，禁止深层导入。
7. 契约（IPC 类型）变更必须同时更新：`calc-core/view.rs`、`src/lib/ipc.ts`、本文档、契约测试。

#### 3.10.2 归属矩阵

| 产物 | 唯一负责方 | 允许依赖 | 禁止事项 |
|---|---|---|---|
| 算术/进制/位运算/统计/单位/日期/工作表公式 | `calc-core` | 标准库、`rust_decimal`、`chrono` | 网络、文件、Tauri、i18n 文案 |
| 会话状态（输入缓冲、pending op、memory、radix、字宽） | `src-tauri`（调用 core） | `calc-core` | 实现算术、直接操作 DOM |
| IPC 命令与参数校验 | `src-tauri/commands` | `calc-core`、插件 | 业务公式 |
| 设置/历史/汇率缓存落盘 | `src-tauri/storage` | store 插件、serde | 计算逻辑 |
| 汇率拉取与解析 | `src-tauri/currency` | `reqwest`、`quick-xml` | 单位换算 |
| 显示格式化（分组/有效数字/进制分组） | `src/lib/format.ts` | Intl | 调用 Rust 重算 |
| 页面与交互 | `src/features/*` | UI 组件、ipc、stores、i18n | 直接 import `@tauri-apps/api` |
| 通用控件 | `src/components/ui` | tokens | 业务调用、invoke |
| Tauri 调用封装 | `src/lib/ipc.ts` | `@tauri-apps/api` | 业务格式化 |
| 文案 | `src/i18n` | — | 数字/公式 |

#### 3.10.3 `calc-core` 模块边界

| 模块 | 职责 | 输入 → 输出 | 不负责 | 验证归属 |
|---|---|---|---|---|
| `value` | Decimal 解析、归一化、比较、extreme 判断 | `&str` → `Decimal` | 分组/显示、locale | 单测 + 往返 |
| `parser` | tokenizer + 优先级解析（括号、一元、二元） | token 序列 → AST | 求值、会话状态 | 单测 |
| `engine` | 会话状态机、连算、退格、重复 `=`、记忆 | `CalcCommand` → `CalcView` | 格式化、持久化 | 状态机单测 |
| `ops::basic` | 基本四则、百分比、一元运算 | 数值 → 数值/错误 | UI、历史 | 黄金用例 |
| `ops::scientific` | 三角/对数/幂/阶乘等纯函数 | 数值 + 角度制 → 数值/错误 | 角度制 UI | 单测 |
| `ops::programmer` | 进制、位运算、字宽掩码、旋转 | `i64` + 字宽 → `i64`/视图 | 文本分组 | 真值表 + 属性测试 |
| `ops::statistics` | 统计函数 | `&[f64]` → 数值/错误 | 数据录入 UI | 与 Excel 对齐 |
| `units` | 单位注册表 + 线性/仿射换算 | 值 + 单位 id → 值 | 网络、缓存 | 每类黄金值 |
| `units::currency` | 给定汇率表的交叉换算 | 值 + 币种 + 表 → 值 | 拉取/缓存 | 单测 |
| `date` | 日期差、加减、月末夹取 | 日期/增量 → 结果 | 日历控件 | 单测 |
| `worksheet` | 工作表 schema 与公式 | 字段 map → 结果 map | 表单渲染 | 黄金值 |
| `error` | 错误枚举与恢复语义 | — | 文案 | serde 契约测试 |
| `view` | IPC DTO | — | 逻辑 | serde 契约测试 |

#### 3.10.4 前端目录边界

| 目录 | 职责 | 依赖方向 |
|---|---|---|
| `app/` | 路由、启动、快捷键、窗口控制 | → features、components、stores |
| `features/<mode>/` | 页面组合、表单、调用 ipc | → components/ui、lib、stores、i18n |
| `components/layout/` | 标题栏、导航栏、抽屉 | → components/ui、stores |
| `components/ui/` | 无业务通用控件 | → styles、i18n（仅通用文案） |
| `lib/` | ipc、格式化、清洗、键盘、剪贴板 | → 无 React 组件 |
| `stores/` | UI/设置镜像/历史列表 | → lib |
| `i18n/` | 字典与初始化 | → 无业务模块 |

#### 3.10.5 命令边界

- `calc_command` 只接受**已合法化**的命令；非法命令返回 `InvalidInput`，不 panic。
- 每个窗口一个会话（`WindowLabel` 为键）；窗口销毁时清理会话。
- 纯函数命令（`convert_unit`、`date_*`、`worksheet_compute`、`stats_compute`）**无状态**，不得读写全局上下文。
- 存储命令是唯一写盘入口；前端不得直接写文件。

### 3.11 文件清单（新建 / 修改）

> 当前仓库没有应用代码，因此绝大多数为**新建**；唯一的“修改”是 README、本计划与必要的 `.gitattributes`。

| 类别 | 文件/目录 | 动作 | 负责任务 |
|---|---|---|---|
| 工作区 | `Cargo.toml`、`.gitignore` | 新建 | T0 |
| 核心 | `crates/calc-core/Cargo.toml`、`src/{lib,error,view,mode,command}.rs` | 新建 | T0 |
| 核心 | `crates/calc-core/src/{value,parser,engine}.rs`、`src/ops/*` | 新建 | T4–T6、T9–T11 |
| 核心 | `crates/calc-core/src/units/*`、`date.rs`、`worksheet/*` | 新建 | T12–T15 |
| 核心测试 | `crates/calc-core/tests/*`、`tests/golden/*.json` | 新建 | 随 T4 起 |
| Tauri | `src-tauri/Cargo.toml`、`tauri.conf.json`、`build.rs`、`capabilities/default.json` | 新建 | T1 |
| Tauri | `src-tauri/icons/*`（占位源图 + `tauri icon` 生成） | 新建 | T1、T17 |
| Tauri | `src-tauri/src/{main,lib}.rs`、`commands/*`、`state.rs`、`storage.rs`、`currency.rs` | 新建 | T1、T7、T13 |
| 前端 | `package.json`、`package-lock.json`、`vite.config.ts`、`tsconfig.json`、`index.html` | 新建 | T1 |
| 前端 | `src/styles/*`、`src/components/ui/*`、`layout/*` | 新建 | T2–T3 |
| 前端 | `src/features/*`、`src/lib/*`、`src/stores/*`、`src/i18n/*` | 新建 | T2–T16 |
| 脚本/CI | `scripts/check-i18n.mjs`、`.github/workflows/ci.yml` | 新建 | T1–T2 |
| 文档 | `README.md` | 修改（发布信息） | T18 |
| 文档 | `PLAN/TODO/01-Addfeatures/HANDOFF.md` | 修改（进度与 Spike 结论） | 全程 |
| 配置 | `.gitattributes` | 仅在加入二进制资源时修改 | T3/T18 |
| 不修改 | `PLAN/UIDesign/soft-ui/design.md` | 只读参考 | — |

**不提交的生成物**：`node_modules/`、`dist/`、`target/`、`src-tauri/target/`、`*.log`、`coverage/`、安装包、临时截图。

---

## 4. UI/UX 落地规范

### 4.1 布局骨架（对齐截图）

| 区域 | 尺寸（逻辑像素） | 说明 |
|---|---|---|
| 标题栏 | 高 44 | 应用名 + `dev` 徽标 + 窗口按钮；`data-tauri-drag-region` |
| 左侧导航栏 | 宽 64，图标 20，条目高 44 | 汉堡（展开模式抽屉）+ 计算器模式组 + 转换器组 + 工作表 + 底部设置 |
| 内容区 | 自适应，内边距 16 / 24 | 模式标题 + 模式内容 |
| 显示区 | 高 96–128 | 表达式行 14px muted；主值 40–56px、700、右对齐、`tabular-nums`、自动缩字号 |
| 记忆行 | 高 32 | MC MR M+ M− MS M▾ |
| 按键网格 | 4 列，gap 12，按键最小高 56 | 圆角 16；`=` 主色填充 |
| 窗口 | 默认 440×820；最小 380×640 | 宽屏时按键区最大宽 520 居中 |

- 单位转换页：标题 → 「输入值」→ `SoftSelect` + 输入框 → 换向按钮 → 「到」→ `SoftSelect` → 结果卡片（大号结果 + 复制）。
- 日期页 / 工作表页：单列表单卡片（`SoftCard`，24px 圆角，内边距 24–32），结果用强调卡片。
- 历史：右侧抽屉（280–320px），可固定；小窗时全屏覆盖。

### 4.2 设计令牌（设计稿扩展为双主题）

命名与 design.md 对齐；新增语义令牌与深色值。

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#f1f5f9` | `#0e1118` |
| `--color-surface` | `#ffffff` | `#171b26` |
| `--color-surface-2` | `#f8fafc` | `#1f2431` |
| `--color-surface-3` | `#eef2f7` | `#262c3b` |
| `--color-text` | `#1f2937` | `#e6eaf2` |
| `--color-text-muted` | `#5c6b80` | `#94a3b8` |
| `--color-primary` | `#6366f1` | `#6366f1` |
| `--color-primary-fill`（按钮/选中填充） | `#4f46e5`（白字满足 AA） | `#4f46e5`（白字满足 AA） |
| `--color-primary-hover` | `#4338ca` | `#5850ec` |
| `--color-primary-active` | `#3730a3` | `#4338ca` |
| `--color-primary-text`（浅底文字/链接） | `#4f46e5` | `#a5b4fc` |
| `--color-primary-soft` | `rgba(99,102,241,.10)` | `rgba(99,102,241,.18)` |
| `--color-accent`（blossom） | `#ec4899` | `#f472b6` |
| `--color-success` | `#10b981` | `#34d399` |
| `--color-warning` | `#f59e0b` | `#fbbf24` |
| `--color-warning-text`（清除键文字，AA） | `#b45309` | `#fbbf24` |
| `--color-danger`（设计稿补充） | `#ef4444` | `#f87171` |
| `--shadow-card` | `0 12px 32px rgba(148,163,184,.25)` | `0 12px 32px rgba(0,0,0,.45)` |
| `--shadow-card-hover` | `0 24px 48px rgba(99,102,241,.20)` | `0 24px 48px rgba(99,102,241,.16)` |
| `--shadow-button` | `0 10px 24px rgba(99,102,241,.25)` | `0 10px 24px rgba(0,0,0,.35)` |
| `--focus-ring` | `0 0 0 4px rgba(99,102,241,.25)` | `0 0 0 4px rgba(129,140,248,.30)` |
| `--radius-btn` / `--radius-card` | 16 / 24 | 16 / 24 |
| 间距 | 8 的倍数；按键 gap 12 | 同 |

- 切换方式：`<html data-theme="light|dark">` + `prefers-color-scheme` 作为 `system` 解析结果；启动时在 React 渲染前由 `src/lib/theme.ts` 写入 `data-theme`，首屏由 CSS 媒体查询兜底，避免白闪（CSP 不允许内联脚本）。
- 实现偏差：light 的 `--color-text-muted` 采用 `#5c6b80`（对 `#f1f5f9` 为 4.95:1）；设计稿 `#64748b` 仅 4.34:1，12px 文案不满足 AA，dark 保持 `#94a3b8`（约 7.3:1）。
- 遵循设计稿 Do/Don't：无 1px 硬描边、阴影带色相、低饱和、hover 上浮、按下内凹。**深浅两套都必须过 WCAG AA**（正文 ≥4.5:1，大字号 ≥3:1）。
- 动效：hover 200–300ms，卡片位移 500ms，按下缩放 0.96–0.97；`prefers-reduced-motion` 全部降级为无位移、无缩放。
- 背景：默认纯色；可选「柔和背景」用极低对比径向渐变；**不做窗口透明/Acrylic 作为默认值**（M0 验证后再定）。

### 4.3 自定义控件替换清单

| 原生控件 | 替换为 | 关键行为 |
|---|---|---|
| 原生标题栏 | `TitleBar` + `CaptionButtons` | 拖拽、双击最大化、右键系统菜单（P2）、按钮 hover（关闭为 danger） |
| `<select>` | `SoftSelect` / `SoftCombobox` | 弹层渲染到 portal、键盘上下/Enter/Esc、首字母跳转、列表最大 8 项高后滚动 |
| `<input type="number">` | `NumericInput` | 分组显示、无 spinner、只接受合法字符、宽字符等宽 |
| `<input type="date">` | `DatePicker` | 日历网格、月/年切换、今天/清除、键盘操作 |
| `<checkbox>` / 开关 | `SoftSwitch` / `SoftCheckbox` | 44px 行高、焦点环 |
| 原生滚动条 | `SoftScrollArea` | 细圆角滑块、hover 加深、不遮挡内容 |
| 原生 tooltip | `SoftTooltip` | 400ms 延迟、键盘 focus 也显示、4 向定位 |
| 原生右键菜单 | `SoftMenu` | 复制原始值（默认）/ 复制显示值（含分组）/ 粘贴 / 清除，快捷键标注、子菜单 |
| 原生对话框 | `SoftDialog` / `SoftSheet` | 焦点陷阱、Esc 关闭、遮罩 |
| 原生 tab | `SoftSegmentedControl` | 进制/字宽切换、滑动指示 |
| 原生 toast/alert | `SoftToast` | 复制成功/错误提示，3s 自动消失，可手动关闭 |
| 原生提示气泡 | `SoftPopover` | 帮助与快捷键说明 |

所有控件必须提供：默认 / hover / active / focus-visible / disabled / loading（如适用）/ error 状态。

### 4.4 按键视觉映射

| 分组 | 底色 | 文字 |
|---|---|---|
| 数字 | `--color-surface-2` | `--color-text` |
| 运算 `+ − × ÷` | `--color-primary-soft` | `--color-primary-text` |
| `=` | `--color-primary-fill` | 白色 600 |
| 函数（`% √ x² 1/x`） | `--color-surface-3` | `--color-text` |
| 清除（`C/CE/⌫`） | warning 8% 底（C 用 danger 8%） | warning/danger 文字 |
| 记忆键 | 透明 | muted，12px |
| 位网格单元 | 选中 `--color-primary-soft` | 等宽 |

- 按钮统一 `border: none`；hover 上移 2px + 柔光；active 内凹 + `scale(.96)`；禁用透明度 .4 且不响应 hover。
- 按下键盘时对应按钮做一次 120ms 的视觉反馈（可选，P1）。

### 4.5 高 DPI 与字体

- WebView2 默认 PerMonitorV2；窗口尺寸一律逻辑像素；**不使用 canvas 绘制位网格**（用 DOM，避免位图缩放模糊）。
- 图标全部 SVG，`currentColor`；不使用位图 UI 资源。
- 根字号 16px，字号一律 `rem`；布局用 `rem` + `gap`。
- 字体栈：`Inter`（本地 woff2，latin，400/500/600/700）→ `Nunito` → `Segoe UI` → `Microsoft YaHei UI` → `PingFang SC` → `Noto Sans SC` → sans-serif；数字用 `font-variant-numeric: tabular-nums`。
- 验证矩阵：缩放 100% / 125% / 150% / 175% / 200%，以及双屏不同缩放下拖动窗口。
- 最小点击目标 36×36，主按键 ≥56 高。

### 4.6 键盘与可访问性

| 按键 | 行为 |
|---|---|
| `0-9`、`.` | 输入 |
| `+ - * /` | 运算 |
| `Enter` / `=` | 求值 |
| `Esc` / `Del` | C（清除全部）；`Esc` 同时关闭弹层 |
| `Backspace` | ⌫ |
| `%` | 百分比 |
| `F9` / `R` / `Q` / `@` | `±` / `1/x` / `x²` / `√x`（Windows 计算器快捷方式） |
| `Ctrl+C` / `Ctrl+V` | 复制当前原始值 / 粘贴 |
| `Ctrl+H` | 历史抽屉 |
| `Ctrl+1..5`（P2） | 切换模式 |
| `F1` | 快捷键说明 |

- 焦点环统一使用 `--focus-ring`；弹层焦点陷阱；结果区 `aria-live="polite"` 且输入时防抖（避免读屏逐字朗读）。
- 错误信息同时有视觉与文本（颜色 + 文案），不依赖颜色单独传达。
- 所有图标按钮有 `aria-label`，多语言。

### 4.7 输入校验与错误文案

- 数字输入：仅允许数字、单个小数点、负号（按模式限制）；非法按键忽略并轻微提示（不弹窗）。
- 复制：默认复制**原始值**（无分组）；右键菜单可复制**显示值**（带分组）；程序员模式复制当前进制字符串；历史条目复制其原始值。
- 粘贴：清洗空格/分组符/全角字符 → 归一化；程序员模式识别 `0x/0b/0o` 前缀并切进制；长度 >1000 拒绝。
- 错误统一为 `ErrorCode` → i18n 键（`errors.DIVIDE_BY_ZERO` 等），显示区以 danger 色显示短句，表达式行保留原输入；数字/退格可恢复，运算符在错误态先清除再执行；`C`/`Esc` 立即清除。
- 关键错误：除以零、溢出、定义域（√负数、log≤0）、语法错误、不支持的运算、汇率离线、未知单位。

---

## 5. 国际化（i18n）

- 语言：**zh-CN（默认）**、**en-US**；架构支持追加（`zh-TW` 等）只需新增目录 + 注册。
- 结构：按功能拆文件，降低冲突：

```
src/i18n/locales/zh-CN/{common,menu,basic,scientific,programmer,statistics,
                         units,date,worksheets,settings,history,errors}.json
src/i18n/locales/en-US/...（同构）
```

- 规则：
  - Rust 只返回**错误码、单位 id、工作表 id**，所有可见文案由 TS 翻译。
  - 数字与日期用 `Intl.NumberFormat` / `Intl.DateTimeFormat(locale)`；分组开关独立于 locale。
  - 语言切换即时生效，无重启；同步更新 `document.documentElement.lang`、窗口标题（`getCurrentWindow().setTitle`）。
  - `scripts/check-i18n.mjs` 比对两份键集合，缺键/多键 CI 失败。
  - 中文文案禁止硬编码在组件中；禁止用字符串拼接组织语序（用插值参数）。

---

## 6. 里程碑计划

> 工作量为人日估算，用于排序而非承诺。每个里程碑结束必须：`fmt + clippy + test + typecheck` 通过 → 更新本文件勾选状态 → 提交。

### 6.0 任务清单（T0–T19，唯一执行口径）

依赖均指“前置任务完成”。状态：`pending` / `doing` / `done`；完成时更新本表。

| ID | 任务 | 里程碑 | 依赖 | 交付物 | 验证 | 状态 |
|---|---|---|---|---|---|---|
| T0 | 环境与模块边界冻结 | M0 | — | PATH 约定、根 `Cargo.toml` workspace、`crates/calc-core` 契约骨架（`error/view/mode/command`）、`.gitignore`、本文档 3.10/3.11 | `cargo test -p calc-core`；`cargo check --workspace` | done |
| T1 | Tauri + React 脚手架 + CI | M0 | T0 | `src-tauri` 配置/插件/权限、Vite/TS/oxlint（见 1.3）、`package-lock.json`、`.github/workflows/ci.yml` | `npm install`；`npm run tauri dev`；CI 绿 | done |
| T2 | 设计系统 + i18n + 主题 | M0 | T1 | `tokens.css`（双主题）、字体、`SoftButton/Card/Input/Tooltip/Toast`、i18n 初始化与 zh/en 骨架 | 两主题/两语言截图；`check:i18n` | done |
| T3 | 窗口外壳 + 导航 + 设置 | M0 | T2 | `TitleBar`/`CaptionButtons`/`NavRail`/路由（7 页占位）、设置页与 store 读写、Spike A/B | 拖拽/缩放/关闭；重启保留设置；DPI 100/150 | done |
| T4 | 核心 v1：值/解析/基本引擎 | M1 | T0 | `value/parser/engine/ops::basic`、错误、记忆、≥60 单测 | `cargo test -p calc-core` | done |
| T5 | 标准模式 UI + 格式化 + 键盘 | M2 | T3,T4 | 标准页、`Display`、`Keypad`、`lib/format.ts`（分组）、键盘映射 | 手工用例表；Vitest 格式化 | done |
| T6 | 历史记录 | M2 | T4,T5 | 存储命令、历史抽屉、恢复/删除/清空/复制 | 重启保留；上限；两语言 | done |
| T7 | 剪贴板 + 校验 + 右键菜单 | M2 | T5 | `lib/clipboard.ts`、粘贴清洗、`SoftMenu`、错误提示 | 非法粘贴；0x/0b；Ctrl+C/V | pending |
| T8 | 科学型 | M3 | T4 | `ops::scientific`、科学键盘、角度制、F-E、定义域错误 | sin/cos/ln/阶乘/幂单测；RAD/DEG | pending |
| T9 | 程序员核心 | M4 | T4 | 进制/字宽/位运算/旋转/补码、真值表与属性测试 | 掩码、环绕、BYTE/QWORD 边界 | pending |
| T10 | 程序员 UI | M4 | T9 | 进制/字宽切换、四进制显示、位网格、无效输入拦截 | 点击翻转位；切换进制同步 | pending |
| T11 | 统计型 | M5 | T4 | 数据集面板、统计函数、空集/单元素边界 | 与 Excel 样本一致 | pending |
| T12 | 单位注册表 + 转换页 | M6 | T3 | 11 类单位数据、`convert_unit`、双下拉/换向 UI | 每类 3 组黄金值；温度往返 | pending |
| T13 | 汇率 | M6 | T12 | ECB 拉取/解析/缓存/TTL/离线 UI/手动刷新 | 断网缓存；5s 限速；交叉汇率 | pending |
| T14 | 日期计算 | M7 | T3 | 日期差/加减、`DatePicker`、本地化格式 | 闰年/月末夹取单测 | pending |
| T15 | 工作表 | M8 | T3 | 注册表、抵押/油耗/租赁、通用表单与结果卡 | 黄金月供 ±0.01；字段级校验 | pending |
| T16 | 打磨：DPI/无障碍/性能 | M9 | T5–T15 | DPI 矩阵、键盘全流程、reduced-motion、性能采样 | 冷启动/输入延迟/IPC p95 | pending |
| T17 | 打包 | M9 | T16 | 图标、NSIS/MSI、WebView2 策略、体积优化 | 安装/卸载/启动 | pending |
| T18 | QA 与文档 | M9 | T16,T17 | QA 矩阵记录、截图归档、README、已知问题 | 检查表全勾；截图可追溯 | pending |
| T19 | 发布与收尾 | M9 | T18 | 版本号、发布说明、产物归档、清理、复盘 | 产物清单核对；工作区干净 | pending |

**冲突与遗漏检查（T 表自审）**

- 需求逐项映射：四模式 → T4/T8/T9/T10/T11；单位 11 类 → T12；汇率 → T13；日期 → T14；工作表 → T15；历史 → T6；分组 → T5；复制粘贴/校验 → T7；i18n → T2；主题 → T2；DPI → T16；自定义控件 → T2/T3/T7；异常值 → T4/T5。
- 无重复所有者：格式化只在 T5 建立；历史只在 T6；汇率只在 T13；避免多处实现。
- 依赖无环：T0→T1→T2→T3→（T5…T15）→T16→T17→T18→T19；T4 与 T1/T2/T3 并行。
- 风险任务前置：Spike A/B 放 T3，结论影响 T16/T17，不会到发布阶段才暴露。
- 测试同步：每个功能任务必须随交付新增/更新对应测试（第 7.0 节），不允许“最后补测试”。

### M0 项目骨架与设计系统（2–3 人日）

**任务**
- [x] T0：配置 PATH（`export PATH="/e/node:$PATH"` / `setx PATH "%PATH%;E:\node"`），验证 `node -v`、`npm -v`
- [x] T0：根 `Cargo.toml` workspace（先含 `crates/calc-core`，T1 加入 `src-tauri`）+ 契约骨架 + `.gitignore`
- [x] T1：初始化 Tauri 2 + React 19 + TS + Vite；插件与 capabilities 最小权限；CI
- [x] T2：`tokens.css`（双主题）+ 基础控件 + 字体本地化 + i18n 骨架
- [x] T3：窗口 440×820、最小 380×640、`decorations:false`、`transparent:false`；`TitleBar` + `NavRail` + 路由占位（7 个主页面 + 2 个覆盖层，见 2.0）
- [x] T3：设置页与 store 读写（主题/语言/分组/角度制/字宽/进制/历史开关）
- [x] **Spike A（T3）**：无边框窗口拖拽/双击最大化/缩放/阴影/Snap；结论写回附录 B
- [x] **Spike B（T3）**：WebView2 在 100%–200% DPI 下渲染清晰度；Acrylic 可用性

**验收**
- `npm run tauri dev` 正常启动，无控制台报错
- 导航切换 7 个主页面；历史抽屉与设置弹层可开合；主题与语言即时切换且持久化
- 窗口拖动、缩放、最小化/最大化/关闭均正常，跨屏 DPI 不破版
- `cargo test --workspace`、`npm run typecheck` 通过

**验证命令**
```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run typecheck && npm run test
```

### M1 计算内核 v1：基本模式（2–3 人日）

**任务**
- [x] `value.rs`：Decimal 规范化、有效数字、尾零、极值
- [x] `parser.rs`：tokenizer + 递归下降解析（优先级、括号、一元函数）
- [x] `engine.rs`：会话状态机（输入数字、连算、重复 `=`、退格、CE/C、±、%）
- [x] 记忆（MC/MR/M+/M−/MS）与记忆槽
- [x] 错误类型（DivideByZero/Overflow/InvalidInput/DomainError/Syntax）及恢复路径
- [x] 原始值输出契约（`value::canonical`，不含分组；未单列 `format.rs`，见 1.3 T4 记录）
- [x] 单测：≥60 例（实际 82 项），覆盖优先级、连算、百分比语义、边界
- [ ] `proptest`：`parse(format(x)) == x` 往返（可选，未引入依赖）

**验收**
- `cargo test -p calc-core` 全绿；错误用例返回稳定 code
- 手工用例：`2+3×4=14`、`1÷0` 报错、重复 `=`、`50%`、`±`、连续退格

### M2 标准模式 UI + 历史 + 设置（2 人日）

**任务**
- [x] `Display`（表达式行 + 主值 + 自动缩字号 + 分组渲染 + 防抖 `aria-live`；复制按钮随 T7）
- [x] `Keypad`（4 列网格，对齐截图；hover/active 动效）
- [x] 记忆行（MC/MR/M+/M−/MS，单槽）；记忆面板需多槽记忆，未纳入本次迭代
- [x] 历史抽屉（按日期分组、按当前模式展示、点击恢复、删除、清空确认、复制、空状态）
- [ ] 剪贴板：复制原始值、粘贴清洗、无效提示
- [ ] 设置面板：主题/语言/分组开关/小数位/历史开关（`SoftSwitch`、`SoftSegmentedControl`）
- [x] 基本模式快捷键 + 覆盖层/输入框焦点门控（复制粘贴与 F1 说明随 T7/T16）
- [x] Vitest：格式化、键盘映射、BasicPage 组件（粘贴清洗随 T7）

**验收**
- 两主题、两语言下布局无溢出；100%/150% 缩放正常
- 分组开关即时生效，复制始终不带分组
- 历史重启保留、上限生效、清空有确认
- 键盘全流程可用（不使用鼠标）

### M3 科学型（2 人日）

**任务**
- [ ] 三角函数/反三角/双曲（DEG/RAD/GRAD 换算在入口统一）
- [ ] `ln log exp x^y x³ ∛ n! |x| floor ceil round rand π e 1/x x² √`
- [ ] 括号与优先级展示；`F-E` 科学记数法切换
- [ ] 定义域/溢出错误（如 `√-1`、`n!>170`、`log 0`）
- [ ] 科学键盘布局（5 列或两段式，保持 44px 最小点击区）
- [ ] 单测覆盖每个函数与角度制

**验收**
- `sin(30°) = 0.5`；`RAD` 下同输入结果正确
- `2^(3^2)=512`（右结合）；括号配对错误可恢复

### M4 程序员模式（2–3 人日，**重点**）

**任务**
- [ ] 进制 2/8/10/16 输入掩码与四种进制同步显示（QWORD/DWORD/WORD/BYTE）
- [ ] 字宽掩码 + 截断规则；负数补码显示
- [ ] 位运算：`AND OR XOR NOT LSH RSH ROL ROR MOD`（环绕移位在字宽内进行）
- [ ] 十进制整数算术 + 除法截断 + 溢出环绕（`wrapping_*`）
- [ ] 位网格：64/32/16/8 单元，可点击翻转、键盘可达（P1）
- [ ] 进制分组显示（4/3 位）+ 无效数字拦截
- [ ] 单测：位运算真值表、移位/旋转对称性（`ROL`/`ROR` 互逆）、字宽边界

**验收**
- `0xFF AND 0x0F = 0x0F`；`NOT 0`（BYTE）= `0xFF`；`ROL(0x8000_0000_0000_0001,1)` 正确环绕
- 二进制下输入 `2` 被拦截；切换到 BYTE 后高位截断且提示
- 64 位显示无精度丢失（不走 f64）

### M5 统计模式（1 人日）

**任务**
- [ ] 数据集面板（添加/编辑/删除/清空/排序显示）
- [ ] 函数：`Σx Σx² x̄ s σ n median mode range min max variance`
- [ ] 空集/单元素/全相同值的边界与提示
- [ ] 结果卡片 + 复制 + 写入历史
- [ ] Kahan 求和；显示精度策略

**验收**
- 已知样本（1..10）结果与 Excel 一致（容差内）
- 众数多值时按约定展示（全部列出或「无唯一众数」）

### M6 单位转换（2 人日）

**任务**
- [ ] 11 类单位注册表（id、符号、系数、仿射偏移）；单位名 i18n
- [ ] `convert_unit` 纯函数：双向换算、精度、极值（E 记法）
- [ ] 转换页 UI：`SoftCombobox` 双下拉 + 换向按钮 + 输入/结果卡片 + 复制
- [ ] 汇率：ECB 拉取、XML 解析、缓存、启动刷新、手动刷新、离线提示
- [ ] 校验：非法输入、负值（长度/质量）、温度为负数合法
- [ ] 单测：每类至少 3 组已知换算；温度往返（C↔F↔K）；汇率交叉换算

**验收**
- `1 km = 1000 m`、`0 °C = 32 °F = 273.15 K`、`1 MPa = 1000 kPa`
- 断网启动：显示缓存日期与警告，不崩溃；无缓存时给重试按钮
- 切换单位即时换算；换向按钮交换两侧

### M7 日期计算（1 人日）

**任务**
- [ ] 日期差：Y/M/D + 总天数 + 总周数（含起始日选项 P2）
- [ ] 日期加减：天/周/月/年，月末夹取、闰年
- [ ] `DatePicker` 自定义控件（月/年切换、键盘）
- [ ] 本地化日期格式；结果卡片与复制
- [ ] 单测：2/28→3/1、1/31+1 月、闰年 2/29、跨年

**验收**
- 2024-02-29 被识别为有效日期；2023-02-29 不可选
- 1/31 + 1 月 = 2/28（或 2/29）符合约定

### M8 工作表（2 人日）

**任务**
- [ ] 工作表注册表（id、字段 schema、校验、计算命令、i18n）
- [ ] 抵押贷款：本金/年利率/年限/还款方式（等额本息，等额本金 P2）→ 月供、总利息、总还款
- [ ] 油耗：距离/油耗/油价 → 总油耗、总费用；`L/100km ↔ mpg(US/UK)`
- [ ] 租赁：车价/残值/期限/利率/税费 → 月租、总成本
- [ ] 通用表单渲染 + 结果明细卡 + 复制
- [ ] 单测：公式黄金值（与在线计算器对齐）、除零/负值校验

**验收**
- 100 万、4.2%、30 年 → 月供与基准一致（±0.01）
- 非法输入（0 期限、负利率）给出字段级错误

### M9 打磨与发布（3–4 人日）

**任务**
- [ ] DPI 全矩阵巡检（100/125/150/175/200，双屏拖动）
- [ ] 两主题 × 两语言视觉回归（截图留档）
- [ ] 可访问性：键盘全流程、焦点顺序、aria、减少动效
- [ ] 性能：冷启动 <1.5s、输入到绘制 <50ms、IPC p95 <15ms
- [ ] 图标（SVG/ico/png 多尺寸）、安装包（NSIS + MSI）、WebView2 bootstrapper 策略
- [ ] 发布说明、README、截图、已知问题
- [ ] QA 检查表逐项打勾

**验收**
- `npm run tauri build` 产物可安装、可卸载、启动正常
- 冷启动与安装包体积达标（见第 8 节）

---

## 7. 测试与质量

### 7.0 测试随任务的变更（不做“最后补测试”）

| 任务 | 新增/修改的测试 | 路径 | 判定 |
|---|---|---|---|
| T0 | IPC 契约 serde 测试（tag、camelCase、错误码字符串） | `crates/calc-core/tests/contract.rs` | 序列化 JSON 与 TS 类型逐字段一致 |
| T2 | i18n 键集合/占位符；主题解析与存储容错 | `scripts/check-i18n.mjs`、`src/lib/theme.test.ts`、`src/i18n/i18n.test.ts` | 两语言键一致；system 解析与异常存储降级正确 |
| T4 | 值/解析/引擎单测 + 黄金用例 | `crates/calc-core/src/**/#[cfg(test)]`、`tests/golden/basic.json` | ≥60 例；错误码稳定 |
| T5 | 格式化（分组/有效数字/E 记法）与按键事件 | `src/lib/format.test.ts`、`src/features/basic/*.test.tsx` | 分组开关切换；Ctrl+C/V |
| T6 | 历史上限/排序/持久化/恢复 | `src-tauri/src/history.rs` 单测（日志排序/折叠/截断/删除/清空/serde） | 重启保留；超限淘汰 |
| T7 | 粘贴清洗（全角/分组符/0x/0b/超长） | `src/lib/clipboard.test.ts` | 非法输入不崩溃 |
| T8 | 每个科学函数 + 角度制 + 定义域 | `crates/calc-core/tests/scientific.rs` | 与基准值一致 |
| T9 | 位运算真值表 + ROL/ROR 互逆 + 字宽 | `crates/calc-core/tests/programmer.rs` | 属性测试通过 |
| T10 | 进制视图/分组/非法输入 | `src/features/programmer/*.test.tsx` | 四进制同步 |
| T11 | 统计样本与边界 | `crates/calc-core/tests/statistics.rs` | 与 Excel 对齐 |
| T12 | 11 类单位黄金值 | `crates/calc-core/tests/units.rs` | 每类 ≥3 组 |
| T13 | ECB XML 解析（固定 fixture）+ 离线分支 | `src-tauri/tests/currency.rs` | 无网络也可测 |
| T14 | 闰年/月末/跨年 | `crates/calc-core/tests/date.rs` | 边界日期 |
| T15 | 三个工作表公式 | `crates/calc-core/tests/worksheet.rs` | ±0.01 |
| T16 | 手工 QA 记录 + 性能采样 | `docs/qa/`（提交） | 矩阵全勾 |
| T17 | 安装/卸载冒烟 | `docs/qa/`（提交） | 产物可启动 |
| T18 | i18n 键一致 + 回归清单 | `scripts/check-i18n.mjs`、`docs/qa/` | CI 绿 |

**测试变更规则**

- 允许新增测试、修复错误断言；**禁止删除失败测试来“变绿”**。
- 修改黄金值必须在提交说明中给出依据（标准/公式/规范变化），并附来源。
- 网络相关测试必须使用固定 fixture，不在单测中访问外网。
- 覆盖率目标（可选，不作为门禁）：`ops/*` 行覆盖 ≥80%，`lib/format.ts` ≥90%。
- 测试文件与被测模块同目录（单测）或 `tests/`（集成/黄金），不集中在临时目录。

### 7.1 测试金字塔

| 层级 | 工具 | 覆盖 |
|---|---|---|
| 内核单测 | `cargo test` | 解析、运算、进制、位运算、单位、日期、工作表、格式化原始值 |
| 内核属性测试 | `proptest`（可选） | 往返、位运算互逆、移位不变量 |
| 前端单测 | Vitest | `format.ts`（分组/有效数字/E 记法/进制）、粘贴清洗、store、i18n 键 |
| 组件测试 | Vitest + RTL | 键盘事件、焦点陷阱、弹层交互 |
| 手工 QA | 检查表 | 模式 × 主题 × DPI × 语言 × 输入法 |
| E2E（P2） | tauri-driver + WebDriver | 冒烟：启动→基本运算→切模式→历史 |

### 7.2 黄金用例集

- `crates/calc-core/tests/golden/*.json`：每个模式的输入序列与期望视图；Rust 与 TS 共享同一批格式断言（TS 读取同一 JSON）。
- 单位/工作表基准值单独维护，注明来源与日期。

### 7.3 质量门禁（每 PR）

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run typecheck
npm run test
npm run check:i18n
```

---

## 8. 打包与发布

| 项 | 方案 |
|---|---|
| 标识符 | `com.glx.calculator`（待确认） |
| 产品名 | `Glx Calculator`（窗口标题走 i18n） |
| 图标 | 需提供源图；先用字母/算盘占位，`tauri icon` 生成多尺寸 |
| 安装包 | NSIS（默认）+ MSI；按用户级安装 |
| WebView2 | `downloadBootstrapper`（Win10/11 通常自带；Server 2022 需联网安装） |
| 体积预算 | exe < 10 MB；前端 JS < 250 KB gzip（不含字体） |
| 优化 | release：`lto="thin"`、`codegen-units=1`、`strip=true`；比较 `opt-level="s"` |
| 签名 | 暂无证书，文档说明 SmartScreen 提示；后续接入 |
| 自动更新 | 本迭代不做，保留版本号与 changelog 规范 |

---

## 9. 风险登记

| # | 风险 | 概率/影响 | 缓解 |
|---|---|---|---|
| 1 | 未安装 Node，无法构建前端 | 高/高 | M0 第一步安装并验证；CI 同样固定版本 |
| 2 | 无边框窗口在 Windows 上丢失拖拽/双击最大化/阴影/Snap | 中/高 | M0 Spike A 已验证通过（2026-11-19，含权限补齐）；原生标题栏回退方案保留 |
| 3 | Server 2022 无 Mica、Acrylic 不稳定 | 高/中 | 默认纯色 + 极低对比渐变；Spike B 确认 Mica 不可用，Acrylic 不启用，特效仍为可选 |
| 4 | 汇率接口被墙/离线 | 中/中 | 缓存 + 过期提示 + 重试；Rust 侧请求 |
| 5 | 科学型 f64 精度与用户预期不符 | 中/中 | 明确显示位数策略；关键用例固化；需要时启用 Decimal 路径 |
| 6 | 每次按键 IPC 造成卡顿 | 低/中 | 目标 p95 <15ms；M2 压测；必要时前端本地预览 + 防抖 |
| 7 | 多语言键漂移 | 中/低 | `check-i18n` CI 门禁 |
| 8 | 中文字体度量导致按钮换行 | 中/低 | 字体栈 + `tabular-nums` + 100%/150% 巡检 |
| 9 | 透明/模糊背景导致 WebView2 性能下降 | 中/低 | 不做默认；开启后限制模糊半径并做 FPS 检查 |
| 10 | 范围蔓延（补齐全部 Windows 工作表/绘图） | 高/中 | 本迭代锁定 3 个工作表；扩展走注册表新迭代 |

---

## 10. 待确认项（需要拍板，括号内为建议默认）

1. **前端栈**：React 19 + CSS Modules（推荐）/ Vue / Svelte？
2. **语言范围**：zh-CN + en-US（推荐）是否足够？是否需要 zh-TW / ja？
3. **汇率源**：接受 ECB（每日、29 币种、无 RUB、基准 EUR，推荐）还是需要实时/商业 API？
4. **首批工作表**：抵押 + 油耗 + 租赁（推荐）之外是否必须包含其他？
5. **窗口外观**：无边框自定义标题栏（推荐，需 Spike）/ 保留原生标题栏？
6. **品牌信息**：产品名、标识符、图标素材？（默认 `Glx Calculator` / `com.glx.calculator` / 临时图标）
7. **统计录入方式**：列表式录入后计算（推荐）/ 逐步累加？
8. **发布渠道**：仅本地构建 / GitHub Release；是否需要代码签名与自动更新？

---

## 11. 完成定义（DoD）

一个功能被视为完成，需同时满足：

- [ ] Rust 内核逻辑有单测，边界与错误路径覆盖
- [ ] UI 在 light/dark、zh-CN/en-US、100%/150% DPI 下检查通过
- [ ] 键盘可完成主流程，焦点可见，错误有文本
- [ ] 文案全部走 i18n（两份语言文件键一致）
- [ ] 复制/粘贴、历史、分组开关行为一致
- [ ] 无 `any`、无未处理 Promise、无控制台错误
- [ ] `fmt / clippy / test / typecheck / check:i18n` 全绿
- [ ] 变更未越过 3.10 的模块边界（无跨层逻辑、无文案/格式化错位）
- [ ] 测试按 7.0 随任务新增/更新，未删除失败测试或放宽断言
- [ ] IPC 契约变更已同步 `view.rs` / `ipc.ts` / 本文档，并有契约测试
- [ ] 临时产物已按 12.3 清理，提交中无构建缓存/日志/截图/依赖目录
- [ ] 本文档对应 T/M 状态已更新，并有可评审提交（`feat|fix|chore|docs(scope): ...`）

---

## 12. 收尾流程、产物留存与清理

### 12.1 单个任务（T）收尾

1. 代码与随任务测试同时完成（见 7.0）。
2. 本地跑对应验证命令；失败不得提交。
3. 更新本文档：T 状态、所属 M 的勾选、Spike 结论（如涉及）。
4. 清理本任务产生的临时文件（脚本输出、临时截图、fixture 副本）。
5. 提交：`<type>(<scope>): <english summary>`，一个任务一个可评审提交；不混合无关改动。

**任务完成判定**：功能可用 + 测试通过 + 文档更新 + 无临时文件 + 提交信息准确。

### 12.2 里程碑（M）收尾

- 全量门禁：`fmt / clippy / test / typecheck / vitest / check:i18n`。
- 跨模式回归：至少覆盖「启动 → 各模式切换 → 运算 → 历史 → 复制/粘贴 → 主题/语言切换」。
- 截图归档：两主题 × 两语言的当前模式截图存入 `docs/qa/YYYY-MM-DD/`（只提交精选图，体积 <2 MB）。
- 更新风险表与附录 B；新增风险必须给出缓解措施。
- 里程碑提交合并到 `main`；发布前不打 tag。

### 12.3 产物分类与留存

| 产物 | 位置 | 是否入库 | 留存策略 | 清理方式 |
|---|---|---|---|---|
| 源码、配置、锁文件 | 仓库 | ✅ | 永久 | — |
| 内核构建缓存 | `target/`、`src-tauri/target/` | ❌ | 可随时重建 | `cargo clean` |
| 前端依赖/构建 | `node_modules/`、`dist/` | ❌ | 可随时重建 | 删除目录后 `npm ci` |
| 安装包 | `src-tauri/target/release/bundle/` | ❌ | 复制到 `release/vX.Y.Z/`，本地保留最近 2 个版本 | 删除旧目录 |
| QA 截图 | `docs/qa/YYYY-MM-DD/` | ✅（精选） | 每个里程碑保留一套 | 删除过程截图 |
| 性能/日志采样 | `artifacts/` | ❌ | 保留最近一次 | 覆盖或删除 |
| 应用日志 | `%LOCALAPPDATA%\com.glx.calculator\logs\` | ❌（仓库外） | 插件轮转，保留 7 个文件 | 设置中可清理 |
| 汇率缓存 | `%APPDATA%\com.glx.calculator\currency-cache.json` | ❌（仓库外） | TTL 24h | 删除以模拟首次启动 |
| 设置/历史 | `%APPDATA%\com.glx.calculator\*.json` | ❌（仓库外） | 用户数据，不清理 | 设置中“恢复默认” |

`release/`、`artifacts/` 必须写入 `.gitignore`；`docs/qa/` 仅提交截图与简短记录，不提交录屏。

### 12.4 常用清理命令

```bash
# 构建缓存
cargo clean

# 前端依赖与产物（需要时重装）
rm -rf node_modules dist
npm ci

# 重新打包前清掉旧产物，避免误用
rm -rf src-tauri/target/release/bundle
```

> 清理前确认没有未提交改动；不要用 `git clean -xfd` 代替人工确认。

### 12.5 Git 卫生与提交规范

- 提交前：`git status`、`git diff --staged` 人工检查；确认无 `target/`、`node_modules/`、日志、截图、缓存、密钥。
- 提交信息使用英文 Conventional Commits：`feat(programmer): add rol/ror word-size masking`、`docs(plan): freeze module boundaries and task list`。
- 不跳过 hooks（禁止 `--no-verify`）；hook 失败先修根因。
- 一个任务一个提交；契约变更单独提交并同时在说明中列出前端/后端两侧文件。

### 12.6 发布留存

- 版本：`MAJOR.MINOR.PATCH`；安装包与校验和放入 `release/vX.Y.Z/`（不入库）。
- 发布说明：`docs/release/vX.Y.Z.md`（入库），包含变更、已知问题、数据来源。
- 归档：保留当前与上一版本产物；更早版本按需删除。

### 12.7 失败与回滚

- 测试/构建失败：修复根因；禁止通过删除测试、放宽断言、关闭 lint 来“通过”。
- 需要回滚时用 `git revert <commit>` 生成反向提交；不使用 `reset --hard` 覆盖他人工作。
- 契约回滚必须同步回滚两侧代码与本文档。

---

## 13. 文档自审记录（已修正的矛盾与不清点）

| # | 位置 | 原问题 | 修正 |
|---|---|---|---|
| 1 | 0 / 6 / M0 | “7 个模式 + 单位转换 + 设置”与“9 个占位页”口径不一致 | 新增 2.0 导航表：7 个主页面 + 2 个覆盖层 |
| 2 | 4.3 / 4.7 | 一处说“复制始终原始值”，菜单又写“复制原始值” | 默认复制原始值；菜单额外提供“复制显示值” |
| 3 | 4.2 | 深色主按钮填充 `#6366f1` 与白字对比度不足 | 两主题统一 `#4f46e5` 填充，并补充 hover/active |
| 4 | 3.5 | 工作表/汇率用 Decimal 但未说明幂与舍入 | 明确整数指数 `powi`、最终金额 `MidpointAwayFromZero` |
| 5 | 3.7 / 2.1 | 历史上限“500”与“可配置”并存 | 默认 500，范围 100–1000 |
| 6 | 2.1 / M5 | 统计录入方式未定义 | 明确为列表式录入后计算 |
| 7 | 3.5 | 科学 `n!` 上限与 Decimal 能力关系不清 | 注明 f64 路径上限 170，超出返回 `Unsupported` |
| 8 | 2.1 / M4 | 64 位 NOT/负数显示是否带符号未定义 | 主显示有符号 i64；radix 视图显示字宽内无符号补码 |
| 9 | 2.1 / M7 | 日期差 Y/M/D 语义未定义 | 按日历分量差（先年、再月、再日，日不足借位） |
| 10 | 3.7 / 3.8 | 汇率缓存写入方不明确 | 统一走 store 抽象，仅 src-tauri/storage 写入 |
| 11 | 1.1 | Node “未安装”已过时 | 更新为 `E:\node` 已安装、缺 PATH，并给出配置命令 |
| 12 | 1.1 / 2.0 | 单位“11 类”是否等于 11 个导航项不清 | 明确为 1 个转换页面 + 11 个二级类目 |
| 13 | 4.7 / 6 | 错误态恢复规则粗略 | 明确数字/退格恢复、运算符先清除、Esc/C 立即清除 |
| 14 | 3.10 / 7 | 模块职责、测试归属、清理归属分散 | 增补 3.10 边界、7.0 测试归属、第 12 节收尾 |
| 15 | 1.3 / 6.0 T1 | `typescript-eslint` 不支持 TS 7，原定 ESLint 无法落地 | 改用 `oxlint@1.94`；1.3 记录偏差与回溯条件 |
| 16 | 4.2 | light 文字 muted `#64748b` 在 12px 下对比度仅 4.34:1 | 改为 `#5c6b80`（4.95:1）；dark 保持 `#94a3b8`（约 7.3:1） |
| 17 | 3.9 / T3 | capabilities 仅列插件权限，未说明自绘标题栏需要窗口写权限 | T3 实测补 `core:window:allow-start-dragging/minimize/toggle-maximize/close`；`core:default` 仅含读取与 drag-region 双击最大化 |
| 18 | 4.7 / T4 | CE 后待处理表达式的显示语义未定义 | T5 明确：有待处理表达式时 CE 保留表达式并显示 `0`；无待处理表达式时清空显示与结果（附引擎测试） |
| 19 | 3.5 / T5 | 基本模式的 E 记法阈值未定义 | 基本模式最多 16 位有效数字；指数 ≥16 或 ≤−16 转 E 记法，阈值由 `lib/format.ts` 参数化 |
| 20 | 3.4 / T6 | 历史记录由谁写入、去重与恢复语义未定义 | 前端在完成的 `=` 后调用 `history_add`；条目最新在前、仅折叠与最新一条相同的连续重复；恢复使用 `Recall` 不重新求值；列表/清空按模式隔离 |

**仍待确认（不阻塞 T0/T1）**：第 10 节的 8 项产品/发布决策；其中「前端栈、语言范围、ECB、首批工作表、无边框窗口」影响 T2/T3/T13/T15/T17，建议在 M0 结束前拍板。

---

## 附录 A：调研命令与证据

```
rustc 1.98.1 / cargo 1.98.1
默认 host: x86_64-pc-windows-msvc
已安装 target: x86_64-pc-windows-msvc
Visual Studio: 2022 已安装（另有 18 目录）
WebView2: 157.0.4341.46、157.0.4341.60
node: E:\node\node.exe v24.21.0
npm:  E:\node\npm.cmd 11.19.0（PATH 未包含 E:\node）
pnpm: 未安装（本计划不使用）
tauri-cli: 未安装
ECB: GET eurofxref-daily.xml → 200, 1547 bytes, time='2026-11-18',
     29 currencies incl. CNY (7.3126), base EUR
crates: tauri 2.12.7, rust_decimal 1.43.0, chrono 0.4.45,
        reqwest 0.13.5, quick-xml 0.42.0
npm: react 19.3.1, vite 8.3.8, typescript 7.0.2, zustand 5.1.0,
     i18next 27.2.1, vitest 5.1.1
```

## 附录 B：M0 Spike 记录（待填写）

| Spike | 问题 | 结论 | 日期 |
|---|---|---|---|
| A | `decorations:false` 下拖拽 / 双击最大化 / 缩放 / 阴影 / Snap | **通过**。窗口具备 `WS_THICKFRAME/MINBOX/MAXBOX`，双击最大化/还原、标题栏拖拽、顶部 Snap、边缘缩放、自绘按钮均正常；需在 capabilities 补 `start-dragging/minimize/toggle-maximize/close`，`core:default` 不含窗口写操作。 | 2026-11-19 |
| B | Server 2022 下 Acrylic/透明与 DPI 清晰度 | **通过（纯色降级）**。Build 20348 无 Mica；窗口 opaque，不启用 Acrylic。设备模拟 100%/125%/150%/175%/200% 布局无溢出，175% 实机渲染清晰。 | 2026-11-19 |
| C | IPC 单次命令延迟（20 次按键均值/p95） | **通过**。T5 在 Tauri dev + WebView2 CDP 实测 20 次 `calc_command`：均值 1.77 ms、p95 2.5 ms（目标 <15 ms）。 | 2026-11-19 |