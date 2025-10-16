# Latcom/Relier Payment System - Windows Server Deployment Guide

## 📋 Overview

This guide covers deploying the Latcom/Relier payment API on a Windows Server with Fortinet VPN access for Telefonica integration.

---

## 🖥️ Windows Server Requirements

### Prerequisites:
- Windows Server 2016 or newer
- Administrator access
- Internet connection
- Fortinet FortiGate/FortiClient VPN configured
- Minimum: 4GB RAM, 2 CPU cores, 50GB disk

---

## 📦 Step 1: Install Node.js on Windows

1. **Download Node.js LTS**:
   - Visit: https://nodejs.org/
   - Download: Windows Installer (.msi) - 64-bit
   - Recommended version: 20.x LTS

2. **Install Node.js**:
   ```cmd
   # Run the installer
   # Check "Automatically install necessary tools" box
   # Accept all defaults
   ```

3. **Verify Installation**:
   ```cmd
   node --version
   npm --version
   ```

---

## 📦 Step 2: Install PostgreSQL Database

1. **Download PostgreSQL**:
   - Visit: https://www.postgresql.org/download/windows/
   - Download: PostgreSQL 15.x or 16.x installer

2. **Install PostgreSQL**:
   ```cmd
   # Run installer
   # Set password for postgres user (SAVE THIS!)
   # Port: 5432 (default)
   # Locale: Default
   ```

3. **Create Database**:
   ```sql
   -- Open pgAdmin or psql
   CREATE DATABASE latcom_production;
   CREATE USER latcom_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE latcom_production TO latcom_user;
   ```

---

## 📦 Step 3: Deploy Application Files

1. **Create Application Directory**:
   ```cmd
   mkdir C:\Latcom
   cd C:\Latcom
   ```

2. **Copy Application Files**:
   - Transfer `LATCOM_WINDOWS_DEPLOYMENT.zip` to the server
   - Extract to `C:\Latcom\`

3. **Install Dependencies**:
   ```cmd
   cd C:\Latcom
   npm install --production
   ```

---

## 🔧 Step 4: Configure Environment

1. **Create Production Environment File**:
   ```cmd
   copy .env.example .env.production
   notepad .env.production
   ```

2. **Edit `.env.production`**:
   ```ini
   # PRODUCTION ENVIRONMENT
   NODE_ENV=production
   PORT=3000

   # Database
   DATABASE_URL=postgresql://latcom_user:your_secure_password@localhost:5432/latcom_production

   # CSQ Production Credentials
   CSQ_BASE_URL=https://evsbus.csqworld.com
   CSQ_USERNAME=host.180167
   CSQ_PASSWORD=z5r3rr3s96
   CSQ_TERMINAL_ID=180167
   CSQ_DEFAULT_OPERATOR_ID=1
   CSQ_TOKEN=4cdba8f37ecc5ba8994c6a23030c9d4b

   # Telefonica Mexico (Movistar)
   TELEFONICA_WSDL_URL=http://srm.movistar.com.mx/services/RecargaServicioPort?wsdl
   TELEFONICA_PASSWORD_IVR=your_telefonica_password
   TELEFONICA_PUNTO_VENTA=your_distributor_id
   TELEFONICA_DEFAULT_TYPE=00

   # Admin Keys
   ADMIN_KEY=relier_admin_prod_2025_CHANGE_THIS
   RECONCILE_KEY=relier_reconcile_prod_2025_CHANGE_THIS

   # Alerts (Optional)
   ALERT_WEBHOOK_URL=
   ENABLE_ALERTS=true

   # Mode
   LATCOM_MODE=XOOM_ONLY
   TEST_MODE=false
   MOCK_PROVIDERS=false
   ```

3. **IMPORTANT**: Change all default passwords and keys!

---

## 🗄️ Step 5: Initialize Database

1. **Run Database Migration**:
   ```cmd
   cd C:\Latcom
   node add-balance-audit-log.js
   ```

2. **Verify Tables Created**:
   ```sql
   -- In pgAdmin or psql
   \c latcom_production
   \dt
   -- Should see: customers, transactions, balance_adjustments
   ```

---

## 🔥 Step 6: Configure Windows Firewall

1. **Allow Node.js through Firewall**:
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -DisplayName "Latcom API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

2. **Or use GUI**:
   - Windows Defender Firewall → Advanced Settings
   - Inbound Rules → New Rule
   - Port → TCP → 3000
   - Allow the connection

---

## 🔐 Step 7: Configure Fortinet VPN for Telefonica

### A. Telefonica Needs VPN Access to Reach Your Server

1. **Create VPN User for Telefonica**:
   - Open FortiGate management console
   - Go to: User & Device → User → User Definition
   - Create new user: `telefonica_api`
   - Set strong password
   - Assign to group: `API_Access`

2. **Configure VPN Settings**:
   - Go to: VPN → SSL-VPN Settings
   - Enable SSL-VPN
   - Set portal: `tunnel-access`
   - Configure tunnel mode network: Your server's subnet

3. **Create Firewall Policy**:
   - Go to: Policy & Objects → Firewall Policy
   - Create policy:
     - Source: SSL-VPN tunnel interface
     - Destination: Your server's IP (e.g., 192.168.1.100)
     - Service: TCP/3000 (Latcom API)
     - Action: ACCEPT

4. **Provide to Telefonica**:
   ```
   VPN Server: your-fortinet-public-ip:10443
   Username: telefonica_api
   Password: [secure password]

   Once connected, access API at:
   http://192.168.1.100:3000/api/...
   ```

### B. Static IP Whitelist (Alternative)

If Telefonica has static IPs, you can whitelist them instead:

```powershell
# In FortiGate firewall rules
Source Address: [Telefonica IP ranges]
Destination: Your server IP
Service: TCP/3000
Action: ACCEPT
```

---

## 🚀 Step 8: Run Application as Windows Service

### Option 1: Using PM2 (Recommended)

1. **Install PM2**:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-startup
   ```

2. **Configure PM2 Startup**:
   ```cmd
   pm2-startup install
   ```

3. **Start Application**:
   ```cmd
   cd C:\Latcom
   pm2 start server.js --name latcom-api --env production
   pm2 save
   ```

4. **Verify**:
   ```cmd
   pm2 status
   pm2 logs latcom-api
   ```

### Option 2: Using node-windows

1. **Install node-windows**:
   ```cmd
   npm install -g node-windows
   ```

2. **Create Service Script** (`install-service.js`):
   ```javascript
   var Service = require('node-windows').Service;

   var svc = new Service({
     name: 'Latcom Payment API',
     description: 'Relier Payment System API',
     script: 'C:\\Latcom\\server.js',
     nodeOptions: [
       '--harmony',
       '--max_old_space_size=4096'
     ],
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

3. **Install Service**:
   ```cmd
   node install-service.js
   ```

---

## 🧪 Step 9: Test the Deployment

1. **Test Server is Running**:
   ```cmd
   curl http://localhost:3000/health
   ```

2. **Test from Another Machine (on VPN)**:
   ```cmd
   curl http://[server-ip]:3000/health
   ```

3. **Test CSQ Integration**:
   ```cmd
   cd C:\Latcom
   node list-csq-products-production.js
   ```

4. **Test Admin Portal**:
   - Open browser: `http://[server-ip]:3000/admin`
   - Login with admin key

---

## 📊 Step 10: Monitor and Maintain

### View Logs:
```cmd
# If using PM2
pm2 logs latcom-api

# If using Windows Service
# Check: Event Viewer → Windows Logs → Application
```

### Restart Service:
```cmd
# PM2
pm2 restart latcom-api

# Windows Service
net stop "Latcom Payment API"
net start "Latcom Payment API"
```

### Update Application:
```cmd
# Stop service
pm2 stop latcom-api

# Pull updates
cd C:\Latcom
# Copy new files

# Install new dependencies
npm install --production

# Restart
pm2 restart latcom-api
```

---

## 🔐 Security Checklist

- [ ] Changed all default passwords in `.env.production`
- [ ] PostgreSQL password is strong and unique
- [ ] Admin keys are unique and complex
- [ ] Windows Firewall configured (only port 3000)
- [ ] Fortinet VPN configured with strong passwords
- [ ] SSL certificate installed (optional but recommended)
- [ ] Database backups configured
- [ ] Log rotation configured
- [ ] Telefonica IPs whitelisted in Fortinet
- [ ] Test transactions working

---

## 📞 API Endpoints for Telefonica

Once Telefonica connects via VPN, they can access:

```
Base URL: http://[your-server-ip]:3000

# Health Check
GET /health

# Products (if needed)
GET /api/products?provider=csq

# Topup (Main endpoint)
POST /api/topup
Headers:
  x-api-key: [customer API key]
  Content-Type: application/json
Body:
{
  "phone": "5551234567",
  "amount": 50,
  "product": "TELCEL",
  "reference": "TEL-12345"
}

# Check Status
GET /api/status/:transactionId
Headers:
  x-api-key: [customer API key]
```

---

## 🆘 Troubleshooting

### Port Already in Use:
```cmd
netstat -ano | findstr :3000
taskkill /PID [process_id] /F
```

### Database Connection Issues:
```cmd
# Test PostgreSQL
psql -U latcom_user -d latcom_production -h localhost
```

### Node.js Not Found:
```cmd
# Add to PATH
setx PATH "%PATH%;C:\Program Files\nodejs\"
```

### FortiClient VPN Issues:
- Check FortiGate logs: Log & Report → Forward Traffic
- Verify SSL-VPN portal is enabled
- Check user credentials
- Verify firewall policies

---

## 📝 Next Steps

1. ✅ Complete Windows Server setup
2. ✅ Test all integrations (CSQ, Telefonica)
3. ✅ Provide VPN credentials to Telefonica
4. ✅ Share API documentation (Spanish guide)
5. ✅ Monitor first transactions
6. ✅ Set up automated backups
7. ✅ Configure monitoring/alerts

---

## 📁 Important Files Locations

```
C:\Latcom\                          # Main application
C:\Latcom\.env.production           # Production config
C:\Latcom\server.js                 # Main server
C:\Latcom\providers\                # Payment providers
C:\Latcom\views\admin.html          # Admin portal
C:\Program Files\PostgreSQL\15\     # Database
C:\ProgramData\PM2\                 # PM2 logs (if used)
```

---

## 🔗 Useful Resources

- Node.js Windows: https://nodejs.org/
- PostgreSQL Windows: https://www.postgresql.org/download/windows/
- PM2 Documentation: https://pm2.keymetrics.io/
- Fortinet Documentation: https://docs.fortinet.com/

---

**Need help? Contact: richardmas@gmail.com**
