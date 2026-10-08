# Operator-run only. Do not change execution policy to run this file.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stageRoot = Join-Path $repoRoot '.local/migration-staging-app'
$publicFile = Join-Path $repoRoot '.local/staging-public.json'
$envFile = Join-Path $repoRoot '.env'
$nodePath = 'C:\Program Files\nodejs\node.exe'

if (-not (Test-Path -LiteralPath (Join-Path $stageRoot '.git'))) {
  throw 'The isolated migration worktree is missing. Follow the migration manual.'
}
$destinationLine = Get-Content -LiteralPath $envFile | Where-Object {
  $_ -match '^MIGRATION_DESTINATION_DATABASE_URL='
} | Select-Object -First 1
if (-not $destinationLine) { throw 'Destination connection is not configured.' }
$destinationUrl = ($destinationLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$destination = [Uri]$destinationUrl
if ($destination.Scheme -notin @('postgresql', 'postgres') -or
    $destination.Host -ne 'aws-0-ap-southeast-1.pooler.supabase.com' -or
    $destination.Port -ne 5432 -or
    $destination.UserInfo -notlike 'postgres.lxofcmzgzbgqvlmwizgm:*') {
  throw 'Destination guard failed. Only the approved Singapore session pooler is allowed.'
}
$publicConfig = Get-Content -LiteralPath $publicFile -Raw | ConvertFrom-Json
if ($publicConfig.url -ne 'https://lxofcmzgzbgqvlmwizgm.supabase.co' -or
    $publicConfig.key -notlike 'sb_publishable_*') {
  throw 'Public Auth configuration does not target the approved staging project.'
}
if (Test-Path -LiteralPath (Join-Path $stageRoot '.env')) {
  throw 'Remove the staging worktree .env after reviewing it; root production .env must not be copied.'
}
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js executable is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $stageRoot 'node_modules'))) {
  New-Item -ItemType Junction -Path (Join-Path $stageRoot 'node_modules') `
    -Target (Join-Path $repoRoot 'node_modules') | Out-Null
}
$overrides = @{
  DATABASE_URL = $destinationUrl
  DIRECT_URL = $destinationUrl
  NEXT_PUBLIC_SUPABASE_URL = $publicConfig.url
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $publicConfig.key
  SUPABASE_SERVICE_ROLE_KEY = ''
  APP_URL = 'http://localhost:3001'
  NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
  LOCAL_DEMO = 'false'
  RECOMMENDATION_WORKER_ENABLED = 'false'
  AI_PROVIDER = 'disabled'
  AI_API_KEY = ''
  BACKEND_URL = ''
  VERCEL_ENV = 'development'
  NODE_ENV = 'development'
}
$previous = @{}
try {
  foreach ($name in $overrides.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $overrides[$name], 'Process')
  }
  Push-Location -LiteralPath $stageRoot
  try {
    Write-Host 'Singapore staging only: http://localhost:3001/login — stop with Ctrl+C.'
    Write-Host 'Storage uploads are deliberately unavailable until a staging-only backend key is supplied.'
    & $nodePath 'node_modules/next/dist/bin/next' dev --webpack --hostname 127.0.0.1 --port 3001
  } finally { Pop-Location }
} finally {
  foreach ($name in $previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
}
