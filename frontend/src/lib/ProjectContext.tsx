"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useSession } from "next-auth/react";
import { parseDeploymentSession } from "@/lib/deployment";

export type ProjectStatus = "deploying" | "active" | "failed";

export interface Project {
  id: string;
  app_name: string;
  repo_url: string;
  app_domain: string;
  status: ProjectStatus;
  createdAt: number;
  arch_type?: string | null;
  db_type?: string | null;
  be_repo_url?: string | null;
  fe_repo_url?: string | null;
  be_domain?: string | null;
  fe_domain?: string | null;
  auto_cicd?: boolean;
}

interface ProjectContextType {
  projects: Project[];
  loading: boolean;
  addProject: (project: Omit<Project, "id" | "createdAt">) => Promise<void>;
  updateProjectStatus: (idOrAppName: string, status: ProjectStatus) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = (session?.user as any)?.id || session?.user?.email;
  const storageKey = userId ? `vibe_projects_${userId}` : null;

  // Migrate old projects from localStorage to admin user
  useEffect(() => {
    if (!userId) return;

    try {
      const oldRaw = localStorage.getItem("vibe_projects");
      if (oldRaw) {
        const oldProjects: Project[] = JSON.parse(oldRaw);
        const validProjects = oldProjects.filter(
          (p) => p.app_name !== "vibe-dashboard" && p.id !== "1"
        );

        if (validProjects.length > 0) {
          validProjects.forEach(async (proj) => {
            try {
              await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  app_name: proj.app_name,
                  repo_url: proj.repo_url,
                  app_domain: proj.app_domain,
                  status: proj.status || "active",
                }),
              });
            } catch (err) {
              console.error("Migration error for project", proj.app_name, err);
            }
          });
        }
        localStorage.setItem("vibe_projects_backup", oldRaw);
        localStorage.removeItem("vibe_projects");
      }
    } catch (e) {
      console.error("Error migrating legacy projects:", e);
    }
  }, [userId]);

  const refreshProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data: Project[] = await res.json();
        const filtered = data.filter((p) => p.app_name !== "vibe-dashboard" && p.id !== "1");

        // Check if there are local projects cached that have not yet been persisted to the server
        if (storageKey) {
          const cachedRaw = localStorage.getItem(storageKey);
          if (cachedRaw) {
            try {
              const localProjects: Project[] = JSON.parse(cachedRaw);
              const unsaved = localProjects.filter(
                (lp) => !filtered.some((sp) => sp.app_name === lp.app_name) && lp.app_name
              );
              if (unsaved.length > 0) {
                for (const proj of unsaved) {
                  try {
                    await fetch("/api/projects", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(proj),
                    });
                  } catch (e) {
                    console.error("Auto-sync unsaved project failed:", proj.app_name, e);
                  }
                }
                // Refetch to get the unified list from the server
                const reRes = await fetch("/api/projects");
                if (reRes.ok) {
                  const reData: Project[] = await reRes.json();
                  const reFiltered = reData.filter((p) => p.app_name !== "vibe-dashboard" && p.id !== "1");
                  setProjects(reFiltered);
                  localStorage.setItem(storageKey, JSON.stringify(reFiltered));
                  return;
                }
              }
            } catch (e) {
              console.error("Error inspecting local projects cache:", e);
            }
          }
        }

        setProjects(filtered);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      } else {
        console.error("Failed to fetch projects:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Failed to sync projects from server:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, storageKey]);

  // Load projects whenever the logged in user changes
  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    if (status === "unauthenticated" || !userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    // Fast load from user-specific localStorage cache if available
    if (storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          setProjects(JSON.parse(cached));
        } else {
          setProjects([]);
        }
      } catch {
        setProjects([]);
      }
    }

    // Sync from server SQLite DB
    refreshProjects();
  }, [status, userId, storageKey, refreshProjects]);

  const addProject = async (projectData: Omit<Project, "id" | "createdAt">) => {
    const tempId = Math.random().toString(36).substring(2, 9);
    const optimisticProject: Project = {
      ...projectData,
      id: tempId,
      createdAt: Date.now(),
    };

    // Optimistic update
    setProjects((prev) => {
      const updated = [optimisticProject, ...prev];
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      });

      if (res.ok) {
        const savedProject: Project = await res.json();
        setProjects((prev) => {
          const updated = prev.map((p) => (p.id === tempId ? savedProject : p));
          if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          }
          return updated;
        });
      } else {
        const errText = await res.text();
        console.error("Failed to persist project to server:", res.status, errText);
      }
    } catch (err) {
      console.error("Failed to persist project:", err);
    }
  };

  const updateProjectStatus = useCallback(
    async (idOrAppName: string, newStatus: ProjectStatus) => {
      setProjects((prev) => {
        const updated = prev.map((p) =>
          p.id === idOrAppName || p.app_name === idOrAppName
            ? { ...p, status: newStatus }
            : p
        );
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        }
        return updated;
      });

      try {
        await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_name: idOrAppName,
            status: newStatus,
          }),
        });
      } catch (err) {
        console.error("Failed to update project status:", err);
      }
    },
    [storageKey]
  );

  // Auto-reconcile status for any projects stuck in "deploying"
  useEffect(() => {
    const deployingProjects = projects.filter((p) => p.status === "deploying");
    if (deployingProjects.length === 0) return;

    let isSubscribed = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://116.118.50.199:8080/api/deploy";
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, "");

    const reconcileDeploying = async () => {
      for (const p of deployingProjects) {
        try {
          const res = await fetch(`${baseUrl}/api/logs/${p.app_name}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.logs) {
            const parsed = parseDeploymentSession(data.logs);
            if (parsed.status === "active" || parsed.status === "failed") {
              if (isSubscribed) {
                updateProjectStatus(p.app_name, parsed.status);
              }
            }
          }
        } catch (err) {
          console.error(`Status sync error for ${p.app_name}:`, err);
        }
      }
    };

    reconcileDeploying();
    const interval = setInterval(reconcileDeploying, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [projects, updateProjectStatus]);

  const removeProject = async (id: string) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete project on server:", err);
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        loading,
        addProject,
        updateProjectStatus,
        removeProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}
