import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/lib/models/User'
import { authConfig } from '@/lib/auth.config'
import { getImageSignedUrl } from '@/lib/s3'

// Verify a Firebase ID token using Firebase REST API (no Admin SDK needed)
async function verifyFirebaseIdToken(idToken: string) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    const data = await res.json()
    if (data.error || !data.users?.[0]) return null
    return data.users[0] as {
      localId: string
      email: string
      displayName?: string
      photoUrl?: string
    }
  } catch {
    return null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...(authConfig.callbacks as any),
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string

        // If `user.image` is an S3 object key, convert it to a signed URL
        // so the browser can display the avatar.
        try {
          await connectDB()
          if (session.user.id) {
            const user = await UserModel.findById(session.user.id).lean()
            const img = user?.image ? String(user.image) : null
            session.user.image = !img
              ? null
              : img.startsWith('data:')
                ? img
                : img.startsWith('http://') || img.startsWith('https://')
                  ? img
                  : await getImageSignedUrl(img)
          }
        } catch {
          // If DB/S3 is unavailable, keep existing session image.
        }
      }
      return session
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        firebaseToken: { label: 'Firebase Token', type: 'text' },
        role: { label: 'Role', type: 'text' },
      },
      async authorize(credentials) {
        await connectDB()

        // ── Firebase Google sign-in path ──────────────────────────────
        if (credentials?.firebaseToken) {
          const fbUser = await verifyFirebaseIdToken(credentials.firebaseToken as string)
          if (!fbUser?.email) return null

          const existingUser = await UserModel.findOne({ email: fbUser.email }).lean()

          if (existingUser) {
            return {
              id: existingUser._id.toString(),
              email: existingUser.email,
              name: existingUser.name,
              role: existingUser.role,
              image: existingUser.image ?? null,
            }
          }

          // New user — create with chosen role (defaults to 'candidate')
          const role = (credentials.role as string) || 'candidate'
          const newUser = await UserModel.create({
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
            image: fbUser.photoUrl ?? null,
            role,
            provider: 'firebase',
          })

          return {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            image: newUser.image ?? null,
          }
        }

        // ── Email + password path ─────────────────────────────────────
        if (!credentials?.email || !credentials?.password) return null
        const user = await UserModel.findOne({ email: credentials.email }).lean()
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image ?? null,
        }
      },
    }),
  ],
})

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
