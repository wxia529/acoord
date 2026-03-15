# SIESTA fdf 格式支持

## 实现的功能

### 1. 前端文件类型支持

#### package.json 配置
- ✅ 添加 `*.fdf` 到 customEditors 文件模式匹配
- ✅ 更新编辑器标题菜单的 when 条件，支持 .fdf 扩展名
- ✅ 文件预览图标自动识别

### 2. Save / Save As 支持

#### Save (原位保存)
- ✅ 支持直接保存 .fdf 文件
- ✅ **格式保持策略**：保留所有非块参数
  - `XC.functional`, `XC.authors`
  - `Mesh.Cutoff`, `PAO.EnergyShift`
  - `MaxSCFIterations`, `SCF.*`
  - `OccupationFunction`, `ElectronicTemperature`
  - `kgrid_Monkhorst_Pack`
  - `MD.*` 参数
  - 注释行

#### Save As (另存为)
- ✅ 在导出格式选项中添加 "SIESTA fdf (.fdf)"
- ✅ 支持从任意格式导出为 .fdf
- ✅ 自动生成完整的 fdf 结构

### 3. 增减原子操作

#### 自动更新的内容
- ✅ `NumberOfAtoms` - 根据实际原子数更新
- ✅ `NumberOfSpecies` - 根据元素种类数更新
- ✅ `%block ChemicalSpeciesLabel` - 自动添加/删除物种条目
  - 格式：`索引  原子序数   元素符号`
  - 原子序数从 `ELEMENT_DATA` 自动获取
- ✅ `%block LatticeVectors` - 晶格向量更新
- ✅ `%block AtomicCoordinatesAndAtomicSpecies` - 坐标更新

#### 保持不变的内容
- ✅ 所有非块参数（计算设置、MD 参数等）
- ✅ 注释位置和格式
- ✅ 参数顺序和空白行

### 4. 序列化实现细节

#### replaceSections 方法
```typescript
private replaceSections(rawContent: string, structure: Structure): string {
  // 1. 更新 NumberOfAtoms
  // 2. 更新 NumberOfSpecies
  // 3. 更新 ChemicalSpeciesLabel block
  // 4. 更新 LatticeVectors block
  // 5. 更新 AtomicCoordinatesAndAtomicSpecies block
  // 6. 保持其他所有内容不变
}
```

#### replaceBlock 方法
- 使用正则表达式匹配块结构
- 保留 `%block` 和 `%endblock` 标签
- 只替换块内容

## 使用示例

### 1. 打开 fdf 文件
```typescript
// VS Code 中右键点击 .fdf 文件
// 选择 "Open With" -> "ACoord Structure Editor"
// 或直接双击（如果已设置为默认）
```

### 2. 编辑后保存
```typescript
// 在编辑器中修改原子位置/添加删除原子后
// Ctrl+S (或 Cmd+S) 直接保存
// 所有 SIESTA 参数保持原样
```

### 3. 另存为 fdf
```typescript
// 从其他格式（如 CIF、XYZ）打开
// 点击保存按钮
// 选择 "SIESTA fdf (.fdf)" 格式
// 自动生成完整的 fdf 结构
```

## 测试验证

### 测试用例
1. ✅ 解析水分子结构 (3 原子)
2. ✅ 添加原子后正确更新计数
3. ✅ 删除原子后正确更新计数
4. ✅ 添加新元素自动更新物种列表
5. ✅ Round-trip: parse → serialize → parse 数据一致
6. ✅ 非块内容完全保留

### 测试命令
```bash
# 运行单元测试
npm run test:unit

# 测试特定功能
node --import tsx -e "
import { SIESTAParser } from './src/io/parsers/siestaParser.js';
import { readFileSync } from 'fs';

const parser = new SIESTAParser();
const content = readFileSync('src/test/fixtures/water.fdf', 'utf-8');
const structure = parser.parse(content);

// 添加/删除原子测试
structure.addAtom(...);
structure.atoms.pop();

// 序列化验证
const serialized = parser.serialize(structure);
console.log(serialized);
"
```

## 文件格式示例

### 输入 (water.fdf)
```fdf
SystemName          Water
SystemLabel         H2O

NumberOfAtoms       3
NumberOfSpecies     2

%block ChemicalSpeciesLabel
  1  8   O
  2  1   H
%endblock ChemicalSpeciesLabel

%block LatticeVectors
  15.0   0.0   0.0
  0.0   15.0   0.0
  0.0    0.0  15.0
%endblock LatticeVectors

AtomicCoordinatesFormat  Fractional

%block AtomicCoordinatesAndAtomicSpecies
  0.5   0.5   0.5   1
  0.5375   0.5   0.675   2
  0.4625   0.5   0.675   2
%endblock AtomicCoordinatesAndAtomicSpecies

# SIESTA calculation parameters
XC.functional          GGA
XC.authors             PBE
Mesh.Cutoff            300.0 Ry
kgrid_Monkhorst_Pack    1  1  1
```

### 输出 (添加一个 C 原子后)
```fdf
SystemName          Water
SystemLabel         H2O

NumberOfAtoms       4
NumberOfSpecies     3

%block ChemicalSpeciesLabel
  1  8   O
  2  1   H
  3  6   C
%endblock ChemicalSpeciesLabel

%block LatticeVectors
  15.0000000000   0.0000000000   0.0000000000
  0.0000000000   15.0000000000   0.0000000000
  0.0000000000   0.0000000000   15.0000000000
%endblock LatticeVectors

AtomicCoordinatesFormat  Fractional

%block AtomicCoordinatesAndAtomicSpecies
  0.5000000000   0.5000000000   0.5000000000   1
  0.5375000000   0.5000000000   0.6750000000   2
  0.4625000000   0.5000000000   0.6750000000   2
  0.0666666667   0.0666666667   0.0666666667   3
%endblock AtomicCoordinatesAndAtomicSpecies

# SIESTA calculation parameters
XC.functional          GGA
XC.authors             PBE
Mesh.Cutoff            300.0 Ry
kgrid_Monkhorst_Pack    1  1  1
```

注意：
- `NumberOfAtoms`: 3 → 4 ✅
- `NumberOfSpecies`: 2 → 3 ✅
- `ChemicalSpeciesLabel`: 添加了 C 物种 ✅
- `AtomicCoordinates`: 添加了 C 原子坐标 ✅
- **所有其他参数保持不变** ✅

## 文件清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/io/parsers/siestaParser.ts` | fdf 解析器/序列化器 | ✅ 完成 |
| `src/io/parsers/index.ts` | 导出 SIESTAParser | ✅ 完成 |
| `src/io/fileManager.ts` | 注册 .fdf 扩展名 | ✅ 完成 |
| `src/services/documentService.ts` | Save As 格式选项 | ✅ 完成 |
| `package.json` | 文件类型关联 | ✅ 完成 |
| `src/test/fixtures/water.fdf` | 水分子测试 fixture | ✅ 完成 |
| `src/test/unit/parsers/siestaParser.test.mts` | 单元测试 | ✅ 完成 |

## 已知限制

1. **不支持的 SIESTA 特性**（第一版）:
   - `SuperCell` block
   - `Geometry.Constraints` / `GeometryConstraints`
   - Selective Dynamics（per-atom 固定标志）
   - 轨迹解析（多帧）

2. **坐标格式**:
   - 输入：支持 Fractional, Ang, Bohr, ScaledCartesian
   - 输出：统一使用 Fractional 格式

这些限制可以在后续版本中根据需求添加。

## 验证清单

- ✅ fdf 文件可以在 VS Code 中用 ACoord 打开
- ✅ 预览图标正确显示
- ✅ Save 操作保留所有非块参数
- ✅ Save As 可以选择 fdf 格式
- ✅ 添加原子自动更新计数和物种列表
- ✅ 删除原子自动更新计数和物种列表
- ✅ 添加新元素自动更新物种映射
- ✅ Round-trip 数据一致性
- ✅ 所有单元测试通过 (343/343)
- ✅ Lint 检查通过 (0 errors)
