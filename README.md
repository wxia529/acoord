# ACoord Monorepo

Atomic Coordinate Toolkit - 原子结构可视化与编辑工具

## 项目结构

```
acoord/
├── packages/
│   └── acoord-3d/      # 3D 渲染引擎库 (Three.js) → npm 发布
├── apps/
│   └── vscode-acoord/  # VS Code 扩展应用
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
