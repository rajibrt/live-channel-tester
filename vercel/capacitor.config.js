const appId = String(process.env.CAP_APP_ID || 'com.webtvbd.app').trim()
const appName = String(process.env.CAP_APP_NAME || 'WEBTVBD').trim()
const serverUrl = String(
  process.env.CAP_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://webtvbd.com',
).trim()
const launchUrl = serverUrl
  ? serverUrl.includes('?')
    ? `${serverUrl}&app=1`
    : `${serverUrl}?app=1`
  : 'https://webtvbd.com?app=1'

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: appId || 'com.webtvbd.app',
  appName: appName || 'WEBTVBD',
  webDir: 'www',
  android: {
    appendUserAgent: ' WEBTVBDApp',
  },
  server: {
    url: launchUrl,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['webtvbd.com', '*.webtvbd.com'],
  },
}

module.exports = config
