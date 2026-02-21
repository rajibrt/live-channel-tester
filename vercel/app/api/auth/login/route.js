import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE } from '../../../../lib/auth'
import {
  getSupabaseAdmin,
  getSupabaseAnonConfig,
} from '../../../../lib/supabaseAdmin'

export async function POST(request) {
  const form = await request.formData()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  if (!email || !password) {
    return NextResponse.redirect(new URL('/login', request.url), {
      status: 302,
    })
  }

  const { url, anon } = getSupabaseAnonConfig()
  const auth = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password,
  })
  if (error || !data?.session?.access_token || !data?.user) {
    return NextResponse.redirect(new URL('/login', request.url), {
      status: 302,
    })
  }

  const admin = getSupabaseAdmin()
  const { data: row } = await admin
    .from('admin_users')
    .select('user_id,is_active')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .single()
  if (!row) {
    return NextResponse.redirect(new URL('/login', request.url), {
      status: 302,
    })
  }

  const res = NextResponse.redirect(new URL('/dashboard', request.url), {
    status: 302,
  })
  res.cookies.set(ADMIN_SESSION_COOKIE, data.session.access_token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
