"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/shared/lib/api";
import type { JobResult } from "@/shared/lib/download-artifact";

export interface Job {
  id: string;
  status: string;
  jobType: string;
  result: JobResult | null;
}

export function fetchJob(jobId: string) {
  return adminApi<Job>(`/jobs/${jobId}`);
}

export function useExportJob(jobId?: string) {
  return useQuery({
    queryKey: ["export-job", jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => ["COMPLETED", "FAILED"].includes(query.state.data?.status ?? "") ? false : 2000,
  });
}
