# Windows Server Deployment Guide - Telefonica Integration

## Overview
This guide covers deploying the Telefonica Mexico integration to your Windows server with VPN access.

## Prerequisites

### Windows Server Requirements
- Windows Server 2016 or later
- Node.js 16+ installed
- VPN connection configured and active
- Network access to `srm.movistar.com.mx`

### Required Information
- [ ] VPN credentials
- [ ] Telefonica PASSWORD_IVR
- [ ] Telefonica PUNTO_VENTA (distributor ID)
- [ ] Database connection string
- [ ] Redis connection string (if using queue)

## Step 1: Transfer Files to Windows Server

### Option A: Git Clone (Recommended)
```powershell
# On Windows server
cd C:\Projects
git clone [your-repository-url] latcom-fix
cd latcom-fix
```

### Option B: Direct File Transfer
```bash
# From Mac, compress the project
cd /Users/richardmas
tar -czf latcom-fix.tar.gz latcom-fix/

# Transfer via SCP/SFTP to Windows server
scp latcom-fix.tar.gz user@windows-server:/path/to/destination/

# On Windows server, extract
tar -xzf latcom-fix.tar.gz
```

### Option C: ZIP and Manual Transfer
```bash
# On Mac
cd /Users/richardmas
zip -r latcom-fix.zip latcom-fix/ -x "*/node_modules/*" -x "*/.git/*"

# Transfer ZIP to Windows server
# Extract on Windows using File Explorer or PowerShell
```

## Step 2: Connect to VPN

```powershell
# Verify VPN connection
ping srm.movistar.com.mx

# Expected: Should receive responses if VPN is active
# If timeout: VPN is not connected or not configured correctly
```

## Step 3: Install Dependencies

```powershell
cd C:\Projects\latcom-fix

# Install Node.js dependencies
npm install

# Verify axios is installed
npm list axios
```

## Step 4: Configure Environment Variables

### Create Production .env file
```powershell
# Copy staging environment as template
copy .env.staging .env.production

# Edit .env.production with production values
notepad .env.production
```

### Required Environment Variables
```bash
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/latcom_production

# Telefonica Mexico (PRODUCTION CREDENTIALS)
TELEFONICA_WSDL_URL=http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
TELEFONICA_PASSWORD_IVR=[YOUR_PRODUCTION_PASSWORD_IVR]
TELEFONICA_PUNTO_VENTA=[YOUR_PRODUCTION_PUNTO_VENTA]
TELEFONICA_DEFAULT_TYPE=00

# Other providers (as needed)
LATCOM_API_KEY=[production_key]
PPN_API_KEY=[production_key]
CSQ_USERNAME=[production_username]
CSQ_PASSWORD=[production_password]
MUWE_API_KEY=[production_key]

# Admin keys
ADMIN_KEY=[production_admin_key]
RECONCILE_KEY=[production_reconcile_key]

# Redis (if using)
REDIS_URL=redis://localhost:6379

# Alerts
ALERT_WEBHOOK_URL=[your_webhook]
ENABLE_ALERTS=true
```

## Step 5: Test Telefonica Connection

```powershell
# Set environment variables for test
$env:NODE_ENV="production"
$env:TELEFONICA_PASSWORD_IVR="[your_password]"
$env:TELEFONICA_PUNTO_VENTA="[your_distributor_id]"

# Run test script
node test-telefonica.js
```

### Expected Test Results (With VPN)
```
✅ Provider configured: true
✅ WSDL endpoint accessible: true
✅ Ping successful
🔄 Test transaction: [result based on credentials]
```

### Troubleshooting Connection Issues

**Issue**: `ENOTFOUND srm.movistar.com.mx`
- **Solution**: VPN not connected or DNS not resolving
- **Check**: `nslookup srm.movistar.com.mx`

**Issue**: `ETIMEDOUT` or `ECONNREFUSED`
- **Solution**: Firewall blocking connection
- **Check**: Windows Firewall settings
- **Check**: Corporate firewall rules

**Issue**: `Authentication failed`
- **Solution**: Invalid PASSWORD_IVR or PUNTO_VENTA
- **Check**: Verify credentials with Telefonica

## Step 6: Run Application

### Development Mode
```powershell
# Load production environment
$env:NODE_ENV="production"

# Start server
node server.js
```

### Production Mode with PM2

```powershell
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name latcom-production

# View logs
pm2 logs latcom-production

# Monitor
pm2 monit

# Save process list (auto-restart on reboot)
pm2 save
pm2 startup
```

### As Windows Service

```powershell
# Install node-windows
npm install -g node-windows

# Create service installation script
```

Create `install-service.js`:
```javascript
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'Latcom Provider Service',
  description: 'Latcom multi-provider payment service',
  script: 'C:\\Projects\\latcom-fix\\server.js',
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', function(){
  svc.start();
});

svc.install();
```

```powershell
# Install as Windows service
node install-service.js
```

## Step 7: Test Production Endpoints

### Test Telefonica Topup
```powershell
# PowerShell
$body = @{
    phone = "5512345678"
    amount = 20
    country = "MEXICO"
    preferredProvider = "telefonica"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/enviadespensa/topup" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -Headers @{ "x-api-key" = "your_api_key" }
```

### Test Provider Status
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/providers" `
    -Method GET `
    -Headers @{ "x-admin-key" = "your_admin_key" }
```

## Step 8: Monitor and Validate

### Check Provider Status
```javascript
// In Node.js console or test script
const { router } = require('./providers');

// Check all configured providers
const providers = router.getConfiguredProviders();
console.log(providers);

// Check Telefonica specifically
const telefonica = router.getProvider('telefonica');
console.log('Telefonica ready:', telefonica.isReady());
```

### Monitor Logs
```powershell
# If using PM2
pm2 logs latcom-production --lines 100

# If running directly
# Logs will appear in console
```

### Test Transaction Flow
1. Submit test topup via API
2. Verify transaction in database
3. Check response from Telefonica
4. Verify transaction completed successfully

## Step 9: Database Setup

### Create Transaction Tables (if not exists)
```sql
-- Connect to PostgreSQL database
-- Run any pending migrations

-- Verify Telefonica transactions are logged
SELECT * FROM transactions
WHERE provider = 'Telefonica'
ORDER BY created_at DESC
LIMIT 10;
```

## Step 10: Production Validation

### Pre-Production Checklist
- [ ] VPN connection stable
- [ ] Can reach `srm.movistar.com.mx`
- [ ] Production credentials configured
- [ ] Test transaction successful
- [ ] Database connection working
- [ ] Redis connection working (if using)
- [ ] Logging working
- [ ] Alert system configured

### Go-Live Checklist
- [ ] All providers tested
- [ ] Failover tested (primary provider down)
- [ ] Transaction logging verified
- [ ] Balance checking working
- [ ] Monitoring dashboard set up
- [ ] Alert thresholds configured
- [ ] Backup/recovery plan in place

## Troubleshooting

### VPN Connection Issues
```powershell
# Test VPN connectivity
ping srm.movistar.com.mx
nslookup srm.movistar.com.mx
Test-NetConnection -ComputerName srm.movistar.com.mx -Port 80
```

### Node.js Issues
```powershell
# Check Node.js version
node --version  # Should be 16+

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
npm install
```

### Port Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID [process_id] /F
```

### Permission Issues
```powershell
# Run PowerShell as Administrator
# Set execution policy if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Security Considerations

### Firewall Configuration
- Allow inbound connections on application port (3000)
- Allow outbound to Telefonica API
- Restrict access to trusted IPs only

### Credential Management
- Store credentials in environment variables, not in code
- Use Windows Credential Manager for sensitive data
- Rotate credentials periodically
- Use different credentials for staging/production

### VPN Security
- Keep VPN client updated
- Use strong authentication
- Monitor VPN connection logs
- Alert on VPN disconnection

## Monitoring and Alerts

### Key Metrics to Monitor
- Transaction success rate
- Response times
- Provider availability
- Balance levels
- Error rates
- VPN connection status

### Recommended Alerts
- Transaction failure rate > 10%
- Response time > 5 seconds
- Provider unavailable
- VPN disconnected
- Low balance warning

## Backup and Recovery

### Database Backups
```powershell
# Automated PostgreSQL backup
pg_dump -h host -U user -d latcom_production > backup_$(Get-Date -Format "yyyyMMdd").sql
```

### Application Backups
```powershell
# Backup application files
xcopy C:\Projects\latcom-fix C:\Backups\latcom-fix_$(Get-Date -Format "yyyyMMdd") /E /I /H
```

### Recovery Procedure
1. Restore application files
2. Restore database
3. Verify environment variables
4. Test VPN connection
5. Start application
6. Verify all providers working

## Support Contacts

### Telefonica Support
- Contact: [Your Telefonica account manager]
- Support: [Telefonica support email/phone]
- Documentation: `/Users/richardmas/Downloads/API Payments Telefonica/`

### Internal Team
- Developer: [Your contact]
- DevOps: [DevOps contact]
- Database Admin: [DBA contact]

## Next Steps After Deployment

1. **Monitor First 24 Hours**
   - Watch transaction logs closely
   - Monitor success rates
   - Check for any errors

2. **Gradual Rollout**
   - Start with Telefonica as fallback only
   - Monitor performance for 1 week
   - Move to higher priority if stable

3. **Optimization**
   - Monitor response times
   - Implement caching if needed
   - Add retry logic for timeouts
   - Configure connection pooling

4. **Documentation**
   - Document any custom configurations
   - Record production credentials (securely)
   - Create runbook for common issues
   - Train support team

## Railway Deployment Alternative

If deploying to Railway instead of Windows server:

### Railway Configuration
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Set environment variables
railway variables set TELEFONICA_PASSWORD_IVR=[value]
railway variables set TELEFONICA_PUNTO_VENTA=[value]

# Deploy
railway up
```

**Note**: Railway deployment requires VPN access from Railway's infrastructure, which may not be possible. Windows server with VPN is recommended for Telefonica integration.
