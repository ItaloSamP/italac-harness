<#
.SYNOPSIS
  Installs (or updates) the agent harness into a project.

.EXAMPLE
  ./install.ps1 -Target C:\dev\my-app
  ./install.ps1 -Target C:\dev\my-app -Force     # also overwrite CLAUDE.md / AGENTS.md / settings.json
#>
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
if (-not (Test-Path $Target)) { New-Item -ItemType Directory -Force $Target | Out-Null }
$dst = (Resolve-Path $Target).Path
if ($dst -eq $src) { throw 'Target is the harness itself.' }

# Fixes made inside the project copy and not yet ported to the harness repository would be overwritten.
if (-not $Force -and (Test-Path (Join-Path $dst '.specs\harness\incidents.jsonl')) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  & node (Join-Path $src 'scripts\incident.mjs') pending-upstream --root $dst
  if ($LASTEXITCODE -eq 3) {
    Write-Host 'Aborted: the fixes above were made in this project and not ported upstream. Port them, mark each with "node scripts/incident.mjs upstreamed --key <key>", or re-run with -Force.'
    exit 3
  }
}

# Harness-owned folders: always refreshed. Project-local agents/skills with other names are kept.
foreach ($dir in 'rules', 'agents', 'skills', 'templates', 'hooks') {
  $to = Join-Path $dst ".claude\$dir"
  New-Item -ItemType Directory -Force $to | Out-Null
  Copy-Item -Path (Join-Path $src ".claude\$dir\*") -Destination $to -Recurse -Force
}

New-Item -ItemType Directory -Force (Join-Path $dst 'scripts') | Out-Null
foreach ($s in 'validate-harness.mjs', 'validate-task.mjs', 'incident.mjs', 'task-diff.mjs', 'gate.mjs') { Copy-Item (Join-Path $src "scripts\$s") (Join-Path $dst "scripts\$s") -Force }

# Project-owned files: never overwritten unless -Force.
$owned = @(
  @{ From = '.claude\templates\settings.harness.json'; To = '.claude\settings.json' },
  @{ From = 'AGENTS.md'; To = 'AGENTS.md' }
)
foreach ($f in $owned) {
  $to = Join-Path $dst $f.To
  if ($Force -or -not (Test-Path $to)) { Copy-Item (Join-Path $src $f.From) $to -Force }
  else { Write-Host "kept     $($f.To) (exists; use -Force to overwrite)" }
}

# CLAUDE.md: constitution part only; the project section starts empty.
$claudeTo = Join-Path $dst 'CLAUDE.md'
if ($Force -or -not (Test-Path $claudeTo)) {
  $text = Get-Content (Join-Path $src 'CLAUDE.md') -Raw -Encoding utf8
  $head = ($text -split "(?m)^# Project\s*$")[0]
  $project = @'
# Project

<!-- Project-specific. Filled in on the first task; correct what is wrong. -->

## What this is

## Commands
| Purpose | Command |
|---------|---------|
| Dev | |
| Test (scoped) | |
| Build | |

## Verification
Kind: <web | mobile | dashboard | pipeline | analysis | cli-lib | infra>

| Gate | Command | Baseline |
|------|---------|----------|

| Surface | Proves it | Command or step |
|---------|-----------|-----------------|

Delivered means:

## Conventions

## Standing instructions
<!-- Empty = solo default: gated work lands on the local main line, one commit per task; push asks once. Write "always push when green" to push without asking, or "collaboration mode" for branch + PR with layered commits. -->

## Context index

## Lessons learned
'@
  # UTF-8 without BOM on every PowerShell version (Windows PowerShell's -Encoding utf8 writes a BOM).
  [System.IO.File]::WriteAllText($claudeTo, $head + $project + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding $false))
}
else { Write-Host 'kept     CLAUDE.md (exists; rules still load from .claude/rules/)' }

foreach ($dir in '.specs\tasks', '.specs\docs', '.specs\logs') {
  New-Item -ItemType Directory -Force (Join-Path $dst $dir) | Out-Null
}

$gi = Join-Path $dst '.gitignore'
$ignore = '.specs/logs/', 'prototypes/**/node_modules/', '.taste-skill/'
$current = if (Test-Path $gi) { Get-Content $gi } else { @() }
foreach ($line in $ignore) { if ($current -notcontains $line) { Add-Content -Path $gi -Value $line -Encoding utf8 } }

Write-Host "Harness installed in $dst"
Write-Host 'Next: open the project in Claude Code and write what you want. Existing code is mapped on the first task, without questions.'
