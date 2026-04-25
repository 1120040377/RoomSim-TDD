# RoomSim-TDD 架构文字说明

> 最后更新：2026-04-25

---

## 1. 项目概述

**RoomSim-TDD** 是一个纯浏览器端的"装修前空间感知模拟器"。用户在二维平面编辑器中绘制房间（墙体、门窗、家具），然后切换到第一人称 3D 漫游视角，直观感受空间布局，从而在装修施工前做出更好的决策。

**核心定位**：面向普通业主，非专业 CAD 软件，无需后端，静态部署即可使用。

**主要技术栈**：

| 层次 | 技术 |
|------|------|
| 框架 | Vue 3.4 + TypeScript 5.3 |
| 状态管理 | Pinia 2 |
| 路由 | Vue Router 4（Hash 模式） |
| 2D 绘图 | Konva.js 9 |
| 3D 渲染 | Three.js 0.160 + TresJS |
| 本地存储 | Dexie 4（IndexedDB） |
| 数据校验 | Zod 3.22 |
| 样式 | UnoCSS 0.58 |
| 构建 | Vite 5 + pnpm |
| 测试 | Vitest 1.1（单元）+ Playwright 1.40（E2E） |

---

## 2. 目录结构

```
RoomSim-TDD/
├── src/
│   ├── views/                 # 三个页面视图
│   ├── components/            # 通用 UI 组件
│   ├── modules/
│   │   ├── model/             # 类型定义、Zod Schema、默认值
│   │   ├── store/             # Pinia 状态（plan、editor、history）
│   │   ├── commands/          # 14+ 命令对象（墙/门窗/家具）
│   │   ├── geometry/          # 纯几何算法（无框架依赖）
│   │   ├── editor/            # Konva.js Canvas 及工具策略
│   │   ├── walkthrough/       # Three.js 构建器 + FPS 控制
│   │   ├── ergonomics/        # 人体工程学规则引擎（8 条规则）
│   │   ├── storage/           # Dexie IndexedDB + 导入导出
│   │   └── templates/         # 家具目录 + 内置房间模板
│   ├── router/                # 路由配置（3 条路由）
│   ├── styles/                # UnoCSS 样式
│   └── main.ts                # 应用入口
├── tests/
│   ├── unit/                  # 单元测试（18 套，124 条）
│   └── e2e/                   # E2E 冒烟测试（3 条核心路径）
├── .github/workflows/
│   └── deploy.yml             # CI/CD：类型检查 → 测试 → 构建 → GitHub Pages
└── ...（配置文件）
```

---

## 3. 数据模型

整个应用的唯一数据实体是 `Plan`，所有 2D/3D 功能都从这一份数据衍生：

```
Plan
├── meta              配置信息（单位、网格尺寸、默认墙高/厚）
├── nodes             墙节点（顶点）字典
├── walls             墙体（边）字典
├── openings          门窗字典（关联所在墙 + 沿墙偏移量）
├── furniture         家具字典（位置、旋转、尺寸、颜色）
├── rooms             房间多边形字典（自动检测 + 用户命名）
└── walkthrough       漫游配置（视角高度、起始位置和朝向）
```

**单位约定**：所有 2D 数值以厘米（cm）存储；Three.js 渲染时统一乘以 0.01 转换为米。

---

## 4. 核心架构模式

### 4.1 单向数据流

```
用户操作
   │
   ▼
Command 对象（do/undo 合约）
   │
   ▼
HistoryStore（维护撤销/重做栈，最多 50 条）
   │
   ▼
PlanStore（shallowRef<Plan>，不可变更新）
   │
   ├──► Konva.js 2D Canvas（订阅 Plan 状态重绘）
   └──► Three.js 3D 场景（订阅 Plan 状态重建网格）
```

`Plan` 存储在 `shallowRef` 中，所有修改只替换顶层及变更节点的对象引用（Object Spread），避免 Vue 深层响应式对大型几何数据的性能开销。

### 4.2 命令模式（Command Pattern）

每一个用户动作都封装为一个 Command 对象：

```
Command 接口
├── do()    执行操作（调用 Store 内部方法）
└── undo()  撤销操作（反向调用 Store 内部方法）
```

共 14+ 个命令：
- 墙体：`AddWall`、`MoveNode`、`UpdateWall`、`RemoveWall`
- 门窗：`AddOpening`、`MoveOpening`、`UpdateOpening`、`RemoveOpening`
- 家具：`AddFurniture`、`MoveFurniture`（可合并）、`RotateFurniture`、`UpdateFurniture`、`DuplicateFurniture`、`RemoveFurniture`
- 组合：`BatchCommand`（多步操作打包，如加载模板）

连续的 Move/Rotate 命令会自动合并，避免撤销栈被拖拽操作快速填满。

### 4.3 策略模式（Tool Strategy）

编辑器工具采用策略模式：每种工具实现统一的 `Tool` 接口。

```
Tool 接口
├── onPointerDown/Move/Up   指针事件
├── onKeyDown               键盘快捷键
├── renderPreview           预览层渲染
└── onActivate/Deactivate   工具切换生命周期
```

当前工具类：`SelectTool`（V）、`WallTool`（W）、`RectRoomTool`（R）、`DoorTool`、`WindowTool`、`FurnitureTool`。

### 4.4 纯几何层（Pure Geometry Layer）

`modules/geometry/` 中的所有算法：
- **无任何框架依赖**（不引入 Vue/Konva/Three.js）
- 供 2D 编辑器和 3D 漫游共用
- 100% 单元测试覆盖

主要模块：
- `collision.ts`：圆 vs 有向包围盒（OBB）碰撞检测 + 滑动算法
- `room-detect.ts`：平面面遍历算法（从墙体检测封闭房间多边形）
- `opening-cut.ts`：将墙体按门窗位置切割为若干墙段
- `snap.ts`：四级对齐系统（网格 / 端点 / 中点 / 垂足）

### 4.5 坐标约定（Locked Convention）

坐标系转换在 `walkthrough/coord.ts` 中集中管理，并有专项测试保护：

| 空间 | X | Y | Z | 角度 |
|------|---|---|---|------|
| 2D 编辑器 | 向右 | 向下（屏幕坐标） | — | atan2(dy, dx) |
| Three.js 3D | 向右 | 向上（高度） | 朝外 | — |

转换公式：`three(x, heightZ, y) = editor(x, y) × 0.01`，角度取反。

### 4.6 2D Canvas 分层渲染

Konva.js 使用 6 个渲染层，实现高效拾取与局部重绘：

| 层序 | 内容 |
|------|------|
| Layer 0 | 背景 + 网格 |
| Layer 1 | 墙体 |
| Layer 2 | 门窗 |
| Layer 3 | 家具 |
| Layer 4 | 房间（多边形区域） |
| Layer 5 | 预览层（临时操作反馈） |

### 4.7 人体工程学规则引擎

`modules/ergonomics/` 实现了一个基于注册表的规则引擎：

```
ErgonomicsEngine.register(rule)
rule.check(plan) → Warning[]
```

8 条内置规则：
1. 走道净宽（通行路径最小宽度）
2. 床侧净空（床周围活动空间）
3. 沙发到茶几距离
4. 沙发到电视距离
5. 餐椅拉出空间
6. 门扇开启净空
7. 厨房三角动线（灶台/水槽/冰箱）
8. 净层高预警

### 4.8 响应式自动存储

通过 Vue `watch` 监听 `planStore.plan` 的浅层变化，5 秒防抖写入 IndexedDB（Dexie）；页面跳转/卸载时立即刷新，保证数据不丢失。

---

## 5. 存储层

```
storage/
├── db.ts           Dexie 数据库定义（plans 表：id, name, updatedAt, data）
├── plan-repo.ts    仓储层（CRUD + 自动保存，5s 防抖）
├── io.ts           JSON 导入导出（导入前 Zod 校验）
└── migrations.ts   Schema 版本迁移（当前 v1）
```

---

## 6. 路由结构

Hash 路由，支持静态托管，无需服务端重写：

| 路径 | 视图 | 说明 |
|------|------|------|
| `/` | `HomeView` | 方案列表 + 模板选择 |
| `/editor/:id` | `EditorView` | 2D 平面编辑器 |
| `/walkthrough/:id` | `WalkthroughView` | 3D 第一人称漫游 |

---

## 7. CI/CD 流水线

`.github/workflows/deploy.yml`，触发条件：推送 `main` 分支或手动触发。

```
1. Checkout
2. pnpm install（frozen lockfile）
3. vue-tsc 类型检查
4. pnpm test（Vitest 单元测试）
5. pnpm build（BASE_URL 设置为 GitHub Pages 子路径）
6. 配置 Pages（action 自动开启）
7. 上传 dist/ 制品
8. 部署到 GitHub Pages
```

---

## 8. 测试策略

### 单元测试（18 套，124 条，Vitest）

| 覆盖模块 | 测试内容 |
|----------|----------|
| `geometry/*` | 碰撞滑动、房间检测、对齐层级、墙体切割 |
| `commands/*` | do/undo 等价性、Move/Rotate 合并行为 |
| `store/history` | 栈管理、合并、容量限制 |
| `walkthrough/*` | 坐标变换、墙段数量、碰撞构建 |
| `ergonomics/*` | 8 条规则的正/反例 Fixture |
| `model/*` | Zod Schema 校验、默认值 |
| `storage/*` | 迁移骨架 |
| `templates/*` | 内置模板合规性 |

### E2E 测试（3 条冒烟路径，Playwright + Chromium）

1. 创建方案 → 加载模板 → 编辑 → 返回列表 → 刷新后仍存在
2. 加载模板 → 进入漫游 → Canvas 渲染 + 视角高度可调
3. 导入损坏 JSON → 展示报错 → 原方案不变

---

## 9. 关键算法简述

**圆 vs OBB 碰撞**：将圆心转换到包围盒局部坐标，对最近点做 Clamp，比较距离与半径。圆心在盒内时特殊处理，确保弹出方向正确。

**滑动算法**：将大位移拆分为步长 ≤ radius/2 的若干小步，每步检测所有障碍物并沿法线推开，最多迭代 3 次，防止穿透（tunneling）。

**平面面遍历（房间检测）**：构建边的角度邻接表，从每条未访问边出发沿"最紧左转"循环遍历，识别 CCW 封闭环为内部房间，最大面积的环为外轮廓。

**墙体切割**：将门窗按沿墙偏移量排序，生成"门窗前段 / 门窗间段 / 门窗后段"墙段列表，每段携带高度范围，供 3D 网格构建使用。

**四级对齐**：网格对齐（默认 5cm/20cm）→ 端点吸附（10cm 半径）→ 中点吸附 → 垂足吸附（最近墙的垂线交点）。

---

## 10. 扩展点

- 新增编辑工具：实现 `Tool` 接口并注册到工具栏。
- 新增命令：实现 `Command` 接口（`do`/`undo`），通过 `HistoryStore.execute()` 执行。
- 新增人体工程学规则：实现 `ErgonomicsRule` 接口并调用 `engine.register()`。
- 数据迁移：在 `storage/migrations.ts` 中新增版本处理函数。
- 新增家具模型：在 `templates/furniture-catalog.ts` 中补充条目。
