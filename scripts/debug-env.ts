// Debug what DATABASE_URL is actually loaded at runtime
import { db } from '../src/lib/db'

console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 30) ?? '(undefined)')
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length ?? 0)
