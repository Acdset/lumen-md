/**
 * electron-builder afterSign hook：提交 Apple 公证并装订票据。
 *
 * 支持（按优先级）：
 * 1) App Store Connect API Key：APPLE_API_KEY + APPLE_API_KEY_ID（+ APPLE_API_ISSUER，Team Key 必填）
 * 2) 钥匙串 profile：NOTARIZE_KEYCHAIN_PROFILE
 * 3) App 专用密码：APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID
 */
const path = require('node:path')
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  if (process.env.SKIP_NOTARIZE === '1' || process.env.SKIP_NOTARIZE === 'true') {
    console.log('  • skip notarize (SKIP_NOTARIZE=1)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  const apiKey = process.env.APPLE_API_KEY
  const apiKeyId = process.env.APPLE_API_KEY_ID
  const apiIssuer = process.env.APPLE_API_ISSUER
  const profile = process.env.NOTARIZE_KEYCHAIN_PROFILE
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID || '4M9R74FAPG'

  const useApiKey = !!(apiKey && apiKeyId)
  const useProfile = !!profile
  const usePassword = !!(appleId && appleIdPassword)

  if (!useApiKey && !useProfile && !usePassword) {
    console.warn(
      '  • skip notarize: 未配置 API Key / 钥匙串 profile / App 专用密码',
    )
    return
  }

  console.log(`  • notarizing ${appPath}`)

  if (useApiKey) {
    const opts = {
      tool: 'notarytool',
      appPath,
      appleApiKey: apiKey,
      appleApiKeyId: apiKeyId,
    }
    if (apiIssuer) opts.appleApiIssuer = apiIssuer
    await notarize(opts)
  } else if (useProfile) {
    await notarize({
      tool: 'notarytool',
      appPath,
      keychainProfile: profile,
    })
  } else {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    })
  }

  console.log('  • notarize done')
}
