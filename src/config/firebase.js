const admin = require('firebase-admin');
const env = require('./env');

let fcmAvailable = false;

// If credentials are blank/mock, use simulation mode
if (
  env.firebase.projectId &&
  env.firebase.projectId !== 'your_project_id' &&
  env.firebase.clientEmail &&
  env.firebase.privateKey
) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebase.projectId,
        clientEmail: env.firebase.clientEmail,
        privateKey: env.firebase.privateKey
      })
    });
    console.log('Firebase Admin SDK Initialized (FCM Active).');
    fcmAvailable = true;
  } catch (error) {
    console.warn('⚠️ Firebase Admin SDK failed to initialize. Falling back to notification simulation:', error.message);
  }
} else {
  console.log('🔄 Firebase configuration is mock/empty. Push notifications will run in simulation mode.');
}

module.exports = {
  admin,
  fcmAvailable
};
