# PowerShell script to kill process using port 4001
# Run this if you get "EADDRINUSE" error

Write-Host "🔍 Checking for processes using port 4001..." -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort 4001 -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections.OwningProcess | Select-Object -Unique
    
    foreach ($pid in $pids) {
        if ($pid -ne 0) {
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "❌ Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                Write-Host "🔫 Killing process $pid..." -ForegroundColor Red
                Stop-Process -Id $pid -Force
                Write-Host "✅ Process $pid killed successfully" -ForegroundColor Green
            }
        }
    }
    
    Write-Host ""
    Write-Host "✅ Port 4001 is now free! You can start your server." -ForegroundColor Green
} else {
    Write-Host "✅ Port 4001 is already free!" -ForegroundColor Green
}

