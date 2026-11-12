# Builds the web app, writes the production runtime configuration into the build output and deploys it to Firebase Hosting.
# The local public/config.json is never published: the build copy is replaced before deploying.
param(
  [string] $ApiBaseUrl = 'https://ichu-web-service.onrender.com/api/v1'
)
$ErrorActionPreference = 'Stop'

$projectId = [Environment]::GetEnvironmentVariable('Firebase__ProjectId', 'User')
$apiKey = [Environment]::GetEnvironmentVariable('Firebase__ApiKey', 'User')
if (-not $projectId -or -not $apiKey) {
  throw 'Set the user environment variables Firebase__ProjectId and Firebase__ApiKey first.'
}

$root = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
  npx ng build --configuration production
  if ($LASTEXITCODE -ne 0) { throw 'The build failed.' }

  $config = [ordered]@{
    apiBaseUrl = $ApiBaseUrl
    firebase   = [ordered]@{
      apiKey     = $apiKey
      authDomain = "$projectId.firebaseapp.com"
      projectId  = $projectId
      appId      = ''
    }
  }
  $config | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath 'dist/ichu-web-app/browser/config.json' -Encoding utf8

  npx -y firebase-tools@15.34.2 deploy --only hosting --project $projectId
  if ($LASTEXITCODE -ne 0) { throw 'The deployment failed.' }
} finally {
  Pop-Location
}
