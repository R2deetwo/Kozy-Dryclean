import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
const u = await db.user.findUnique({ where: { email: 'driver59@kozy-test.example' } })
console.log('found:', !!u, u?.role, u?.accessStatus, 'mustChange:', u?.mustChangePassword, 'verified:', !!u?.emailVerified)
if (u) console.log('password ok:', await bcrypt.compare('Phase59!Rider2026', u.passwordHash))
await db.$disconnect()
