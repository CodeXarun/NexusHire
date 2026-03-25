import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role

  // Protect candidate routes
  if (pathname.startsWith('/candidate') && (!isLoggedIn || role !== 'candidate')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protect recruiter routes
  if (pathname.startsWith('/recruiter') && (!isLoggedIn || role !== 'recruiter')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/candidate/:path*', '/recruiter/:path*'],
}
