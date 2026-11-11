import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

function uuidv4(): string {
  return randomUUID();
}

export type JobType = 
  | 'POST_REPORTED'
  | 'POST_APPROVED'
  | 'POST_REJECTED'
  | 'POST_HIDDEN'
  | 'EMERGENCY_BROADCAST';

export interface NotificationJob {
  id: string;
  type: JobType;
  payload: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  completedAt?: string;
}

class NotificationQueue extends EventEmitter {
  private queue: NotificationJob[] = [];
  private processing: boolean = false;
  private jobHistory: NotificationJob[] = [];
  private stats = {
    totalEnqueued: 0,
    totalCompleted: 0,
    totalFailed: 0
  };

  public enqueue(type: JobType, payload: Record<string, any>): NotificationJob {
    const job: NotificationJob = {
      id: uuidv4(),
      type,
      payload,
      attempts: 0,
      maxAttempts: 3,
      status: 'queued',
      createdAt: new Date().toISOString()
    };

    this.queue.push(job);
    this.stats.totalEnqueued++;
    this.emit('job:enqueued', job);

    // Trigger processing asynchronously in the background event loop
    setImmediate(() => this.processNext());

    return job;
  }

  public getNextJob(): NotificationJob | undefined {
    return this.queue.shift();
  }

  public recordCompletion(job: NotificationJob) {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    this.stats.totalCompleted++;
    this.saveHistory(job);
    this.emit('job:completed', job);
  }

  public recordFailure(job: NotificationJob, err: Error) {
    job.attempts++;
    job.error = err.message;

    if (job.attempts < job.maxAttempts) {
      console.warn(`[Queue] Job ${job.id} (${job.type}) failed (attempt ${job.attempts}). Retrying...`);
      job.status = 'queued';
      // Requeue with slight delay
      setTimeout(() => {
        this.queue.push(job);
        this.processNext();
      }, 1000 * job.attempts);
    } else {
      console.error(`[Queue] Job ${job.id} (${job.type}) permanently failed after ${job.maxAttempts} attempts:`, err.message);
      job.status = 'failed';
      this.stats.totalFailed++;
      this.saveHistory(job);
      this.emit('job:failed', job);
    }
  }

  private saveHistory(job: NotificationJob) {
    this.jobHistory.unshift(job);
    if (this.jobHistory.length > 50) {
      this.jobHistory.pop();
    }
  }

  public getStats() {
    return {
      pendingInQueue: this.queue.length,
      ...this.stats,
      recentJobs: this.jobHistory.slice(0, 10)
    };
  }

  // Hook for the worker
  private workerHandler?: (job: NotificationJob) => Promise<void>;

  public registerWorker(handler: (job: NotificationJob) => Promise<void>) {
    this.workerHandler = handler;
  }

  private async processNext() {
    if (this.processing || !this.workerHandler) return;
    const job = this.getNextJob();
    if (!job) return;

    this.processing = true;
    job.status = 'processing';
    this.emit('job:started', job);

    try {
      await this.workerHandler(job);
      this.recordCompletion(job);
    } catch (err: any) {
      this.recordFailure(job, err);
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

export const notificationQueue = new NotificationQueue();
