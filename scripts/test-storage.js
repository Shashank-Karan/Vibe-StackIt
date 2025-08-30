import 'dotenv/config';
import { storage } from '../server/storage.ts';

async function testStorage() {
  try {
    console.log('Testing storage.getNotifications for user 16...');
    
    const notifications = await storage.getNotifications(16);
    console.log(`Found ${notifications.length} notifications:`);
    
    notifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.title} - ${notification.message}`);
    });
    
    console.log('\nTesting unread count...');
    const count = await storage.getUnreadNotificationCount(16);
    console.log(`Unread count: ${count}`);
    
  } catch (error) {
    console.error('Error testing storage:', error);
  }
  
  process.exit(0);
}

testStorage();
