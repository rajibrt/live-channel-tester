import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_SESSION_COOKIE } from '../../../../lib/auth'
import { createSessionToken, SESSION_MAX_AGE } from "../../../../lib/sessionToken";
import { getBaseUrl } from "../../../../lib/siteUrl";
import {
  getSupabaseAdmin,
  getSupabaseAnonConfig,
} from '../../../../lib/supabaseAdmin'

export async function POST(request) {
  const baseUrl = getBaseUrl();
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);
  const form = await request.formData()
  const email = String(form.get('email') || '').trim()
  const password = String(form.get('password') || '')
  if (!email || !password) {
    return NextResponse.redirect(toRedirectUrl('/login?error=invalid'), {
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
    return NextResponse.redirect(toRedirectUrl('/login?error=invalid'), {
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
    return NextResponse.redirect(toRedirectUrl('/login?error=invalid'), {
      status: 302,
    })
  }

  const res = NextResponse.redirect(toRedirectUrl('/dashboard'), {
    status: 302,
  })
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
