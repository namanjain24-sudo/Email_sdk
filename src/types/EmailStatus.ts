export enum EmailStatus {
  QUEUED = "queued",
  SENT = "sent",
  FAILED = "failed",
  RETRYING = "retrying",
  DLQ = "dead_letter"
}
