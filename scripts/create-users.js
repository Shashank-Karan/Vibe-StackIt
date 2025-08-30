import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { users } from '../shared/schema.js';

// Load environment variables
dotenv.config();

// Configure Neon
neonConfig.webSocketConstructor = ws;

// Create database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: { users } });

async function createAdminUser() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Create admin user
    const [user] = await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      passwordHash: hashedPassword,
      name: 'Admin User',
      email: 'admin@stackit.com',
      isAdmin: true,
    }).returning();
    
    console.log('Admin user created successfully:', user);
    
    // Also create a regular test user
    const testPassword = await bcrypt.hash('test123', 12);
    const [testUser] = await db.insert(users).values({
      username: 'testuser',
      password: testPassword,
      passwordHash: testPassword,
      name: 'Test User',
      email: 'test@stackit.com',
      isAdmin: false,
    }).returning();
    
    console.log('Test user created successfully:', testUser);
    
  } catch (error) {
    console.error('Error creating users:', error);
  }
  
  process.exit(0);
}

createAdminUser();
