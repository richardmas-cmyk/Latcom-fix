# Latcom/Relier Payment System - Quick Start (Windows Server)

## 🚀 Fast Track Deployment

### Prerequisites Checklist:
- [ ] Windows Server 2016+ with Admin access
- [ ] Fortinet FortiGate configured
- [ ] Downloaded `LATCOM_WINDOWS_DEPLOYMENT.zip`

---

## 5-Step Deployment

### Step 1: Install Software (15 min)

```cmd
# 1. Install Node.js LTS from https://nodejs.org/
# 2. Install PostgreSQL from https://www.postgresql.org/download/windows/
#    Password for postgres user: [write it down!]
# 3. Verify installations
node --version
psql --version
```

### Step 2: Deploy Application (5 min)

```cmd
# Extract deployment package
mkdir C:\Latcom
cd C:\Latcom
# Unzip LATCOM_WINDOWS_DEPLOYMENT.zip here

# Install dependencies
npm install --production
npm install -g pm2 pm2-windows-startup
```

### Step 3: Setup Database (5 min)

```sql
-- Open pgAdmin or psql as postgres user
CREATE DATABASE latcom_production;
CREATE USER latcom_user WITH PASSWORD 'ChangeThisPassword123!';
GRANT ALL PRIVILEGES ON DATABASE latcom_production TO latcom_user;
\q
```

```cmd
# Initialize database
cd C:\Latcom
node add-balance-audit-log.js
```

### Step 4: Configure Environment (10 min)

```cmd
# Edit production config
notepad C:\Latcom\.env.production
```

**CRITICAL - Update these values:**
```ini
DATABASE_URL=postgresql://latcom_user:ChangeThisPassword123!@localhost:5432/latcom_production
ADMIN_KEY=relier_admin_prod_2025_[CHANGE_THIS]
RECONCILE_KEY=relier_reconcile_prod_2025_[CHANGE_THIS]

# CSQ Production (already configured)
CSQ_USERNAME=host.180167
CSQ_PASSWORD=z5r3rr3s96
CSQ_TERMINAL_ID=180167

# Telefonica (fill in your values)
TELEFONICA_PASSWORD_IVR=your_password
TELEFONICA_PUNTO_VENTA=your_id
```

### Step 5: Start Service (5 min)

```cmd
# Configure PM2 auto-start
pm2-startup install

# Start application
cd C:\Latcom
pm2 start server.js --name latcom-api --env production
pm2 save

# Configure Windows Firewall
New-NetFirewallRule -DisplayName "Latcom API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## ✅ Verify Installation

```cmd
# Check service status
pm2 status

# Test locally
curl http://localhost:3000/health

# Test CSQ integration
node list-csq-products-production.js

# Open admin panel
start http://localhost:3000/admin
```

---

## 🔐 Configure Fortinet VPN for Telefonica

### Option A: Create VPN User (Recommended)

1. **Login to FortiGate**: `https://[your-fortigate-ip]`

2. **Create VPN User**:
   - User & Device → User Definition → Create New
   - Username: `telefonica_api`
   - Password: [Strong password]
   - Type: Local User

3. **Enable SSL-VPN**:
   - VPN → SSL-VPN Settings
   - ☑ Enable SSL-VPN
   - Port: 10443
   - Interface: wan1

4. **Create Firewall Policy**:
   - Policy & Objects → Firewall Policy → Create New
   - Name: `Allow_Telefonica_API`
   - Incoming Interface: `ssl.root` (SSL-VPN tunnel)
   - Outgoing Interface: `internal`
   - Source: `all`
   - Destination: `[Your server IP]`
   - Service: `TCP/3000`
   - Action: `ACCEPT`

5. **Give to Telefonica**:
   ```
   VPN Type: SSL-VPN
   Server: https://[your-public-ip]:10443
   Username: telefonica_api
   Password: [password]

   After connecting, API is at:
   http://[your-server-internal-ip]:3000
   ```

### Option B: IP Whitelist (If Telefonica has static IPs)

```
# Add firewall rule
Source: [Telefonica IP range]
Destination: [Your server IP]
Service: TCP/3000
Action: ACCEPT
```

---

## 📊 Monitor System

```cmd
# View logs
pm2 logs latcom-api

# Monitor performance
pm2 monit

# Restart service
pm2 restart latcom-api
```

---

## 🆘 Troubleshooting

### Service Won't Start:
```cmd
# Check logs
pm2 logs latcom-api --lines 50

# Test manually
cd C:\Latcom
node server.js
# Look for errors
```

### Database Connection Error:
```cmd
# Test database
psql -U latcom_user -d latcom_production -h localhost
# If this fails, check DATABASE_URL in .env.production
```

### Port 3000 Already in Use:
```cmd
netstat -ano | findstr :3000
taskkill /PID [process_id] /F
pm2 restart latcom-api
```

### Can't Access from Network:
```cmd
# Check firewall
Get-NetFirewallRule -DisplayName "Latcom API"

# Verify service listening
netstat -an | findstr :3000
```

---

## 📝 Next Steps After Deployment

1. ✅ Test all endpoints with Postman/curl
2. ✅ Add test customers via admin panel
3. ✅ Run test transactions with CSQ
4. ✅ Provide VPN credentials to Telefonica
5. ✅ Share API documentation (HAZ_GUIA_INTEGRACION_API.md)
6. ✅ Monitor first production transactions
7. ✅ Set up database backups

---

## 📞 Support

For detailed instructions, see: `WINDOWS_SERVER_SETUP.md`

**Questions?** richardmas@gmail.com

---

## 🔗 Key Files

- `/admin` - Admin portal (manage customers, view transactions)
- `/api/topup` - Main topup endpoint for customers
- `/api/products` - Available products
- `/health` - Health check
- `.env.production` - Configuration
- `server.js` - Main application

---

**Total Setup Time: ~40 minutes**

✅ After these steps, your payment system will be:
- Running as a Windows service (auto-starts on boot)
- Secured with Fortinet VPN
- Ready for Telefonica integration
- Monitoring with PM2
- CSQ production provider configured
