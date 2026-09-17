$ErrorActionPreference = 'Stop'

$script:FailureCount = 0
$envFile = Join-Path (Get-Location).Path '.env.local'

function Write-Pass([string]$Message) {
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
  $script:FailureCount += 1
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Normalize-DotEnvValue([string]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $normalized = $Value.Trim()
  if ($normalized.Length -ge 2) {
    $isDoubleQuoted = $normalized.StartsWith('"') -and $normalized.EndsWith('"')
    $isSingleQuoted = $normalized.StartsWith("'") -and $normalized.EndsWith("'")
    if ($isDoubleQuoted -or $isSingleQuoted) {
      return $normalized.Substring(1, $normalized.Length - 2)
    }
  }

  return $normalized
}

function Get-DotEnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  $escapedName = [Regex]::Escape($Name)
  foreach ($line in Get-Content -LiteralPath $Path) {
    $match = [Regex]::Match($line, "^\s*$escapedName\s*=\s*(.*)\s*$")
    if ($match.Success) {
      return Normalize-DotEnvValue $match.Groups[1].Value
    }
  }

  return $null
}

function Resolve-LlamaServer([string]$EnvFile) {
  $configured = $env:UNRESTRICTED_AI_LLAMA_SERVER_PATH
  if ([string]::IsNullOrWhiteSpace($configured)) {
    $configured = Get-DotEnvValue $EnvFile 'UNRESTRICTED_AI_LLAMA_SERVER_PATH'
  }

  if (-not [string]::IsNullOrWhiteSpace($configured)) {
    if (Test-Path -LiteralPath $configured -PathType Leaf) {
      return (Resolve-Path -LiteralPath $configured).Path
    }

    $configuredCommand = Get-Command $configured -ErrorAction SilentlyContinue
    if ($null -ne $configuredCommand) {
      return $configuredCommand.Source
    }

    return $null
  }

  $command = Get-Command 'llama-server' -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  return $null
}

Write-Host 'Unrestricted AI - Local Text AI Doctor' -ForegroundColor Cyan
Write-Host ''

$isWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if ($isWindows) {
  Write-Pass 'Windows environment detected.'
} else {
  Write-Fail 'This local runtime profile requires Windows.'
}

$nvidiaSmi = Get-Command 'nvidia-smi' -ErrorAction SilentlyContinue
if ($null -eq $nvidiaSmi) {
  Write-Fail 'nvidia-smi was not found. Install or repair the NVIDIA Windows driver.'
} else {
  try {
    $gpuNames = @(& $nvidiaSmi.Source --query-gpu=name --format=csv,noheader 2>$null)
    if ($LASTEXITCODE -eq 0 -and $gpuNames.Count -gt 0) {
      Write-Pass ("NVIDIA GPU detected: " + ($gpuNames -join ', '))
    } else {
      Write-Fail 'nvidia-smi did not report an NVIDIA GPU.'
    }
  } catch {
    Write-Fail ("nvidia-smi failed: " + $_.Exception.Message)
  }
}

$llamaServer = Resolve-LlamaServer $envFile
if ($null -eq $llamaServer) {
  Write-Fail 'llama-server was not found on PATH or at UNRESTRICTED_AI_LLAMA_SERVER_PATH.'
} else {
  Write-Pass 'llama-server is available.'
}

$cacheValue = $env:UNRESTRICTED_AI_LLAMA_CACHE_DIR
if ([string]::IsNullOrWhiteSpace($cacheValue)) {
  $cacheValue = Get-DotEnvValue $envFile 'UNRESTRICTED_AI_LLAMA_CACHE_DIR'
}
if ([string]::IsNullOrWhiteSpace($cacheValue)) {
  $cacheValue = '.\models\llama-cache'
}

try {
  $cacheFullPath = [System.IO.Path]::GetFullPath($cacheValue)
  $probeDirectory = $cacheFullPath
  while (-not [System.IO.Directory]::Exists($probeDirectory)) {
    $parent = [System.IO.Directory]::GetParent($probeDirectory)
    if ($null -eq $parent) {
      break
    }
    $probeDirectory = $parent.FullName
  }

  if (-not [System.IO.Directory]::Exists($probeDirectory)) {
    Write-Fail 'No writable parent directory was found for UNRESTRICTED_AI_LLAMA_CACHE_DIR.'
  } else {
    $probeFile = Join-Path $probeDirectory ".unrestricted-ai-write-test-$PID.tmp"
    try {
      [System.IO.File]::WriteAllText($probeFile, '')
      Write-Pass 'The configured model cache location is writable.'
    } finally {
      if (Test-Path -LiteralPath $probeFile) {
        Remove-Item -LiteralPath $probeFile -Force
      }
    }
  }
} catch {
  Write-Fail ("The configured model cache location is not writable: " + $_.Exception.Message)
}

$nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
  Write-Fail 'Node.js was not found.'
} else {
  try {
    $nodeVersion = (& node --version).Trim()
    if ($nodeVersion -match '^v24\.') {
      Write-Pass "Node.js $nodeVersion detected."
    } else {
      Write-Fail "Node.js 24 is required; detected $nodeVersion."
    }
  } catch {
    Write-Fail ("node --version failed: " + $_.Exception.Message)
  }
}

$providerMode = $env:UNRESTRICTED_AI_LLM_PROVIDER
if ([string]::IsNullOrWhiteSpace($providerMode)) {
  $providerMode = Get-DotEnvValue $envFile 'UNRESTRICTED_AI_LLM_PROVIDER'
}
if ([string]::IsNullOrWhiteSpace($providerMode)) {
  $providerMode = 'mock'
}

if ($providerMode -eq 'llama-cpp') {
  if (Test-Path -LiteralPath $envFile -PathType Leaf) {
    Write-Pass '.env.local exists for llama-cpp mode.'
  } else {
    Write-Fail '.env.local is required when UNRESTRICTED_AI_LLM_PROVIDER=llama-cpp.'
  }
} else {
  Write-Pass '.env.local is not required while the provider mode is mock.'
}

Write-Host ''
if ($script:FailureCount -gt 0) {
  Write-Host "$script:FailureCount required check(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host 'All required local text AI checks passed.' -ForegroundColor Green
exit 0
