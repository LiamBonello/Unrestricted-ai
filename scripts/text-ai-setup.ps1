param(
  [string]$Model = 'unsloth/Qwen3.5-9B-GGUF:Q4_K_M',
  [string]$CacheDir = '.\models\llama-cache',
  [int]$Port = 8091,
  [int]$ContextSize = 8192
)

$ErrorActionPreference = 'Stop'

function Resolve-LlamaServer {
  $configured = $env:UNRESTRICTED_AI_LLAMA_SERVER_PATH
  if (-not [string]::IsNullOrWhiteSpace($configured)) {
    if (Test-Path -LiteralPath $configured -PathType Leaf) {
      return (Resolve-Path -LiteralPath $configured).Path
    }

    $configuredCommand = Get-Command $configured -ErrorAction SilentlyContinue
    if ($null -ne $configuredCommand) {
      return $configuredCommand.Source
    }
  }

  $command = Get-Command 'llama-server' -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  return $null
}

$isWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $isWindows) {
  Write-Host '[FAIL] This setup workflow targets Windows.' -ForegroundColor Red
  exit 1
}

$llamaServer = Resolve-LlamaServer
if ($null -eq $llamaServer) {
  Write-Host '[FAIL] llama-server was not found.' -ForegroundColor Red
  Write-Host 'Install the official Windows package, then run setup again:' -ForegroundColor Yellow
  Write-Host 'winget install llama.cpp' -ForegroundColor Yellow
  exit 1
}

if ($Port -lt 1 -or $Port -gt 65535) {
  Write-Host '[FAIL] Port must be between 1 and 65535.' -ForegroundColor Red
  exit 1
}
if ($ContextSize -lt 1) {
  Write-Host '[FAIL] ContextSize must be greater than zero.' -ForegroundColor Red
  exit 1
}

$cacheFullPath = [System.IO.Path]::GetFullPath($CacheDir)
[System.IO.Directory]::CreateDirectory($cacheFullPath) | Out-Null

$arguments = @(
  '--hf-repo', $Model,
  '--no-mmproj',
  '--host', '127.0.0.1',
  '--port', [string]$Port,
  '--ctx-size', [string]$ContextSize,
  '--n-gpu-layers', 'auto',
  '--parallel', '1',
  '--flash-attn', 'auto'
)

$previousCache = $env:LLAMA_CACHE
$env:LLAMA_CACHE = $cacheFullPath
$process = $null
$failed = $false
$failureMessage = $null

try {
  Write-Host 'Starting llama-server to populate the local model cache...' -ForegroundColor Cyan
  Write-Host "Model: $Model"
  Write-Host "Cache: $cacheFullPath"

  $process = Start-Process `
    -FilePath $llamaServer `
    -ArgumentList $arguments `
    -PassThru `
    -NoNewWindow

  $healthUrl = "http://127.0.0.1:$Port/health"
  $deadline = [DateTime]::UtcNow.AddMinutes(30)
  $ready = $false

  while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) {
      throw "llama-server exited before becoming ready (exit code $($process.ExitCode))."
    }

    try {
      $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3
      if ($health.status -eq 'ok') {
        $ready = $true
        break
      }
    } catch {
      # The server may not bind its HTTP port until model download/loading has progressed.
    }

    Start-Sleep -Milliseconds 750
  }

  if (-not $ready) {
    throw 'llama-server did not become ready within 30 minutes.'
  }

  $serverPathForEnv = $llamaServer.Replace('"', '\"')
  $cachePathForEnv = if ([System.IO.Path]::IsPathRooted($CacheDir)) {
    $cacheFullPath.Replace('"', '\"')
  } else {
    $CacheDir.Replace('\\', '/').Replace('"', '\"')
  }
  $envContent = @"
UNRESTRICTED_AI_LLM_PROVIDER=llama-cpp
UNRESTRICTED_AI_LLAMA_SERVER_PATH="$serverPathForEnv"
UNRESTRICTED_AI_LLAMA_MODEL=$Model
UNRESTRICTED_AI_LLAMA_CACHE_DIR="$cachePathForEnv"
UNRESTRICTED_AI_LLAMA_PORT=$Port
UNRESTRICTED_AI_LLAMA_CONTEXT_SIZE=$ContextSize
UNRESTRICTED_AI_LLAMA_GPU_LAYERS=auto
UNRESTRICTED_AI_LLAMA_STARTUP_TIMEOUT_MS=120000
UNRESTRICTED_AI_SYSTEM_PROMPT=You are Unrestricted AI, a private local AI assistant.
"@

  $envFile = Join-Path (Get-Location).Path '.env.local'
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($envFile, $envContent.TrimStart(), $utf8WithoutBom)

  Write-Host '[PASS] Model is cached and .env.local is configured for llama-cpp.' -ForegroundColor Green
  Write-Host 'Normal application startup will use the cached model in offline mode.' -ForegroundColor Green
} catch {
  $failed = $true
  $failureMessage = $_.Exception.Message
} finally {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    try {
      $process.WaitForExit(5000)
    } catch {
      # Best-effort cleanup; setup is already ending.
    }
  }

  if ($null -eq $previousCache) {
    Remove-Item Env:LLAMA_CACHE -ErrorAction SilentlyContinue
  } else {
    $env:LLAMA_CACHE = $previousCache
  }
}

if ($failed) {
  Write-Host "[FAIL] $failureMessage" -ForegroundColor Red
  exit 1
}

exit 0
