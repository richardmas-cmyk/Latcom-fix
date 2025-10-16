/**
 * Windows Service Uninstallation Script
 * Removes Latcom Payment API Windows Service
 *
 * Usage: node uninstall-service.js
 */

var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: 'Latcom Payment API',
  script: 'C:\\Latcom\\server.js'
});

// Listen for the "uninstall" event
svc.on('uninstall', function(){
  console.log('✅ Service uninstalled successfully!');
  console.log('The service has been removed from Windows Services.');
});

svc.on('error', function(err){
  console.error('❌ Error:', err);
});

svc.on('doesnotexist', function(){
  console.log('⚠️  Service does not exist. Nothing to uninstall.');
});

// Uninstall the service
console.log('🗑️  Uninstalling Latcom Payment API Windows Service...');
svc.uninstall();
