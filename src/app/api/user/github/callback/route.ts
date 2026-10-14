import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { saveUserGithubTokens } from '@/lib/githubToken';

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const stateRaw = reqUrl.searchParams.get('state');

  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL('/profile?error=missing_oauth_code', req.url));
  }

  try {
    // 1. Xác thực state payload chống CSRF
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.redirect(new URL('/profile?error=invalid_oauth_state', req.url));
    }
    const decodedState = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'));
    const { payload, hmac } = decodedState;

    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (hmac !== expectedHmac) {
      return NextResponse.redirect(new URL('/profile?error=invalid_oauth_state', req.url));
    }

    const { userId, returnTo } = JSON.parse(payload);
    if (!userId) {
      return NextResponse.redirect(new URL('/profile?error=invalid_user_session', req.url));
    }

    // 2. Trao đổi authorization code lấy access_token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/profile?error=missing_oauth_credentials', req.url));
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('GitHub access_token exchange failed:', tokenData);
      return NextResponse.redirect(
        new URL(`/profile?error=token_exchange_failed&desc=${encodeURIComponent(tokenData.error_description || '')}`, req.url)
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = Number(tokenData.expires_in) || (tokenData.refresh_token ? 28800 : null);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // 3. Lấy thông tin tài khoản GitHub người dùng vừa liên kết
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'VibeHosting',
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL('/profile?error=fetch_github_user_failed', req.url));
    }

    const githubUser = await userRes.json();

    // 4. Lưu trực tiếp vào Database cho User này kèm Refresh Token và thời hạn
    await saveUserGithubTokens(userId, {
      accessToken,
      refreshToken,
      expiresIn,
      expiresAt,
      githubUsername: githubUser.login,
      githubAvatar: githubUser.avatar_url,
    });

    console.log(`[GitHub OAuth] Successfully connected GitHub @${githubUser.login} for user ${userId} with token expiration at: ${expiresAt ? expiresAt.toISOString() : 'N/A'}`);

    const targetUrl = new URL(returnTo || '/profile', req.url);
    targetUrl.searchParams.set('github_connected', 'success');
    return NextResponse.redirect(targetUrl.toString());
  } catch (error: any) {
    console.error('Error in GitHub OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/profile?error=oauth_callback_error&message=${encodeURIComponent(error.message || '')}`, req.url)
    );
  }
}
