#!/usr/bin/env bash
# 签名 + 公证，输出可分发的 Lumen *.dmg
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# security 里完整名称；传给 electron-builder 时不要带 "Developer ID Application:" 前缀
IDENTITY_FULL="Developer ID Application: Hui Yin (4M9R74FAPG)"
IDENTITY="Hui Yin (4M9R74FAPG)"
TEAM_ID="4M9R74FAPG"
APPLE_ID_DEFAULT="lx_xszs@sina.com"
PROFILE_NAME="lumen-notary"
ENV_FILE="$ROOT/.env.signing"
DEFAULT_API_KEY="/Users/huiyin/Documents/证书/AuthKey_8BJRC3A8KP.p8"
DEFAULT_API_KEY_ID="8BJRC3A8KP"

usage() {
  cat <<EOF
用法: $(basename "$0") [选项]

  使用 Developer ID 签名并公证，打包 macOS dmg。

选项:
  --setup-credentials   用 API Key / App 专用密码写入钥匙串
  --skip-notarize       只签名，不公证
  -h, --help
EOF
}

SETUP_ONLY=0
SKIP_NOTARIZE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --setup-credentials) SETUP_ONLY=1 ;;
    --skip-notarize) SKIP_NOTARIZE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
  shift
done

if ! security find-identity -v -p codesigning | grep -F -q "$IDENTITY_FULL"; then
  echo "错误: 未找到证书「$IDENTITY_FULL」"
  echo "请在 Xcode → Settings → Accounts 下载 Developer ID Application 证书后再试。"
  exit 1
fi

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

setup_credentials() {
  load_env
  local key="${APPLE_API_KEY:-$DEFAULT_API_KEY}"
  local key_id="${APPLE_API_KEY_ID:-$DEFAULT_API_KEY_ID}"
  local issuer="${APPLE_API_ISSUER:-}"

  if [[ -f "$key" ]]; then
    echo "==> 使用 App Store Connect API Key 写入钥匙串 profile: $PROFILE_NAME"
    echo "    Key:    $key"
    echo "    Key ID: $key_id"
    if [[ -z "$issuer" ]]; then
      echo
      echo "缺少 APPLE_API_ISSUER（Team Key 必填，UUID 格式）。"
      echo "打开 https://appstoreconnect.apple.com/access/integrations/api"
      echo "在页面顶部复制 Issuer ID，写入 .env.signing 后重试："
      echo
      echo "  APPLE_API_KEY=$key"
      echo "  APPLE_API_KEY_ID=$key_id"
      echo "  APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      echo
      if [[ -t 0 ]]; then
        read -r -p "或在此粘贴 Issuer ID: " issuer
      fi
    fi
    if [[ -z "$issuer" ]]; then
      echo "错误: 未提供 Issuer ID"
      exit 1
    fi
    if [[ ! "$issuer" =~ ^[0-9a-fA-F-]{36}$ ]]; then
      echo "错误: Issuer ID 应为 UUID，当前: $issuer"
      exit 1
    fi
    xcrun notarytool store-credentials "$PROFILE_NAME" \
      --key "$key" \
      --key-id "$key_id" \
      --issuer "$issuer"
    echo
    echo "✓ 凭据已保存。之后运行: npm run dist:mac"
    return
  fi

  local apple_id="${APPLE_ID:-$APPLE_ID_DEFAULT}"
  echo "==> 未找到 API Key 文件，改用 App 专用密码"
  echo "    Apple ID: $apple_id / Team: $TEAM_ID"
  if [[ ! -t 0 ]]; then
    echo "请在交互式终端执行: npm run dist:mac:setup"
    exit 1
  fi
  xcrun notarytool store-credentials "$PROFILE_NAME" \
    --apple-id "$apple_id" \
    --team-id "$TEAM_ID"
  echo "✓ 凭据已保存。之后运行: npm run dist:mac"
}

if [[ "$SETUP_ONLY" -eq 1 ]]; then
  setup_credentials
  exit 0
fi

load_env

export CSC_NAME="${CSC_NAME:-$IDENTITY}"
export APPLE_TEAM_ID="${APPLE_TEAM_ID:-$TEAM_ID}"

# 默认挂上你提供的 .p8（可被 .env.signing 覆盖）
if [[ -z "${APPLE_API_KEY:-}" && -f "$DEFAULT_API_KEY" ]]; then
  export APPLE_API_KEY="$DEFAULT_API_KEY"
  export APPLE_API_KEY_ID="${APPLE_API_KEY_ID:-$DEFAULT_API_KEY_ID}"
fi

if [[ "$SKIP_NOTARIZE" -eq 1 ]]; then
  export SKIP_NOTARIZE=1
  echo "==> 仅签名，跳过公证"
else
  # 优先 API Key / 钥匙串，避免导出 APPLE_ID 触发 electron-builder 内置公证
  if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
    echo "==> 公证方式: App Store Connect API Key ($APPLE_API_KEY_ID)"
  elif xcrun notarytool history --keychain-profile "$PROFILE_NAME" >/dev/null 2>&1; then
    export NOTARIZE_KEYCHAIN_PROFILE="$PROFILE_NAME"
    # 有钥匙串时不再依赖环境变量里的 API Key 字段
    unset APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER || true
    echo "==> 公证方式: 钥匙串 profile ($PROFILE_NAME)"
  elif [[ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    export APPLE_ID="${APPLE_ID:-$APPLE_ID_DEFAULT}"
    echo "==> 公证方式: App 专用密码"
  else
    echo "错误: 未配置公证凭据（API Key Issuer / 钥匙串 / App 专用密码）"
    echo "Team API Key 需要在 .env.signing 填写 APPLE_API_ISSUER"
    exit 1
  fi
fi

echo "==> 证书: $CSC_NAME"
echo "==> Team: $APPLE_TEAM_ID"
echo "==> 开始打包…"

npm run build
npx electron-builder --mac dmg --publish never

APP="$(find "$ROOT/release" -maxdepth 3 -type d -name 'Lumen.app' | head -n 1 || true)"
DMG="$(ls -t "$ROOT/release"/Lumen-*.dmg 2>/dev/null | head -n 1 || true)"

echo
if [[ -n "$APP" ]]; then
  echo "==> 验签:"
  codesign -dv --verbose=2 "$APP" 2>&1 | egrep 'Authority|TeamIdentifier|Signature|Identifier' || true
  codesign --verify --deep --strict --verbose=2 "$APP"
  echo
  echo "==> Gatekeeper:"
  spctl --assess --type execute --verbose=2 "$APP" 2>&1 || true
fi

if [[ -n "$DMG" ]]; then
  echo
  echo "✓ DMG: $DMG"
  ls -lah "$DMG"
fi
