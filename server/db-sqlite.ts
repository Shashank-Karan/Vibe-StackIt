import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";

// Create SQLite database for development
const sqlite = new Database('./database.sqlite');

// Create the database instance
export const db = drizzle(sqlite, { schema });

// For compatibility with existing code that expects a pool
export const pool = null;
