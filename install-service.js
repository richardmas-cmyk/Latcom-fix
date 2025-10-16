/**
 * Windows Service Installation Script
 * Installs Latcom Payment API as a Windows Service
 *
 * Usage: node install-service.js
 */

var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: 'Latcom Payment API',
  description: 'Relier Payment System - API for Mobile Topups and Bill Payments',
  script: 'C:\\Latcom\\server.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "PORT",
      value: "3000"
    }
  ],
  workingDirectory: 'C:\\Latcom',
  allowServiceLogon: true
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function(){
  console.log('✅ Service installed successfully!');
  console.log('🚀 Starting service...');
  svc.start();
});

svc.on('start', function(){
  console.log('✅ Service started!');
  console.log('📊 Service name:', svc.name);
  console.log('🌐 Server should be running on http://localhost:3000');
  console.log('\n📝 Service Management Commands:');
  console.log('   Start:   net start "Latcom Payment API"');
  console.log('   Stop:    net stop "Latcom Payment API"');
  console.log('   Restart: net stop "Latcom Payment API" && net start "Latcom Payment API"');
});

svc.on('alreadyinstalled', function(){
  console.log('⚠️  Service is already installed.');
  console.log('To reinstall, first run: node uninstall-service.js');
});

svc.on('error', function(err){
  console.error('❌ Error:', err);
});

// Install the service
console.log('📦 Installing Latcom Payment API as Windows Service...');
console.log('   This may take a moment...\n');
svc.install();
