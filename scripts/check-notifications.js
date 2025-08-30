import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { notifications } from '../shared/schema.js';

// Load environment variables
dotenv.config();

// Configure Neon
neonConfig.webSocketConstructor = ws;

// Create database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: { notifications } });

async function checkNotifications() {
  try {
    console.log('Checking notifications in database...');
    
    const allNotifications = await db.select().from(notifications);
    console.log(`Found ${allNotifications.length} notifications:`);
    
    allNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. User ${notification.userId}: ${notification.type} - ${notification.title}`);
    });
    
    if (allNotifications.length === 0) {
      console.log('No notifications found in database. Creating a test notification...');
      
      // Create a test notification
      const [testNotification] = await db.insert(notifications).values({
        userId: 16, // testuser
        type: 'question_answered',
        title: 'Test Notification',
        message: 'This is a test notification to check if the system works',
        questionId: 1,
        answerId: null,
      }).returning();
      
      console.log('Created test notification:', testNotification);
    }
    
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
  
  process.exit(0);
}

checkNotifications();
