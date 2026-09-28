export interface ParsedDeployment {
  status: "deploying" | "active" | "failed" | "deleted";
  sessionLines: string[];
}

/**
 * Counts how many deployment sessions exist in the raw logs.
 */
export function countDeployMarkers(rawLogs: string): number {
  if (!rawLogs) return 0;
  const matches = rawLogs.match(/===\s*\[BẮT ĐẦU TRIỂN KHAI\]/g);
  return matches ? matches.length : 0;
}

/**
 * Extracts lines belonging to the latest deployment session,
 * optionally ensuring it is a new session started after initialMarkerCount.
 */
export function extractCurrentSessionLines(
  rawLogs: string,
  initialMarkerCount?: number
): { sessionLines: string[]; isNewSessionStarted: boolean } {
  if (!rawLogs) {
    return { sessionLines: [], isNewSessionStarted: false };
  }

  const allLines = rawLogs.split('\n').filter((l) => l.trim().length > 0);
  const deployIndices: number[] = [];

  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].includes("=== [BẮT ĐẦU TRIỂN KHAI]")) {
      deployIndices.push(i);
    }
  }

  if (typeof initialMarkerCount === "number" && initialMarkerCount > 0) {
    if (deployIndices.length <= initialMarkerCount) {
      return { sessionLines: [], isNewSessionStarted: false };
    }
  }

  if (deployIndices.length === 0) {
    // If no explicit deploy marker, take recent lines
    return {
      sessionLines: allLines.slice(-200),
      isNewSessionStarted: true,
    };
  }

  const lastDeployIndex = deployIndices[deployIndices.length - 1];
  return {
    sessionLines: allLines.slice(lastDeployIndex),
    isNewSessionStarted: true,
  };
}

/**
 * Parses the status of a deployment from its log session lines or raw logs.
 */
export function parseDeploymentSession(rawLogsOrSession: string | string[]): ParsedDeployment {
  let lines: string[] = [];

  if (Array.isArray(rawLogsOrSession)) {
    lines = rawLogsOrSession.map((l) => l.trim()).filter(Boolean);
  } else if (typeof rawLogsOrSession === "string") {
    const { sessionLines } = extractCurrentSessionLines(rawLogsOrSession);
    lines = sessionLines.map((l) => l.trim()).filter(Boolean);
  }

  if (lines.length === 0) {
    return { status: "deploying", sessionLines: [] };
  }

  const isDeleteSession = lines[0]?.includes("=== [BẮT ĐẦU XÓA DỰ ÁN]");
  if (isDeleteSession) {
    const isDeleted = lines.some(
      (l) =>
        l === "DELETED" ||
        l.includes("=== [HOÀN TẤT XÓA]") ||
        l.includes("=== HOÀN TẤT XÓA ===")
    );
    return {
      status: isDeleted ? "deleted" : "deploying",
      sessionLines: lines,
    };
  }

  const lastLine = lines[lines.length - 1] || "";

  // Success conditions:
  // 1. Line is exactly "DONE"
  // 2. Contains completion banner
  const isSuccess = lines.some(
    (l) =>
      l === "DONE" ||
      l.includes("=== HOÀN TẤT TRIỂN KHAI ===") ||
      l.includes("=== [HOÀN TẤT]") ||
      l.includes("=== [HOÀN TẤT CI/CD]")
  );

  // Failure conditions:
  // 1. Last non-empty line is "ERROR" or terminal failure signal
  // 2. Fatal error encountered or [LỖI NGHIÊM TRỌNG]
  const upperLastLine = lastLine.toUpperCase();
  const isFailed =
    !isSuccess &&
    (lastLine === "ERROR" ||
      upperLastLine.startsWith("ERROR:") ||
      upperLastLine.startsWith("FATAL:") ||
      upperLastLine === "FAILED" ||
      upperLastLine.includes("DEPLOYMENT FAILED") ||
      lines.some((l) => l.includes("[LỖI NGHIÊM TRỌNG]") || l.includes("=== [THẤT BẠI]")) ||
      (lines.some((l) => l.includes("Error: Docker build failed")) && lastLine === "ERROR"));

  if (isSuccess) {
    return { status: "active", sessionLines: lines };
  }

  if (isFailed) {
    return { status: "failed", sessionLines: lines };
  }

  return { status: "deploying", sessionLines: lines };
}
