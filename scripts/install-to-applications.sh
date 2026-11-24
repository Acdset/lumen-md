#!/usr/bin/env bash
# 打包 Lumen 并安装到 /Applications
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Lumen"
DEST="/Applications/${APP_NAME}.app"
SKIP_BUILD=0
OPEN_AFTER=1
# 本地安装默认跳过 Developer ID 签名（可快很多）；正式分发用 --sign
SKIP_SIGN=1

usage() {
  cat <<EOF
用法: $(basename "$0") [选项]

  打包 Lumen Mac 应用并安装到 /Applications

选项:
  --skip-build   跳过打包，直接安装已有 release 中的 .app
  --no-open      安装后不自动打开
  --sign         启用 Developer ID 代码签名（默认关闭，本地安装更快）
  --no-sign      明确跳过签名（默认行为）
  -h, --help     显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --no-open) OPEN_AFTER=0 ;;
    --sign) SKIP_SIGN=0 ;;
    --no-sign) SKIP_SIGN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
  shift
done

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) ARCH_DIR="mac-arm64" ;;
  x86_64) ARCH_DIR="mac" ;;
  *) ARCH_DIR="mac-${ARCH}" ;;
esac

find_built_app() {
  local candidates=(
    "$ROOT/release/${ARCH_DIR}/${APP_NAME}.app"
    "$ROOT/release/mac/${APP_NAME}.app"
    "$ROOT/release/mac-arm64/${APP_NAME}.app"
    "$ROOT/release/${APP_NAME}.app"
  )
  local p
  for p in "${candidates[@]}"; do
    if [[ -d "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  # 兜底：在 release 下搜索
  local found
  found="$(find "$ROOT/release" -maxdepth 3 -type d -name "${APP_NAME}.app" 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    echo "$found"
    return 0
  fi
  return 1
}

echo "==> 工作目录: $ROOT"
echo "==> 目标: $DEST"

if [[ ! -f "$ROOT/build/icon.icns" ]]; then
  echo "警告: 未找到 build/icon.icns，打包后可能没有自定义图标"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  if [[ ! -d "$ROOT/node_modules" ]]; then
    echo "==> 安装依赖…"
    npm install
  fi

  # 确保 Electron 二进制完整
  if [[ -f "$ROOT/scripts/ensure-electron.mjs" ]]; then
    node "$ROOT/scripts/ensure-electron.mjs" || true
  fi

  echo "==> 构建并打包 (electron-builder --mac dir)…"
  # 国内镜像：避免每次打包都从 GitHub 拉 Electron（且与已有缓存 URL 对得上）
  export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
  export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"
  if [[ "$SKIP_SIGN" -eq 1 ]]; then
    echo "==> 跳过代码签名（本地安装默认；需要签名请加 --sign）"
    export CSC_IDENTITY_AUTO_DISCOVERY=false
  else
    echo "==> 启用 Developer ID 代码签名"
    unset CSC_IDENTITY_AUTO_DISCOVERY || true
  fi
  # dir 产物可直接复制，比打 dmg 更快
  npx vite build
  npx electron-builder --mac dir --publish never
else
  echo "==> 跳过打包，使用已有产物"
fi

SRC_APP="$(find_built_app || true)"
if [[ -z "${SRC_APP:-}" ]]; then
  echo "错误: 未找到 ${APP_NAME}.app"
  echo "请先运行不带 --skip-build 的安装，或检查 release/ 目录"
  exit 1
fi

echo "==> 找到应用: $SRC_APP"

# 关闭正在运行的实例，避免覆盖失败
if pgrep -f "${APP_NAME}.app/Contents/MacOS" >/dev/null 2>&1; then
  echo "==> 正在退出已运行的 ${APP_NAME}…"
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  sleep 1
  pkill -f "${APP_NAME}.app/Contents/MacOS" >/dev/null 2>&1 || true
  sleep 1
fi

echo "==> 安装到 ${DEST}…"
# 需要写 /Applications 时可能提示权限；用户目录 Applications 作回退
if [[ -w "/Applications" ]] || [[ -w "$(dirname "$DEST")" ]]; then
  rm -rf "$DEST"
  ditto "$SRC_APP" "$DEST"
else
  echo "没有 /Applications 写权限，尝试使用 sudo…"
  sudo rm -rf "$DEST"
  sudo ditto "$SRC_APP" "$DEST"
  sudo chown -R "$(whoami):staff" "$DEST" 2>/dev/null || true
fi

# 清除隔离属性，减少「无法打开 / 已损坏」误报（未签名开发包常见）
echo "==> 清除隔离属性…"
xattr -cr "$DEST" 2>/dev/null || true

# 刷新 Launch Services，使「打开方式 / 默认应用」能识别 .md 关联
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$LSREGISTER" ]]; then
  echo "==> 注册文件类型关联…"
  "$LSREGISTER" -f "$DEST" >/dev/null 2>&1 || true
fi

echo "==> 安装完成: $DEST"

if [[ "$OPEN_AFTER" -eq 1 ]]; then
  echo "==> 正在打开 ${APP_NAME}…"
  open "$DEST"
fi

echo "完成。"
