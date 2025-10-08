# Relier Hub - Windows Automated Setup Script
# Run as Administrator

Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🪟 Relier Hub - Windows Server Setup               ║" -ForegroundColor Cyan
Write-Host "║  Automated Installation Script                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Function to check if command exists
function Test-Command($command) {
    try {
        if (Get-Command $command -ErrorAction SilentlyContinue) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Step 1: Check Node.js
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📦 Step 1: Checking Node.js..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found!" -ForegroundColor Red
    Write-Host "   Please download and install from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "   Then re-run this script" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check PostgreSQL
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🗄️  Step 2: Checking PostgreSQL..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Command "psql") {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL installed: $pgVersion" -ForegroundColor Green

    # Check if service is running
    $pgService = Get-Service -Name postgresql* -ErrorAction SilentlyContinue
    if ($pgService) {
        if ($pgService.Status -eq "Running") {
            Write-Host "✅ PostgreSQL service is running" -ForegroundColor Green
        } else {
            Write-Host "⚠️  PostgreSQL service not running. Starting..." -ForegroundColor Yellow
            Start-Service $pgService.Name
            Write-Host "✅ PostgreSQL service started" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ PostgreSQL not found!" -ForegroundColor Red
    Write-Host "   Please download and install from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "   Then re-run this script" -ForegroundColor Yellow
    exit 1
}

# Step 3: Set up project directory
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📁 Step 3: Setting up project directory..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$projectPath = "C:\relier-hub"

if (Test-Path $projectPath) {
    Write-Host "⚠️  Directory already exists: $projectPath" -ForegroundColor Yellow
    $response = Read-Host "Do you want to use this directory? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "❌ Setup cancelled" -ForegroundColor Red
        exit 1
    }
} else {
    New-Item -ItemType Directory -Path $projectPath -Force | Out-Null
    Write-Host "✅ Created directory: $projectPath" -ForegroundColor Green
}

Set-Location $projectPath

# Step 4: Clone or verify repository
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📥 Step 4: Setting up source code..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Path "package.json") {
    Write-Host "✅ Source code already present" -ForegroundColor Green
} else {
    if (Test-Command "git") {
        Write-Host "📦 Cloning repository from GitHub..." -ForegroundColor Cyan
        git clone https://github.com/richardmas-cmyk/Latcom-fix.git .
        Write-Host "✅ Repository cloned successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Git not found and no source code present!" -ForegroundColor Red
        Write-Host "   Please install Git or manually copy the source code" -ForegroundColor Yellow
        exit 1
    }
}

# Step 5: Install dependencies
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📦 Step 5: Installing Node.js dependencies..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Step 6: Create logs directory
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📝 Step 6: Creating logs directory..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$logsPath = "$projectPath\logs"
if (!(Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "✅ Logs directory created" -ForegroundColor Green
} else {
    Write-Host "✅ Logs directory already exists" -ForegroundColor Green
}

# Step 7: Create .env file template
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "⚙️  Step 7: Creating environment configuration..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$envPath = "$projectPath\.env"
if (!(Test-Path $envPath)) {
    $envTemplate = @"
# Relier Hub - Environment Configuration
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Database Configuration
DATABASE_URL=postgresql://relier_admin:CHANGE_ME@localhost:5432/relier_hub

# Server Configuration
PORT=8080
NODE_ENV=production

# Admin Credentials
ADMIN_KEY=CHANGE_ME_ADMIN_KEY

# Latcom Provider
LATCOM_BASE_URL=https://api.latcom.mx
LATCOM_USERNAME=CHANGE_ME
LATCOM_PASSWORD=CHANGE_ME

# PPN Provider (Valuetop)
PPN_BASE_URL=https://www.valuetopup.com/api/v2
PPN_USERNAME=CHANGE_ME
PPN_PASSWORD=CHANGE_ME
PPN_ENVIRONMENT=production

# CSQ Provider
CSQ_BASE_URL=https://api.csq.com
CSQ_USERNAME=CHANGE_ME
CSQ_PASSWORD=CHANGE_ME
CSQ_TERMINAL_ID=CHANGE_ME

# MUWE Provider
MUWE_BASE_URL=https://pay.sipelatam.mx
MUWE_MER_CODE=CHANGE_ME
MUWE_APP_ID=CHANGE_ME
MUWE_MCH_ID=CHANGE_ME
MUWE_SECRET_KEY=CHANGE_ME
MUWE_ENVIRONMENT=production

# Email Alerts (SendGrid)
SENDGRID_API_KEY=CHANGE_ME
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com

# Exchange Rate
EXCHANGE_RATE_USD_TO_MXN=18.50
"@

    Set-Content -Path $envPath -Value $envTemplate
    Write-Host "✅ Created .env template file" -ForegroundColor Green
    Write-Host "⚠️  IMPORTANT: Edit .env file and replace all CHANGE_ME values!" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  .env file already exists (not overwriting)" -ForegroundColor Yellow
}

# Step 8: Install PM2
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🔧 Step 8: Installing PM2 process manager..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Command "pm2") {
    Write-Host "✅ PM2 already installed" -ForegroundColor Green
} else {
    npm install -g pm2
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PM2 installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install PM2" -ForegroundColor Red
    }
}

# Create PM2 ecosystem file
$ecosystemPath = "$projectPath\ecosystem.config.js"
if (!(Test-Path $ecosystemPath)) {
    $ecosystemContent = @"
module.exports = {
  apps: [{
    name: 'relier-hub',
    script: 'server.js',
    cwd: '$($projectPath -replace '\\','\\')',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: '$($projectPath -replace '\\','\\')\\logs\\error.log',
    out_file: '$($projectPath -replace '\\','\\')\\logs\\out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
"@

    Set-Content -Path $ecosystemPath -Value $ecosystemContent
    Write-Host "✅ Created PM2 ecosystem configuration" -ForegroundColor Green
}

# Final summary
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Setup Complete!                                  ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Project location: $projectPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Edit .env file and configure all credentials" -ForegroundColor White
Write-Host "      → notepad $projectPath\.env" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Create PostgreSQL database:" -ForegroundColor White
Write-Host "      → psql -U postgres" -ForegroundColor Gray
Write-Host "      → CREATE DATABASE relier_hub;" -ForegroundColor Gray
Write-Host "      → \q" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Initialize database:" -ForegroundColor White
Write-Host "      → cd $projectPath" -ForegroundColor Gray
Write-Host "      → node init-database.js" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Start the application:" -ForegroundColor White
Write-Host "      → pm2 start ecosystem.config.js" -ForegroundColor Gray
Write-Host "      → pm2 save" -ForegroundColor Gray
Write-Host ""
Write-Host "   5. Check status:" -ForegroundColor White
Write-Host "      → pm2 status" -ForegroundColor Gray
Write-Host "      → pm2 logs" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tip: Use Claude Code for help!" -ForegroundColor Cyan
Write-Host "   → cd $projectPath" -ForegroundColor Gray
Write-Host "   → claude" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Full documentation: $projectPath\WINDOWS_DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
