# M0 QA — 2026-11-19

- 环境：Windows Server 2022（10.0.20348）、WebView2 157.0.4341.60、系统缩放 175%（DPI 168）。
- 版本：T3 收尾（无边框外壳、导航、7 页占位、设置持久化）。
- 方式：Win32 窗口样式检查 + 输入注入（拖拽/Snap/缩放/按钮），WebView2 CDP（DOM、控制台、设置、DPI 设备模拟）。

## 结果

| 项 | 结果 |
|---|---|
| 窗口外壳 | `decorations:false`、`shadow:true`；`WS_THICKFRAME/MINBOX/MAXBOX` 就绪 |
| 交互 | 双击最大化/还原、拖拽移动、顶部 Snap、边缘缩放、自绘最小化/最大化/还原/关闭均通过 |
| 权限 | `core:default` 不含窗口写操作；已补 `start-dragging/minimize/toggle-maximize/close` |
| 设置 | 主题/语言/分组/历史开关/上限/角度制/字宽/进制可读写；重启保留；恢复默认成功 |
| 导航 | 7 个主页面 hash 路由，历史抽屉与设置弹层可开合，`Ctrl+H` 打开历史 |
| 主题/语言 | light/dark × zh-CN/en-US 即时切换，无未翻译裸键 |
| DPI | 100%/125%/150%/175%/200% 下布局无溢出；175% 实机清晰 |
| 控制台 | 0 error / 0 warning（favicon 404 已修复） |
| 测试 | 前端 31 项、Rust 10 项通过 |

## 截图

均为 440×820、设备缩放 1x，用于两主题 × 两语言回归。

- `m0-light-zh-basic.png`
- `m0-light-en-basic.png`
- `m0-dark-zh-basic.png`
- `m0-dark-en-basic.png`
- `m0-dark-en-settings.png`

# T5 标准模式 UI — 2026-11-19

- 方式：Edge headless CDP（精确 440×820，light/dark × zh-CN/en-US）+ Tauri dev / WebView2 CDP（真实 IPC、键盘、记忆、错误路径）。
- 环境：同上；Tauri 窗口逻辑尺寸 441×821（设备缩放 175%）。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | 440×820 下 `scrollWidth/clientWidth = 440`、`scrollHeight/clientHeight = 820`；24 个按键全部在视口内（keypad 296–796），无横向溢出 |
| 运算 | `2 + 3 × 4 =` → `14`；表达式行显示 `2 + 3 × 4 =` |
| 分组 | `1000 × 1000 =` → `1,000,000`；关闭分组后即时取消分隔 |
| 错误 | `1 ÷ 0` → 显示「不能除以零」，表达式行保留 `1 ÷ 0` |
| CE | `2 + 3 CE` → 值 `0`、表达式 `2 +`；继续 `4 =` → `6` |
| 记忆 | MS 后出现 `M` 指示；C 后按 MR 恢复 `500` |
| 键盘 | 数字、运算符、Enter、Esc、Backspace、% 与 F9/R/Q/@ 均映射到命令；覆盖层打开时不拦截 |
| IPC | 20 次 `calc_command` 均值 1.77 ms、p95 2.5 ms、最大 2.5 ms |
| 控制台 | 0 error |
| 测试 | 前端 55 项、Rust 92 项通过 |

## 截图

- `t5-light-zh-CN-basic.png`、`t5-light-en-US-basic.png`、`t5-dark-zh-CN-basic.png`、`t5-dark-en-US-basic.png`（440×820，1x）
- `t5-tauri-verified.png`（真实 Tauri WebView2，`2 + 3 × 4 =` 结果 14，逻辑 441×821 @175%）

# T6 历史记录 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC/存储/剪贴板）+ Edge headless（440×820 截图）。
- 环境：同上。

## 结果

| 项 | 结果 |
|---|---|
| 记录 | `2 + 3 =` 与 `10 × 2 =` 各生成一条；最新在前，按「今天/昨天」分组 |
| 恢复 | 点击 `2 + 3 =` 后抽屉关闭，显示区值为 `5`、表达式保留；继续 `× 2 =` 得 `10` 并新增条目 |
| 复制 | 写系统剪贴板为原始值 `10`（`Get-Clipboard` 校验），UI 提示「已复制」 |
| 删除 | 单条删除后抽屉与 `history.json` 同步 |
| 清空 | 二次确认（确认→取消→确认）；清空后展示空状态，文件 `entries` 为 `[]` |
| 持久化 | 重启应用后历史保留、计算会话归零 |
| 开关/上限 | 关闭历史后 `9 × 9 =` 不记录；105 条后上限改为 100，内存与文件均保留最新 100 条 |
| 布局 | 440×820 下 light/dark × zh-CN/en-US 抽屉无溢出，控制台 0 error |
| 测试 | 前端 67 项、Rust 103 项通过 |

## 截图

- `t6-light-zh-CN-history.png`、`t6-light-en-US-history.png`、`t6-dark-zh-CN-history.png`、`t6-dark-en-US-history.png`（440×820，1x）

# T7 剪贴板 + 右键菜单 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC 与系统剪贴板）；截图使用 CDP 设备模拟 440×820（1x）与真实 175% DPI 各一套。QA 前后已恢复系统剪贴板与持久化设置。

## 结果

| 项 | 结果 |
|---|---|
| 复制 | 显示区复制按钮 → 原始值 `1234567`；右键「复制显示值」→ `1,234,567`；均提示「已复制」 |
| 粘贴 | Ctrl+V `1,234` → `1234`；全角 `１２３＋４５` → `168`；表达式 `2×(3+4)` → `14`（表达式行保留 `2 × (3 + 4)`） |
| 进制前缀 | `0xFF` → `255`（基本模式转十进制，BigInt 不丢精度） |
| 校验 | 1,001 字符 → 「粘贴内容过长」；空剪贴板 → 「剪贴板为空」；`abc` → 「剪贴板内容无法粘贴」且显示值保持不变 |
| 右键菜单 | 4 项：复制原始值（Ctrl+C）/ 复制显示值 / 粘贴（Ctrl+V）/ 清除（Esc）；无值时复制项禁用；Esc 关闭菜单不清值 |
| 覆盖层 | 菜单打开时 Ctrl+H 先关闭菜单再打开历史；菜单不浮于抽屉之上 |
| 布局 | 440×820 下 light/dark × zh-CN/en-US 菜单完整可见，无溢出 |
| 控制台 | 0 error / 0 warning |
| 测试 | 前端 93 项、Rust 103 项通过 |

## 截图

- `t7-light-zh-CN-menu.png`、`t7-light-en-US-menu.png`、`t7-dark-zh-CN-menu.png`、`t7-dark-en-US-menu.png`（440×820，1x）
- `t7-tauri-verified.png`（真实 Tauri WebView2，`2 + 3 =` 与右键菜单，772×1437 @175%）

# T8 科学型 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC/设置/历史）；截图使用 CDP 设备模拟 440×820（1x）与真实 175% DPI 各一套。QA 前后已恢复设置与系统剪贴板，并清空科学型历史。

## 结果

| 项 | 结果 |
|---|---|
| 三角函数 | DEG `sin(30)` → `0.5`；RAD `π ÷ 2 =` 后 `sin` → `1`；GRAD `sin(100)` → `1`，`settings.json` 的 `angleUnit` 同步为 `grad` |
| 大数 | `170!` → `7.25741561530799e+306`（f64，超出 Decimal 值域） |
| F-E | `1,234.5` → `1.2345e+3`，再次点击恢复 `1,234.5` |
| 随机 | 连续两次 `rand` 结果不同，均落在 `[0,1)` |
| 定义域 | `tan(90)`、`ln(0)` 显示「超出定义域」，表达式行保留原输入；输入 `5` 后正常恢复 |
| 历史 | `sin(30) =` 作为完整表达式记录；恢复后显示 `0.5`，角度制仍为 DEG，继续计算正确 |
| 剪贴板/菜单 | Ctrl+C 复制 `0.5`；右键菜单仍为 4 项，Esc 关闭且不清值 |
| 布局 | 441×821 客户端尺寸、`scrollWidth/Height` 与视口一致；6×8 键位全部在视口内 |
| 控制台 | 0 error（含错误路径与随机/历史操作） |
| 测试 | 前端 105 项、Rust 132 项通过 |

## 截图

- `t8-light-zh-CN-scientific.png`、`t8-light-en-US-scientific.png`、`t8-dark-zh-CN-scientific.png`、`t8-dark-en-US-scientific.png`（440×820，1x，`sin(30)=0.5`）
- `t8-tauri-verified.png`（真实 Tauri WebView2，`170!` 结果，772×1437 @175%）


# T11 统计型 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/dark × zh-CN/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__` 渲染真实前端；内核算法由 Rust 集成测试覆盖。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376；12 个函数键、10 行数据集全部在视口内，无横向/纵向溢出 |
| 样本 | 数据 `1..10`，点击 `x̄` → `5.5`，表达式 `mean(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) =` |
| 添加 | 输入 `11` → 11 项，结果卡片清空 |
| 编辑 | 编辑第 1 项载入输入框；改为 `2` 后原位置更新 |
| 删除/排序 | 删除首项回到 10 项；排序 `录入 → 升序 → 降序`，降序显示下标 `9…0` |
| 清空/空集 | 二次确认后 0 项；点击 `Σx` 显示「请先添加至少一个数值。」 |
| 主题/语言 | 四组均正常，0 console error |
| 测试 | 前端 136 项、Rust 179 项通过 |

## 截图

- `t11-light-zh-CN-statistics.png`、`t11-light-en-US-statistics.png`、`t11-dark-zh-CN-statistics.png`、`t11-dark-en-US-statistics.png`（440×820，1x，均值结果）
- `t11-light-zh-CN-statistics-empty.png`（清空后的空状态与空集提示）

# T12 单位转换 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/dark × zh-CN/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（目录与换算结果）渲染真实前端；内核换算与目录由 Rust 集成测试覆盖。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；全部按钮在视口内，无横向/纵向溢出 |
| 默认 | 长度 `1 km → m` = `1,000`，公式 `1 km = 1,000 m` |
| 单位切换 | 目标改英尺 → `3,280.83989501` |
| 换向 | `1 ft → km` = `0.0003048` |
| 类别切换 | 温度默认 `°C → °F`，`1 °C` = `33.8 °F` |
| 汇率 | 显示「汇率数据不可用」与「汇率数据将在联网后更新。」（T13 接入 ECB 数据） |
| 复制 | 复制规范值 `0.001`（长度默认对调为 m→km） |
| 下拉 | 类别列表 portal 渲染、选中项高亮、滚动正常 |
| 主题/语言 | 四组均正常，0 console error |
| 测试 | 前端 150 项、Rust 203 项通过 |

## 截图

- `t12-light-zh-CN-converter.png`、`t12-light-en-US-converter.png`、`t12-dark-zh-CN-converter.png`、`t12-dark-en-US-converter.png`（440×820，1x，`1 km = 1,000 m`）
- `t12-light-zh-CN-converter-options.png`（类别下拉）
- `t12-light-zh-CN-converter-currency.png`（汇率离线提示）

# T13 ECB 汇率 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（目录、汇率状态、换算与刷新失败）渲染真实前端；ECB XML 解析、缓存与离线分支由 Rust fixture 集成测试覆盖，QA 不访问外网。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；全部按钮在视口内 |
| 在线态 | 状态条显示「数据来源：ECB · 2026-11-18」与刷新按钮；`1 EUR = 1.1585 USD` |
| 刷新成功 | 刷新后保留来源/日期并重算当前货币结果 |
| 刷新失败 | 结果保留，显示「汇率更新失败，使用 2026-11-18 数据」 |
| 离线态 | dark/en-US 显示 `No exchange rates available`、`Exchange rate data is unavailable` 与重试提示 |
| 控制台 | 0 console error / 0 异常 |
| 测试 | 前端 153 项、Rust 218 项通过（Rust 含 ECB fixture 与离线分支 5 项集成测试） |

## 截图

- `t13-light-zh-CN-currency.png`（在线态与来源日期）
- `t13-light-zh-CN-currency-refresh-failed.png`（刷新失败保留缓存）
- `t13-dark-en-US-currency-offline.png`（离线无缓存）

# T14 日期计算 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（设置、`date_diff`/`date_add` 的 JS 镜像）渲染真实前端；闰年、月末夹取与越界由 Rust 日期集成测试覆盖。
- 交互：点击结束日期触发器 → 下个月 → 15 日；切换「日期加减」→ 减 → 个月；dark 下打开起始日期并切换到 2024-02 / 2023-02。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；按钮无越界（20 / 54 个） |
| 日期差 | `2026-11-19 → 2026-12-15` 显示 `0 年 0 个月 26 天`，总天数 26、总周数 3 周 5 天 |
| 日期加减 | 起始 `2026-11-19` − 1 个月 = `2026-10-19`，公式与 ISO 日期同步 |
| 日历弹层 | dark/en-US 312×359，位于视口内（左 104、上 271、右 416、下 630） |
| 闰年 | 2024-02 可选中 29 日；上一年的 2023-02 无 29 日 |
| 主题/语言 | light/zh-CN 与 dark/en-US 均无裸键、无截断、0 console error / 0 异常 |
| 测试 | 前端 180 项、Rust 227 项通过 |

## 截图

- `t14-light-zh-CN-datecalc.png`（日期差 26 天与总计）
- `t14-light-zh-CN-date-add.png`（减 1 个月）
- `t14-dark-en-US-datecalc.png`（同日起始态）
- `t14-dark-en-US-date-picker.png`（日历弹层，2024-02 含 29 日）

# T15 工作表 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（设置、`worksheet_catalog`/`worksheet_compute` 的 JS 镜像）渲染真实前端；公式、边界与溢出由 Rust 工作表集成测试覆盖。
- 交互：切换「油耗」；dark/en-US 切换「Lease」；残值改为 `300000`（等于车价）触发跨字段校验。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/776；三张表按钮/输入均无越界，0 异常 |
| 抵押 | `1,000,000 / 4.2% / 30 年` → 月供 `4,890.17`、总额 `1,760,461.20`、利息 `760,461.20` |
| 油耗 | `500 km / 7.5 L/100km / 7.5` → `37.5 L`、`281.25`、`31.36 mpg(US)`、`37.66 mpg(UK)` |
| 租赁 | 默认 `300000 / 150000 / 36 / 5% / 0%` → `5,104.17`、`183,750.12`、`33,750.00` |
| 校验 | 残值 300000 时残值输入高亮并显示「Residual value must be below the vehicle price」，结果区提示「Fix the highlighted fields to recalculate」 |
| 主题/语言 | light/zh-CN 与 dark/en-US 均无裸键、无裁切、0 console error |
| 测试 | 前端 188 项、Rust 243 项通过 |

## 截图

- `t15-light-zh-CN-worksheet-mortgage.png`（抵押默认结果）
- `t15-light-zh-CN-worksheet-fuel.png`（油耗与 mpg 明细）
- `t15-dark-en-US-worksheet-lease.png`（租赁两列表单）
- `t15-dark-en-US-worksheet-lease-invalid.png`（残值跨字段校验）
