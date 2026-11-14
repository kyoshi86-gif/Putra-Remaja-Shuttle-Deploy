$ErrorActionPreference = 'Stop'
$root = 'D:\WEB PR SHUTTLE\LOKAL\Putra-Remaja-Shuttle - FULL LOCAL'

# --- 1) config.toml : dari sementara 54341-54347 -> 59000 series (di luar semua excluded range) ---
$cfg = Join-Path $root 'supabase\config.toml'
$t = [System.IO.File]::ReadAllText($cfg, [Text.Encoding]::UTF8)
$map = @{
  'port = 54341' = 'port = 59000'   # api
  'port = 54342' = 'port = 59001'   # db
  'port = 54344' = 'port = 59002'   # pooler
  'port = 54345' = 'port = 59003'   # studio
  'port = 54346' = 'port = 59004'   # inbucket
  'port = 54347' = 'port = 59005'   # analytics
}
foreach ($k in $map.Keys) {
  if (-not $t.Contains($k)) { throw "Tidak ketemu di config.toml: $k" }
  $t = $t.Replace($k, $map[$k])
}
[System.IO.File]::WriteAllText($cfg, $t, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "OK config.toml: port -> 59000-59005"

# --- 2) .env.local : URL -> localhost:59000 ---
$envf = Join-Path $root '.env.local'
$e = [System.IO.File]::ReadAllText($envf, [Text.Encoding]::UTF8)
if (-not $e.Contains('localhost:54341')) { throw 'Tidak ketemu localhost:54341 di .env.local' }
$e = $e.Replace('localhost:54341', 'localhost:59000')
[System.IO.File]::WriteAllText($envf, $e, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "OK .env.local: URL -> localhost:59000"
