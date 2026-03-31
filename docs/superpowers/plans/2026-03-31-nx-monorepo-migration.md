# Nx Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 acoord-3d 和 vscode-acoord 两个独立项目整合为基于 Nx 的 Monorepo，实现本地依赖链接和统一的构建/测试流程。

**Architecture:** 使用 Nx 作为 monorepo 工具，vscode-acoord 直接依赖 acoord-3d 本地包而非 npm 包，通过 Nx 的项目依赖图管理构建顺序。

**Tech Stack:** Nx, TypeScript, npm workspaces (底层), Three.js, ESBuild, Mocha

---

## File Structure

### 根目录新增/修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 Nx 和 workspace 配置 |
| `nx.json` | 新增 | Nx 核心配置文件 |
| `tsconfig.base.json` | 新增 | 根目录 TypeScript 基础配置 |
| `.gitignore` | 修改 | 添加 Nx 缓存目录 |
| `docs/superpowers/plans/` | 新增 | 计划文档目录 |

### acoord-3d 修改文件

| 文件 | 修改说明 |
|------|----------|
| `acoord-3d/package.json` | 移除 `prepublishOnly` 脚本（monorepo 内不需要） |
| `acoord-3d/tsconfig.json` | 继承根目录 base config |

### vscode-acoord 修改文件

| 文件 | 修改说明 |
|------|----------|
| `vscode-acoord/package.json` | 将 `acoord-3d` 依赖改为 workspace 引用 |
| `vscode-acoord/tsconfig.json` | 继承根目录 base config，添加路径映射 |

---

## Tasks

### Task 1: 初始化 Nx Monorepo 根目录配置

**Files:**
- Create: `nx.json`
- Create: `tsconfig.base.json`
- Modify: `package.json`
- Create: `.gitignore` (追加)

- [ ] **Step 1: 创建 nx.json**

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [],
    "production": [
      "default",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/**/*.test.mts",
      "!{projectRoot}/**/*.spec.ts"
    ]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "defaultBase": "main"
}
```

- [ ] **Step 2: 创建 tsconfig.base.json**

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "exclude": ["node_modules", "dist", "out", "**/node_modules/**", "**/dist/**", "**/out/**"]
}
```

- [ ] **Step 3: 修改根目录 package.json**

读取当前 `package.json`，修改为：

```json
{
  "name": "acoord-monorepo",
  "version": "0.0.0",
  "private": true,
  "description": "ACoord Atomic Structure Toolkit Monorepo",
  "workspaces": [
    "acoord-3d",
    "vscode-acoord"
  ],
  "scripts": {
    "build": "nx run-many --target=build --all",
    "build:acoord-3d": "nx run acoord-3d:build",
    "build:vscode-acoord": "nx run vscode-acoord:build",
    "test": "nx run-many --target=test --all",
    "test:acoord-3d": "nx run acoord-3d:test",
    "test:vscode-acoord": "nx run vscode-acoord:test",
    "watch": "nx run-many --target=watch --all",
    "lint": "nx run-many --target=lint --all",
    "dev": "nx run vscode-acoord:watch"
  },
  "devDependencies": {
    "nx": "^20.x.x"
  }
}
```

- [ ] **Step 4: 追加 .gitignore**

在根目录创建或追加 `.gitignore`：

```
# Nx
.nx/cache
.nx/workspace-data
dist/nx

# Dependencies
node_modules

# Build outputs
dist
out

# Logs
*.log
npm-debug.log*
```

- [ ] **Step 5: 安装 Nx**

```bash
npm install
```

Expected: Nx 安装完成，创建 workspace-data

- [ ] **Step 6: 验证 Nx 项目图**

```bash
npx nx show projects
```

Expected: 输出 `acoord-3d` 和 `vscode-acoord`

---

### Task 2: 配置 acoord-3d 为 Nx 库项目

**Files:**
- Modify: `acoord-3d/package.json`
- Modify: `acoord-3d/tsconfig.json`
- Create: `acoord-3d/project.json`

- [ ] **Step 1: 创建 project.json**

```json
{
  "name": "acoord-3d",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "acoord-3d/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "nx:run-script",
      "options": {
        "script": "build"
      },
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "watch": {
      "executor": "nx:run-script",
      "options": {
        "script": "watch"
      }
    },
    "test": {
      "executor": "nx:run-script",
      "options": {
        "script": "test"
      },
      "dependsOn": ["build"]
    }
  },
  "tags": ["scope:lib", "type:lib"]
}
```

- [ ] **Step 2: 修改 tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declarationMap": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: 修改 package.json**

移除 `prepublishOnly` 脚本：

```json
{
  "name": "acoord-3d",
  "version": "0.1.0",
  ...
  "scripts": {
    "build": "node build.config.mjs",
    "watch": "node build.config.mjs --watch",
    "test": "mocha --import tsx --timeout 5000 'test/**/*.test.ts'"
  }
}
```

- [ ] **Step 4: 验证构建**

```bash
npx nx run acoord-3d:build
```

Expected: 构建成功，输出 `dist/index.js` 和 `dist/index.d.ts`

---

### Task 3: 配置 vscode-acoord 为 Nx 应用项目

**Files:**
- Modify: `vscode-acoord/package.json`
- Modify: `vscode-acoord/tsconfig.json`
- Create: `vscode-acoord/project.json`

- [ ] **Step 1: 创建 project.json**

```json
{
  "name": "vscode-acoord",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "vscode-acoord/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "nx:run-script",
      "options": {
        "script": "compile"
      },
      "outputs": ["{projectRoot}/out", "{projectRoot}/media/webview/dist"],
      "cache": true,
      "dependsOn": ["^build"]
    },
    "watch": {
      "executor": "nx:run-script",
      "options": {
        "script": "watch"
      }
    },
    "test": {
      "executor": "nx:run-script",
      "options": {
        "script": "test:unit"
      },
      "dependsOn": ["build"]
    },
    "lint": {
      "executor": "nx:run-script",
      "options": {
        "script": "lint"
      }
    },
    "docs:dev": {
      "executor": "nx:run-script",
      "options": {
        "script": "docs:dev"
      }
    },
    "docs:build": {
      "executor": "nx:run-script",
      "options": {
        "script": "docs:build"
      }
    }
  },
  "tags": ["scope:app", "type:app"]
}
```

- [ ] **Step 2: 修改 package.json**

将 `acoord-3d` 依赖改为 workspace 引用：

```json
{
  "name": "acoord",
  ...
  "dependencies": {
    "@vscode/webview-ui-toolkit": "^1.4.0",
    "acoord-3d": "*",
    "three": "^0.183.2"
  },
  ...
}
```

- [ ] **Step 3: 修改 tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./out",
    "rootDir": "./src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node", "mocha"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", ".vscode-test"]
}
```

- [ ] **Step 4: 验证依赖图**

```bash
npx nx graph
```

Expected: 显示 vscode-acoord → acoord-3d 依赖关系

---

### Task 4: 验证 Monorepo 构建流程

**Files:** 无修改

- [ ] **Step 1: 测试完整构建**

```bash
npx nx run-many --target=build --all
```

Expected: 两个项目都构建成功

- [ ] **Step 2: 测试依赖构建顺序**

```bash
npx nx run vscode-acoord:build
```

Expected: 自动先构建 acoord-3d，再构建 vscode-acoord

- [ ] **Step 3: 测试 acoord-3d 测试**

```bash
npx nx run acoord-3d:test
```

Expected: 所有测试通过

- [ ] **Step 4: 测试 vscode-acoord 单元测试**

```bash
npx nx run vscode-acoord:test
```

Expected: 所有单元测试通过

- [ ] **Step 5: 验证 Nx 缓存**

```bash
npx nx show projects
npx nx run acoord-3d:build  # 第二次运行
```

Expected: 第二次构建显示 `[read from cache]`

---

### Task 5: 优化开发者体验

**Files:**
- Create: `README.md` (根目录)
- Modify: `acoord-3d/README.md`
- Modify: `vscode-acoord/DEVELOPMENT.md`

- [ ] **Step 1: 创建根目录 README.md**

```markdown
# ACoord Monorepo

Atomic Coordinate Toolkit - 原子结构可视化与编辑工具

## 项目结构

```
acoord/
├── acoord-3d/          # 3D 渲染引擎库 (Three.js)
├── vscode-acoord/      # VS Code 扩展应用
├── nx.json             # Nx 配置
└── package.json        # Workspace 配置
```

## 快速开始

```bash
# 安装依赖
npm install

# 构建所有项目
npm run build

# 开发模式
npm run watch

# 运行所有测试
npm run test
```

## 常用命令

```bash
# 构建特定项目
npx nx run acoord-3d:build
npx nx run vscode-acoord:build

# 测试特定项目
npx nx run acoord-3d:test
npx nx run vscode-acoord:test

# 查看依赖图
npx nx graph

# 受影响的测试（基于 git 变更）
npx nx affected:test
```

## 开发工作流

1. **日常开发**: `npm run watch` + F5 调试
2. **提交前检查**: `npm run lint && npm run test`
3. **查看变更影响**: `npx nx affected:build`

## 文档

- [vscode-acoord 开发文档](vscode-acoord/DEVELOPMENT.md)
- [acoord-3d 使用文档](acoord-3d/README.md)
```

- [ ] **Step 2: 更新 acoord-3d/README.md**

在开头添加：

```markdown
> **注意**: 本库是 [acoord monorepo](../README.md) 的一部分。
> 开发时请使用 `npx nx run acoord-3d:build` 或 `npm run watch` (在 monorepo 根目录)。

# acoord-3d

Atomic structure 3D rendering engine powered by Three.js
```

- [ ] **Step 3: 更新 vscode-acoord/DEVELOPMENT.md**

在 Quick Commands 部分添加：

```markdown
## Monorepo 命令

本项目位于 acoord monorepo 中。推荐使用 Nx 命令：

```bash
# 从 monorepo 根目录运行
npx nx run vscode-acoord:build      # 构建
npx nx run vscode-acoord:watch      # 开发模式
npx nx run vscode-acoord:test       # 测试
npx nx run vscode-acoord:lint       # 检查
```
```

---

## Self-Review Checklist

- [ ] **Spec coverage**: 所有 monorepo 迁移需求都有对应任务
- [ ] **No placeholders**: 每个步骤都有具体代码/命令
- [ ] **Type consistency**: package.json 依赖版本一致
- [ ] **File paths**: 所有路径都是精确的相对/绝对路径
- [ ] **Commands**: 所有命令都有预期输出说明

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-03-31-nx-monorepo-migration.md`**. Two execution options:

**1. Subagent-Driven (recommended)** - 每个任务 dispatch 一个 subagent，任务间 review，快速迭代

**2. Inline Execution** - 在当前 session 使用 executing-plans 执行，批量执行带检查点

**选择哪种方式？**
