# Lumen 应用图标与打包资源

- `icon-1024.png`：主图 1024×1024
- `icon.png`：通用 PNG
- `icon.icns`：macOS 应用图标（electron-builder 使用）
- `icon.ico`：Windows 应用图标（electron-builder 使用）
- `icon.iconset/`：生成 icns 的中间资源

应用名：**Lumen**（`productName` / `CFBundleDisplayName`）

## Windows 打包

推荐在 **Windows 机器** 或 **GitHub Actions `windows-latest`** 上执行：

```bash
npm install
npm run dist:win
```

产物在 `release/`：

- `Lumen-*-win-x64.exe`：NSIS 安装包
- `Lumen-*-win-portable.exe`：免安装绿色版

在 macOS 上交叉编译 Windows 安装包通常需要 Wine，不稳定；可用：

```bash
npm run electron:build:win:dir
```

仅生成未封装目录（调试用），完整安装包仍建议在 Windows 上打。
