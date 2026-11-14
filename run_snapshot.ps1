$ErrorActionPreference = 'Stop'
$root = 'D:\WEB PR SHUTTLE\LOKAL\Putra-Remaja-Shuttle - FULL LOCAL'
$sql = Get-Content -Raw (Join-Path $root 'shuttle_snapshot.sql')
$sql | docker exec -i supabase_db_Putra-Remaja-Shuttle psql -U postgres -d postgres
