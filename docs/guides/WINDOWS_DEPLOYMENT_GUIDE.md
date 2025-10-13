# 🪟 Relier Hub - Windows Server Deployment Guide

Complete guide to deploy the entire Relier Hub multi-provider payment system on Windows Server.

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Claude Code on Windows](#claude-code-on-windows)
3. [System Requirements](#system-requirements)
4. [Installation Steps](#installation-steps)
5. [Database Setup](#database-setup)
6. [Environment Configuration](#environment-configuration)
7. [Running as Windows Service](#running-as-windows-service)
8. [SSL/HTTPS Setup](#sslhttps-setup)
9. [Monitoring & Logs](#monitoring--logs)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### Required Software
1. **Windows Server 2016 or later** (or Windows 10/11 Pro)
2. **Node.js v18+** - https://nodejs.org/
3. **PostgreSQL 14+** - https://www.postgresql.org/download/windows/
4. **Git for Windows** - https://git-scm.com/download/win
5. **Visual Studio Code** (optional) - https://code.visualstudio.com/

---

## 🤖 Claude Code on Windows

### Installation

**Option 1: Using Windows Terminal (Recommended)**
```powershell
# Open PowerShell as Administrator
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Or download from:
# https://claude.com/claude-code
```

**Option 2: Using WSL2 (Windows Subsystem for Linux)**
```powershell
# Install WSL2
wsl --install

# Inside WSL2 terminal:
npm install -g @anthropic-ai/claude-code
```

### Launch Claude Code
```powershell
# From PowerShell or CMD
claude

# Or from any folder:
cd C:\path\to\project
claude
```

**Claude Code will help you:**
- Clone the repository
- Install dependencies
- Configure environment variables
- Set up database
- Deploy the application
- Troubleshoot issues

---

## 💻 System Requirements

### Minimum Specifications
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 20 GB SSD
- **Network:** 100 Mbps

### Recommended Specifications
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Storage:** 50+ GB SSD
- **Network:** 1 Gbps

---

## 📦 Installation Steps

### Step 1: Install Node.js

1. Download Node.js LTS from https://nodejs.org/
2. Run installer with default options
3. Verify installation:
```powershell
node --version
npm --version
```

### Step 2: Install PostgreSQL

1. Download PostgreSQL 14+ from https://www.postgresql.org/download/windows/
2. During installation:
   - Set password for `postgres` user (remember this!)
   - Port: `5432` (default)
   - Locale: Default
3. Verify installation:
```powershell
psql --version
```

### Step 3: Install Git

1. Download Git from https://git-scm.com/download/win
2. Install with default options
3. Verify:
```powershell
git --version
```

### Step 4: Clone Repository

**Option A: Using Claude Code (Easiest)**
```powershell
# Launch Claude Code
claude

# Tell Claude:
# "Clone the Relier Hub repository from GitHub to C:\relier-hub"
```

**Option B: Manual Clone**
```powershell
# Open PowerShell
cd C:\
git clone https://github.com/richardmas-cmyk/Latcom-fix.git relier-hub
cd relier-hub
```

### Step 5: Install Dependencies

```powershell
cd C:\relier-hub
npm install
```

---

## 🗄️ Database Setup

### Create Database

**Option A: Using Claude Code**
```powershell
claude

# Tell Claude:
# "Set up PostgreSQL database for Relier Hub"
```

**Option B: Manual Setup**

1. Open PowerShell as Administrator:
```powershell
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE relier_hub;

# Create user
CREATE USER relier_admin WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE relier_hub TO relier_admin;

# Exit
\q
```

2. Run database migrations:
```powershell
cd C:\relier-hub
node init-database.js
```

### Import Database Schema

The `init-database.js` script will automatically create:
- `customers` table
- `transactions` table
- `invoices` table
- All necessary indexes

---

## ⚙️ Environment Configuration

### Create Environment File

Create `C:\relier-hub\.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://relier_admin:your_password@localhost:5432/relier_hub

# Server Configuration
PORT=8080
NODE_ENV=production

# Admin Credentials
ADMIN_KEY=your_admin_key_here

# Latcom Provider
LATCOM_BASE_URL=https://api.latcom.mx
LATCOM_USERNAME=your_latcom_username
LATCOM_PASSWORD=your_latcom_password

# PPN Provider (Valuetop)
PPN_BASE_URL=https://www.valuetopup.com/api/v2
PPN_USERNAME=your_ppn_username
PPN_PASSWORD=your_ppn_password
PPN_ENVIRONMENT=production

# CSQ Provider
CSQ_BASE_URL=https://api.csq.com
CSQ_USERNAME=your_csq_username
CSQ_PASSWORD=your_csq_password
CSQ_TERMINAL_ID=your_terminal_id

# MUWE Provider
MUWE_BASE_URL=https://pay.sipelatam.mx
MUWE_MER_CODE=your_merchant_code
MUWE_APP_ID=your_app_id
MUWE_MCH_ID=your_merchant_id
MUWE_SECRET_KEY=your_secret_key
MUWE_ENVIRONMENT=production

# Email Alerts (SendGrid)
SENDGRID_API_KEY=your_sendgrid_key
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com

# Exchange Rate (Optional)
EXCHANGE_RATE_USD_TO_MXN=18.50
```

**Security Note:** Never commit `.env` file to Git!

---

## 🔧 Running as Windows Service

### Install PM2 (Process Manager)

```powershell
npm install -g pm2
npm install -g pm2-windows-service
```

### Configure PM2

Create `C:\relier-hub\ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'relier-hub',
    script: 'server.js',
    cwd: 'C:\\relier-hub',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: 'C:\\relier-hub\\logs\\error.log',
    out_file: 'C:\\relier-hub\\logs\\out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

### Install as Windows Service

```powershell
# Run as Administrator
pm2-service-install

# Answer prompts:
# - PM2_HOME: C:\ProgramData\pm2
# - PM2_SERVICE_SCRIPTS: C:\relier-hub

# Start the service
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Service Management

```powershell
# Start service
pm2 start relier-hub

# Stop service
pm2 stop relier-hub

# Restart service
pm2 restart relier-hub

# View status
pm2 status

# View logs
pm2 logs relier-hub

# Monitor
pm2 monit
```

---

## 🔒 SSL/HTTPS Setup

### Option 1: Using IIS as Reverse Proxy

1. Install IIS on Windows Server
2. Install URL Rewrite module
3. Install ARR (Application Request Routing)
4. Configure reverse proxy to Node.js app on port 8080

### Option 2: Using Nginx on Windows

Download Nginx for Windows: http://nginx.org/en/download.html

Create `C:\nginx\conf\nginx.conf`:

```nginx
http {
    upstream relier_hub {
        server 127.0.0.1:8080;
    }

    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://relier_hub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }

    # HTTPS (after getting SSL certificate)
    server {
        listen 443 ssl;
        server_name your-domain.com;

        ssl_certificate C:/nginx/ssl/certificate.crt;
        ssl_certificate_key C:/nginx/ssl/private.key;

        location / {
            proxy_pass http://relier_hub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

Start Nginx:
```powershell
cd C:\nginx
start nginx
```

### Option 3: Direct SSL in Node.js

Modify `server.js` to include HTTPS:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('C:/relier-hub/ssl/private.key'),
  cert: fs.readFileSync('C:/relier-hub/ssl/certificate.crt')
};

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS Server running on port 443');
});
```

---

## 📊 Monitoring & Logs

### Log Locations

```
C:\relier-hub\logs\
├── error.log      # Application errors
├── out.log        # Application output
└── access.log     # Request logs
```

### View Logs

```powershell
# Real-time logs
pm2 logs relier-hub

# View last 100 lines
pm2 logs relier-hub --lines 100

# Error logs only
pm2 logs relier-hub --err

# Output logs only
pm2 logs relier-hub --out
```

### Windows Event Viewer

PM2 also logs to Windows Event Viewer:
1. Open Event Viewer
2. Navigate to: Windows Logs → Application
3. Look for events from "PM2"

### Health Monitoring

Create `C:\relier-hub\health-check.ps1`:

```powershell
# Health check script
$response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
if ($response.StatusCode -eq 200) {
    Write-Host "✅ Relier Hub is healthy"
} else {
    Write-Host "❌ Relier Hub is down!"
    # Send alert or restart service
    pm2 restart relier-hub
}
```

Schedule this script in Windows Task Scheduler to run every 5 minutes.

---

## 🔥 Firewall Configuration

### Allow Port 8080 (or your chosen port)

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Relier Hub API" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Allow HTTPS (443)

```powershell
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

---

## 🚀 Quick Start Script

Create `C:\relier-hub\start.ps1`:

```powershell
# Relier Hub Quick Start Script
Write-Host "🚀 Starting Relier Hub..." -ForegroundColor Green

# Check if Node.js is installed
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is running
$pgService = Get-Service -Name postgresql* -ErrorAction SilentlyContinue
if ($pgService.Status -ne "Running") {
    Write-Host "⚠️  PostgreSQL is not running. Starting..." -ForegroundColor Yellow
    Start-Service $pgService.Name
}

# Navigate to project directory
Set-Location "C:\relier-hub"

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
}

# Start application with PM2
Write-Host "🎯 Starting Relier Hub with PM2..." -ForegroundColor Cyan
pm2 start ecosystem.config.js

# Show status
pm2 status

Write-Host "`n✅ Relier Hub is running!" -ForegroundColor Green
Write-Host "📊 Dashboard: http://localhost:8080" -ForegroundColor Cyan
Write-Host "📝 Logs: pm2 logs relier-hub" -ForegroundColor Cyan
```

Run it:
```powershell
.\start.ps1
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Port Already in Use
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process
taskkill /PID <process_id> /F
```

#### 2. PostgreSQL Connection Failed
```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# Start PostgreSQL
Start-Service postgresql-x64-14

# Test connection
psql -U postgres -h localhost -p 5432
```

#### 3. Permission Errors
```powershell
# Run PowerShell as Administrator
# Or adjust folder permissions:
icacls "C:\relier-hub" /grant Users:F /T
```

#### 4. Environment Variables Not Loading
```powershell
# Verify .env file exists
Test-Path "C:\relier-hub\.env"

# Check file encoding (should be UTF-8)
# Use Notepad++ or VS Code to save as UTF-8
```

---

## 📞 Using Claude Code for Deployment

**Best Practice:** Use Claude Code to help with each step!

```powershell
# Launch Claude Code in your project folder
cd C:\relier-hub
claude
```

**Example commands to Claude:**

1. **"Set up the database for Relier Hub"**
2. **"Configure the environment variables"**
3. **"Install Relier Hub as a Windows service"**
4. **"Set up SSL with Nginx"**
5. **"Create a backup script for the database"**
6. **"Help me troubleshoot why the server won't start"**

Claude Code will:
- Write configuration files
- Run necessary commands
- Fix errors
- Explain each step
- Create scripts for you

---

## 📁 Project Structure

```
C:\relier-hub\
├── server.js              # Main application
├── init-database.js       # Database setup
├── package.json           # Dependencies
├── .env                   # Environment variables (create this)
├── ecosystem.config.js    # PM2 configuration (create this)
├── providers/             # Payment providers
│   ├── latcom-provider.js
│   ├── ppn-provider.js
│   ├── csq-provider.js
│   ├── muwe-provider.js
│   └── provider-router.js
├── lib/                   # Utilities
│   ├── alert-system.js
│   └── forex.js
├── logs/                  # Application logs (auto-created)
└── ssl/                   # SSL certificates (if using HTTPS)
```

---

## ✅ Final Checklist

Before going live:

- [ ] Node.js installed (v18+)
- [ ] PostgreSQL installed and running
- [ ] Database created and migrated
- [ ] `.env` file configured with all credentials
- [ ] PM2 installed and service configured
- [ ] Application starts successfully
- [ ] Health endpoint returns 200 OK
- [ ] Firewall rules configured
- [ ] SSL/HTTPS configured (production)
- [ ] Logs rotating properly
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Provider credentials tested

---

## 🎯 Next Steps After Deployment

1. **Test all endpoints**
2. **Configure monitoring** (Uptime Robot, Datadog, etc.)
3. **Set up automated backups**
4. **Configure email alerts**
5. **Load test the system**
6. **Document your specific configuration**

---

## 📧 Support

For issues during deployment, use Claude Code:
```powershell
claude

# Describe your issue in natural language
# Claude will help troubleshoot and fix it
```

---

**You now have everything needed to deploy Relier Hub on Windows Server!** 🚀

Use Claude Code as your deployment assistant - it will guide you through every step.
