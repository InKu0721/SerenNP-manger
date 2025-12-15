# SerenNP Manager

<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="SerenNP Logo">
</p>

<p align="center">
  <strong>现代化的 POC 漏洞检测模板管理工具</strong>
</p>

<p align="center">
  基于 Go + Wails 构建，支持 Windows、macOS、Linux 多平台
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go" alt="Go">
  <img src="https://img.shields.io/badge/Wails-v2.11-EB5757?style=flat-square" alt="Wails">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.2-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform">
</p>

---

## 📥 下载安装

### 直接下载

从 [Releases](../../releases) 页面下载对应平台的预编译版本：

| 平台 | 文件 | 说明 |
|------|------|------|
| **Windows** | `SerenNP-Manager-windows-amd64.exe` | Windows 10/11 64位 |
| **macOS (Intel)** | `SerenNP-Manager-macos-amd64` | Intel 芯片 Mac |
| **macOS (Apple Silicon)** | `SerenNP-Manager-macos-arm64` | M1/M2/M3 芯片 Mac |
| **Linux** | `SerenNP-Manager-linux-amd64` | 64位 Linux |

### 运行说明

**Windows：**
- 双击 `SerenNP Manager.exe` 运行
- 首次运行可能需要允许 Windows 防火墙

**macOS：**
```bash
# 添加执行权限
chmod +x SerenNP-Manager-macos-*

# 运行（可能需要在系统偏好设置中允许）
./SerenNP-Manager-macos-arm64
```

**Linux：**
```bash
chmod +x SerenNP-Manager-linux-amd64
./SerenNP-Manager-linux-amd64
```

---

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 📁 **POC 模板管理** | 创建、编辑、删除、导入/导出 Nuclei YAML 模板 |
| ✏️ **可视化编辑器** | Monaco 代码编辑器 + 可视化表单双模式 |
| 🎯 **漏洞扫描** | 批量目标扫描，实时进度显示 |
| 📊 **结果分析** | 按严重程度分类，查看请求/响应详情 |
| 🔧 **编码工具** | Base64、URL、Unicode、Hex、AES、MD5、SHA 等 |
| 🎨 **现代 UI** | 深色主题，流畅动画，响应式布局 |

---

## 🛠️ 技术栈

| 类型 | 技术 | 版本 |
|------|------|------|
| **后端** | Go | 1.22+ |
| **桌面框架** | Wails | v2.11 |
| **前端框架** | React | 18 |
| **类型系统** | TypeScript | 5.2 |
| **样式** | TailwindCSS | 3.3 |
| **构建工具** | Vite | 5.0 |
| **编辑器** | Monaco Editor | 4.6 |
| **加密库** | crypto-js | 4.2 |

---

## 🚀 使用指南

### 1. POC 模板管理

- **新建模板**：POC 模板 → 新建
- **编辑模板**：点击模板卡片
- **导入模板**：支持导入标准 Nuclei YAML 模板
- **搜索过滤**：按名称、分类、严重程度筛选

### 2. 执行扫描

1. 进入 **扫描器** 页面
2. 输入目标 URL（每行一个）
3. 选择 POC 模板
4. 点击 **启动扫描**
5. 实时查看进度和结果

### 3. 查看结果

- 按严重程度过滤
- 点击 **查看 POC** 跳转模板
- 点击 **查看数据包** 显示请求/响应

### 4. 编码工具

支持 Base64、URL、Unicode、Hex、HTML、AES、MD5、SHA 等编解码

---

## 🔨 从源码编译

### 环境要求

- Go 1.22+
- Node.js 18+
- Wails CLI v2

### Windows 编译

```powershell
# 安装依赖
winget install GoLang.Go
winget install OpenJS.NodeJS.LTS

# 安装 Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 编译
cd nuclei-poc-manager
wails build -platform windows/amd64
```

### macOS 编译

```bash
# 安装依赖
brew install go node

# 安装 Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 编译 Intel 版本
wails build -platform darwin/amd64

# 编译 Apple Silicon 版本
wails build -platform darwin/arm64
```

### Linux 编译

```bash
# 安装依赖 (Ubuntu/Debian)
sudo apt install golang nodejs npm libgtk-3-dev libwebkit2gtk-4.0-dev

# 安装 Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 编译
wails build -platform linux/amd64
```

### 开发模式

```bash
cd nuclei-poc-manager
wails dev
```

编译产物位于 `build/bin/` 目录。

---

## 🔗 内置扫描功能

### 完整扫描流程

#### 步骤 1：创建 POC 模板

1. **POC 模板** → **新建**
2. 使用可视化编辑器或代码编辑器
3. 配置 HTTP 请求和匹配规则
4. 保存模板

#### 步骤 2：配置扫描

在 **设置** 页面调整：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 并发数 | 10 | 同时扫描任务数 |
| 超时 | 30s | 请求超时时间 |
| 速率限制 | 100/s | 每秒请求数 |

#### 步骤 3：执行扫描

1. **扫描器** → 输入目标 URL
2. 选择模板 → **启动扫描**
3. 实时查看进度

#### 步骤 4：查看结果

- **扫描结果** 页面查看所有发现
- 支持按严重程度筛选
- 查看完整请求/响应数据包

---

## 📝 模板格式

兼容标准 Nuclei 模板格式：

```yaml
id: sql-injection-test

info:
  name: SQL Injection Detection
  author: your-name
  severity: high
  description: 检测 SQL 注入漏洞
  tags: sqli,web

http:
  - method: GET
    path:
      - "{{BaseURL}}/search?q=1' AND '1'='1"

    matchers:
      - type: word
        words:
          - "SQL syntax"
          - "mysql_fetch"
        condition: or
```

---

## 📁 项目结构

```
nuclei-poc-manager/
├── main.go              # 应用入口
├── app.go               # 主应用逻辑
├── wails.json           # Wails 配置
├── build/
│   ├── appicon.png      # 应用图标
│   ├── bin/             # 编译输出
│   └── windows/         # Windows 资源
├── internal/
│   ├── models/          # 数据模型
│   ├── poc/             # POC 管理器
│   └── scanner/         # 扫描引擎
├── frontend/
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── App.tsx      # 主组件
│   │   └── types.ts     # 类型定义
│   └── package.json
├── templates/           # POC 模板目录
└── .github/workflows/   # CI/CD 配置
```

---

## 🤖 自动化构建

项目配置了 GitHub Actions，推送 tag 时自动构建所有平台版本：

```bash
# 创建版本标签
git tag v1.0.0
git push origin v1.0.0
```

自动构建：
- ✅ Windows (amd64)
- ✅ macOS (amd64 + arm64)
- ✅ Linux (amd64)

---

## ❓ 常见问题

### Windows 上程序无法启动？

确保已安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 已预装）

### macOS 提示"无法验证开发者"？

```bash
# 方法 1：系统偏好设置 → 安全性与隐私 → 仍要打开

# 方法 2：移除隔离属性
xattr -cr SerenNP-Manager-macos-*
```

### Linux 启动失败？

确保已安装 GTK 和 WebKit：
```bash
sudo apt install libgtk-3-0 libwebkit2gtk-4.0-37
```

---

## 📄 许可证

MIT License

## 🙏 致谢

- [ProjectDiscovery](https://github.com/projectdiscovery) - Nuclei
- [Wails](https://wails.io/) - Go 桌面框架
- [TailwindCSS](https://tailwindcss.com/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
