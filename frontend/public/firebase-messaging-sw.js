// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  // Firebase config object
  apiKey: "AIzaSyC0775aaYxluwZGcaitaAkmFLvT457cXhs",
  // VITE_apiKey
  authDomain: "carpool-ff143.firebaseapp.com",
  // VITE_authDomain
  projectId: "carpool-ff143",
  // VITE_projectId
  storageBucket: "carpool-ff143.firebasestorage.app",
  // VITE_storageBucket
  messagingSenderId: "82851711305",
  // VITE_messagingSenderId
  appId: "1:82851711305:web:b92eb7b9989acdb58b3298",
  // VITE_appId
  measurementId: "G-CXPC301TSN",
  // VITE_measurementId
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Optional: Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/your-icon.png', // Optional: Add an icon in public/
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});