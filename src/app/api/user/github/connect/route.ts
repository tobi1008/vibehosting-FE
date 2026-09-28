import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(
        new URL('/profile?error=github_oauth_missing_config', req.url)
      );
    }

    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get('returnTo') || '/profile';

    // Tạo state payload ký mã hóa chống CSRF
    const secret = process.env.NEXTAUTH_SECRET || '***REMOVED***';
    const payload = JSON.stringify({ userId, returnTo, time: Date.now() });
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');

    // Callback URL
    const reqUrl = new URL(req.url);
    const host = req.headers.get('x-forwarded-host') || reqUrl.host;
    const proto = req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
    const redirectUri = `${proto}://${host}/api/user/github/callback`;

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'repo,read:user,user:email');
    githubAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('Error initiating GitHub OAuth connect:', error);
    return NextResponse.redirect(new URL('/profile?error=oauth_init_failed', req.url));
  }
}
