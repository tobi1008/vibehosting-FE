'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  LogIn,
  Trash2,
  Shield,
  FolderGit2,
  Calendar,
  Search,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ManagedUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: string;
  githubUsername: string | null;
  githubAvatar: string | null;
  createdAt: string;
  _count: {
    projects: number;
  };
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Impersonating state
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Password Reset Modal state
  const [passwordModalUser, setPasswordModalUser] = useState<ManagedUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');

  const currentUserId = (session?.user as any)?.id;
  const isCurrentAdmin = (session?.user as any)?.role === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !isCurrentAdmin) {
      router.push('/');
    }
  }, [status, isCurrentAdmin, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && isCurrentAdmin) {
      fetchUsers();
    }
  }, [status, isCurrentAdmin, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (username.trim().length < 3) {
      setCreateError('Username must be at least 3 characters long');
      return;
    }

    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters long');
      return;
    }

    setIsCreating(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim() || undefined,
          password,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user');
        setIsCreating(false);
        return;
      }

      setActionSuccess(`User @${username.trim()} created successfully!`);
      setTimeout(() => setActionSuccess(''), 4000);

      // Reset form & close modal
      setUsername('');
      setName('');
      setPassword('');
      setRole('user');
      setIsModalOpen(false);

      await fetchUsers();
    } catch (err) {
      setCreateError('An error occurred while creating user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!confirm(`Are you sure you want to delete user @${user.username}? This will also remove all their projects.`)) {
      return;
    }

    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to delete user');
        return;
      }

      setActionSuccess(`User @${user.username} deleted.`);
      setTimeout(() => setActionSuccess(''), 4000);
      await fetchUsers();
    } catch (err) {
      setActionError('An error occurred while deleting user');
    }
  };

  const handleImpersonate = async (targetUser: ManagedUser) => {
    if (targetUser.id === currentUserId) return;

    setImpersonatingId(targetUser.id);
    setActionError('');

    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUser.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to initialize impersonation');
        setImpersonatingId(null);
        return;
      }

      // Perform NextAuth sign-in with impersonation token
      const loginRes = await signIn('credentials', {
        redirect: false,
        impersonateUserId: data.impersonateUserId,
        impersonateToken: data.impersonateToken,
      });

      if (!loginRes?.error) {
        // Redirect to dashboard as this user
        window.location.href = '/';
      } else {
        setActionError('Failed to switch user session');
        setImpersonatingId(null);
      }
    } catch (err) {
      setActionError('An error occurred during impersonation');
      setImpersonatingId(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setPasswordModalError('');

    if (newPasswordInput.length < 6) {
      setPasswordModalError('Password must be at least 6 characters long');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: passwordModalUser.id,
          newPassword: newPasswordInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordModalError(data.error || 'Failed to update password');
        setIsUpdatingPassword(false);
        return;
      }

      setActionSuccess(`Password updated successfully for @${passwordModalUser.username}!`);
      setTimeout(() => setActionSuccess(''), 4000);
      setPasswordModalUser(null);
      setNewPasswordInput('');
    } catch {
      setPasswordModalError('An error occurred while updating password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalProjects = users.reduce((acc, u) => acc + (u._count?.projects || 0), 0);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-foreground" />
            User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage system user accounts, monitor project allocations, and directly switch sessions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-4 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Create New User
        </button>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-foreground/50" />
          </div>
          <p className="text-3xl font-bold text-foreground">{users.length}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Administrators</span>
            <Shield className="w-4 h-4 text-amber-500/70" />
          </div>
          <p className="text-3xl font-bold text-amber-500">{totalAdmins}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Deployed Projects</span>
            <FolderGit2 className="w-4 h-4 text-blue-500/70" />
          </div>
          <p className="text-3xl font-bold text-blue-500">{totalProjects}</p>
        </div>
      </div>

      {/* Search & Users Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4 bg-muted/20">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, display name, or role..."
              className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm outline-none focus:border-foreground transition-all"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> of {users.length} users
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6 font-semibold">User</th>
                <th className="py-3.5 px-6 font-semibold">Role</th>
                <th className="py-3.5 px-6 font-semibold text-center">Projects</th>
                <th className="py-3.5 px-6 font-semibold">Created</th>
                <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isBusy = impersonatingId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                            {user.githubAvatar ? (
                              <img src={user.githubAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.name?.[0] || user.username[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-2">
                              {user.name || user.username}
                              {isSelf && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border font-mono">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">@{user.username}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            user.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                          }`}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded-full text-foreground border border-border">
                          <FolderGit2 className="w-3 h-3 text-muted-foreground" />
                          {user._count?.projects || 0}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Impersonate Button */}
                          {!isSelf ? (
                            <button
                              onClick={() => handleImpersonate(user)}
                              disabled={isBusy}
                              title={`Log in directly as @${user.username}`}
                              className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <LogIn className="w-3.5 h-3.5" />
                              )}
                              Log In As
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic px-3 py-1.5">
                              Current Account
                            </span>
                          )}

                          {/* Change Password Button */}
                          <button
                            onClick={() => {
                              setPasswordModalUser(user);
                              setNewPasswordInput('');
                              setPasswordModalError('');
                              setShowNewPassword(false);
                            }}
                            title={`Change password for @${user.username}`}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          {!isSelf && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              title="Delete user"
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h2 className="font-semibold text-base text-foreground">Create New User</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
                {createError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-3.5 py-2 rounded-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center justify-center gap-2 border rounded-md p-2.5 text-xs font-medium cursor-pointer transition-all ${
                        role === 'user'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="user"
                        checked={role === 'user'}
                        onChange={() => setRole('user')}
                        className="sr-only"
                      />
                      Standard User
                    </label>

                    <label
                      className={`flex items-center justify-center gap-2 border rounded-md p-2.5 text-xs font-medium cursor-pointer transition-all ${
                        role === 'admin'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                        className="sr-only"
                      />
                      Administrator
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 py-2 px-4 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    Create Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {passwordModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-foreground">Change Password</h2>
                    <p className="text-xs text-muted-foreground font-mono">@{passwordModalUser.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPasswordModalUser(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4">
                {passwordModalError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-3.5 py-2 rounded-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordModalError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      className="w-full bg-background border border-border rounded-md pl-3 pr-10 py-2 text-sm outline-none focus:border-foreground transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    User will immediately be able to log in with this new password.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 py-2 px-4 rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                    Save Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
