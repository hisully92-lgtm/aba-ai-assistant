type Job = {
  id: string;
  userId: string;
  type: "ai_note" | "ai_summary" | "ai_report";
  payload: any;
  status: "pending" | "processing" | "done" | "failed";
};

const jobs: Record<string, Job> = {};

export function createJob(job: Job) {
  jobs[job.id] = job;
}

export function getJob(id: string) {
  return jobs[id];
}

export function updateJob(id: string, update: Partial<Job>) {
  jobs[id] = { ...jobs[id], ...update };
}