require('dotenv').config();  
const admin_mod = require('./src/config/firebase');  
const mongoose = require('mongoose');  
const Technician = require('./src/models/Technician');  
console.log('FCM Available:', admin_mod.fcmAvailable);  
mongoose.connect(process.env.MONGODB_URI).then(async function() {  
  var query = {}; query['fcmToken'] = {,};  
  var tech = await Technician.findOne(query).select('name fcmToken');  
  if (!tech) { console.log('NO TECH WITH TOKEN'); process.exit(0); }  
  console.log('Tech:', tech.name, 'Token:', tech.fcmToken ? tech.fcmToken.substring(0,50) : 'NULL');  
  process.exit(0);  
}).catch(function(e){ console.log('DB Error:', e.message); process.exit(1); }); 
