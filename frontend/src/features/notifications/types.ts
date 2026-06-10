export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP"
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ"
export type TriggerType = "LOW_ATTENDANCE" | "ABSENT_ALERT" | "ATTENDANCE_SUMMARY" | "ADMIN_ALERT"

export interface NotificationTemplate {
  id: string
  trigger_type: TriggerType
  channel: NotificationChannel
  subject?: string
  body_template: string
  is_active: boolean
}

export interface NotificationLog {
  id: string
  recipient: string
  trigger_type: TriggerType
  channel: NotificationChannel
  status: NotificationStatus
  subject?: string
  message_body: string
  created_at: string
  error_message?: string
  retry_count?: number
  last_attempt_at?: string
  sent_at?: string
}

export interface NotificationSchedule {
  id: string
  title: string
  trigger_type: TriggerType
  channels: NotificationChannel[]
  recipient_scope: string
  recipient?: string
  scheduled_at: string
  repeat_interval: string
  is_active: boolean
  last_run_at?: string | null
  next_run_at?: string | null
  parameters?: Record<string, unknown>
  last_error?: string
}

export interface NotificationMeta {
  triggers: { id: string; label: string; variables: string[] }[]
  channels: { id: string; label: string }[]
  statuses: string[]
  stats?: { pending: number; failed: number }
}
