'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Search,
  Rocket,
  Lock,
  Globe,
  User,
  Shield,
  Calendar,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

function GithubIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

interface UserProfile {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: string;
  githubUsername: string | null;
  githubAvatar: string | null;
  isGithubConnected: boolean;
  createdAt: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  language: string | null;
  is_private: boolean;
  stars: number;
  updated_at: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Edit name state
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  // GitHub token state
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [githubSuccess, setGithubSuccess] = useState('');

  // Repos state
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
        setDisplayName(data.name || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const fetchRepos = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch('/api/user/github/repos');
      const data = await res.json();
      if (res.ok && data.connected && Array.isArray(data.repos)) {
        setRepos(data.repos);
      } else {
        setRepos([]);
        if (data.tokenExpired || res.status === 401) {
          setGithubError(data.error || 'GitHub Token đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại Token mới.');
          setProfile(prev => prev ? { ...prev, isGithubConnected: false, githubUsername: null, githubAvatar: null } : null);
        }
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [status, fetchProfile]);

  useEffect(() => {
    if (profile?.isGithubConnected) {
      fetchRepos();
    } else {
      setRepos([]);
    }
  }, [profile?.isGithubConnected, fetchRepos]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingName(true);
    setNameSaveSuccess(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNameSaveSuccess(true);
        setTimeout(() => setNameSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error updating name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    setGithubError('');
    setGithubSuccess('');

    if (!tokenInput.trim()) {
      setGithubError('Please enter a GitHub Personal Access Token');
      return;
    }

    setIsConnecting(true);

    try {
      const res = await fetch('/api/user/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGithubError(data.error || 'Failed to connect GitHub account');
        setIsConnecting(false);
        return;
      }

      setGithubSuccess(data.message || 'Connected successfully!');
      setTokenInput('');
      await fetchProfile();
      await fetchRepos();
    } catch (err) {
      setGithubError('An error occurred while connecting to GitHub.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!confirm('Are you sure you want to disconnect your GitHub account?')) {
      return;
    }

    setIsDisconnecting(true);
    setGithubError('');
    setGithubSuccess('');

    try {
      const res = await fetch('/api/user/github', { method: 'DELETE' });
      if (res.ok) {
        setGithubSuccess('GitHub account disconnected successfully.');
        setRepos([]);
        await fetchProfile();
      }
    } catch (err) {
      setGithubError('Failed to disconnect GitHub account.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const filteredRepos = repos.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.language && r.language.toLowerCase().includes(q))
    );
  });

  if (status === 'loading' || loadingProfile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Profile & Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account profile, personal information, and GitHub repository integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Account Details */}
        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-2xl overflow-hidden shadow-md">
                {profile?.githubAvatar ? (
                  <img src={profile.githubAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.name?.[0] || profile?.username?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  {profile?.name || profile?.username}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">@{profile?.username}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                      profile?.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    }`}
                  >
                    {profile?.role || 'USER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Information Form */}
            <form onSubmit={handleSaveName} className="flex flex-col gap-4 border-t border-border pt-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  disabled
                  value={profile?.username || ''}
                  className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Email
                </label>
                <input
                  type="text"
                  disabled
                  value={profile?.email || `${profile?.username}@vibehosting.com`}
                  className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-green-500 flex items-center gap-1">
                  {nameSaveSuccess && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Updated!
                    </>
                  )}
                </span>
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 py-2 px-3 rounded-md text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Quick Info Box */}
          <div className="bg-card border border-border rounded-xl p-5 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-foreground/60" />
              <span>
                Joined:{' '}
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recent'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-foreground/60" />
              <span>Isolated Database: SQLite</span>
            </div>
          </div>
        </div>

        {/* Right Column: GitHub Integration & Repositories */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* GitHub Connection Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#24292e] text-white flex items-center justify-center shadow-md">
                  <GithubIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">GitHub Integration</h2>
                  <p className="text-xs text-muted-foreground">
                    Connect your GitHub account to browse and deploy your repositories.
                  </p>
                </div>
              </div>

              {profile?.isGithubConnected ? (
                <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full font-medium">
                  Not Connected
                </span>
              )}
            </div>

            {/* Notification Messages */}
            {githubError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{githubError}</span>
              </div>
            )}

            {githubSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{githubSuccess}</span>
              </div>
            )}

            {profile?.isGithubConnected ? (
              /* Already Connected View */
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 border border-border rounded-lg p-4 mt-2">
                <div className="flex items-center gap-3">
                  {profile.githubAvatar ? (
                    <img
                      src={profile.githubAvatar}
                      alt={profile.githubUsername || 'GitHub'}
                      className="w-11 h-11 rounded-full border border-border"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                      <GithubIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <a
                      href={`https://github.com/${profile.githubUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:underline flex items-center gap-1 text-sm"
                    >
                      @{profile.githubUsername}
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {repos.length} {repos.length === 1 ? 'repository' : 'repositories'} loaded
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDisconnectGithub}
                  disabled={isDisconnecting}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Disconnect Account
                </button>
              </div>
            ) : (
              /* Connect Form */
              <div className="mt-4 flex flex-col gap-4">
                {/* 1-Click GitHub OAuth Connect Button */}
                <div className="p-4 bg-muted/40 border border-border/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <GithubIcon className="w-4 h-4" />
                      Kết nối trực tiếp qua GitHub (1-Click OAuth)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bấm nút để ủy quyền cho Vibe Hosting tự động nạp repositories mà không cần tạo token thủ công.
                    </p>
                  </div>
                  <a
                    href="/api/user/github/connect?returnTo=/profile"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#24292e] hover:bg-[#1b1f23] text-white font-medium text-xs rounded-lg transition-all shadow-sm active:scale-95 shrink-0 border border-[#444d56]"
                  >
                    <GithubIcon className="w-4 h-4" />
                    <span>Connect with GitHub</span>
                  </a>
                </div>

                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-border w-full"></div>
                  <span className="bg-background px-3 text-[11px] text-muted-foreground uppercase tracking-wider shrink-0">
                    hoặc nhập Personal Access Token thủ công
                  </span>
                  <div className="border-t border-border w-full"></div>
                </div>

                <div className="bg-muted/30 border border-border/80 rounded-lg p-4 text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-foreground" />
                    Connect via Personal Access Token (Classic or Fine-grained)
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>
                      Go to GitHub Settings &rarr; Developer Settings &rarr;{' '}
                      <a
                        href="https://github.com/settings/tokens/new?description=VibeHosting&scopes=repo,read:user"
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline font-medium hover:text-primary inline-flex items-center gap-0.5"
                      >
                        Generate new token (classic)
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Select the <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">repo</code> scope (Full control of private & public repositories).</li>
                    <li>Generate the token, copy and paste it into the field below.</li>
                  </ol>
                </div>

                <form onSubmit={handleConnectGithub} className="flex flex-col gap-3">
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm font-mono outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-4 rounded-lg font-medium text-sm transition-all shadow-sm active:scale-98 disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GithubIcon className="w-4 h-4" />}
                    Connect GitHub Account
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Repositories Section (Visible when GitHub is connected) */}
          {profile?.isGithubConnected && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    Repositories
                    <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-mono">
                      {repos.length}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select any repository to start a new deployment.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search repos..."
                      className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-foreground transition-all"
                    />
                  </div>

                  <button
                    onClick={fetchRepos}
                    disabled={loadingRepos}
                    title="Refresh repositories"
                    className="p-1.5 bg-background border border-border rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingRepos ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {loadingRepos ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading your GitHub repositories...</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-12 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
                  {searchQuery ? 'No repositories match your search.' : 'No repositories found on this GitHub account.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredRepos.map((repo) => (
                    <motion.div
                      key={repo.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group border border-border bg-background hover:border-foreground/40 rounded-lg p-4 transition-all flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground hover:underline text-sm truncate flex items-center gap-1 group-hover:text-primary transition-colors"
                          >
                            {repo.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </a>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground shrink-0 flex items-center gap-1">
                            {repo.is_private ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                            {repo.is_private ? 'Private' : 'Public'}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 min-h-[2rem]">
                          {repo.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              {repo.language}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/new?repo_url=${encodeURIComponent(repo.clone_url)}&app_name=${encodeURIComponent(repo.name)}`}
                          className="flex items-center gap-1 bg-foreground text-background hover:bg-foreground/90 px-2.5 py-1 rounded text-xs font-medium transition-all active:scale-95 shadow-xs"
                        >
                          <Rocket className="w-3 h-3" />
                          Deploy
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
