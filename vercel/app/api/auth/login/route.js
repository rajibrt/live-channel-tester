import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE } from '../../../../lib/auth'
import { createSessionToken, SESSION_MAX_AGE } from "../../../../lib/sessionToken";
import {
  getSupabaseAdmin,
  getSupabaseAnonConfig,
} from '../../../../lib/supabaseAdmin'

function redirectRelative(path) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path },
  });
}

export async function POST(request) {
  const form = await request.formData()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  if (!email || !password) {
    return redirectRelative('/login?error=invalid')
  }

  const { url, anon } = getSupabaseAnonConfig()
  const auth = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password,
  })
  if (error || !data?.session?.access_token || !data?.user) {
    return redirectRelative('/login?error=invalid')
  }

  const admin = getSupabaseAdmin()
  const { data: row } = await admin
    .from('admin_users')
    .select('user_id,is_active')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .single()
  if (!row) {
    return redirectRelative('/login?error=invalid')
  }

  const res = redirectRelative('/dashboard')
  const sessionToken = createSessionToken({ sub: data.user.id, typ: "admin" }, SESSION_MAX_AGE);
  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
