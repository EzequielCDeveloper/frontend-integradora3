/**
 * Employer Service Contracts — Mirroring Supabase RLS Reads & RPC Functions
 * Source of Truth: /docs/001_trabajos_temporales.sql & /docs/Especificacion_de_Arquitectura_de_Software_v2.md (Section 5.3-5.6)
 */
import type {
  ApplicantPublicProfile,
  ApplicantSummary,
  Attachment,
  CaseStatus,
  CaseType,
  CaseWithThread,
  ChatMessage,
  CounterpartContact,
  DeviceToken,
  EmployerJobCardItem,
  EmployerJobDetailView,
  EmployerPaymentHistoryItem,
  JobCategory,
  JobCompletion,
  JobStatus,
  Notification,
  Payment,
  PaymentBreakdown,
  Profile,
  Review,
  TermsAcceptance,
  TicketCategory,
} from '@/types/database';

export interface CreateJobInput {
  title: string;
  description: string;
  category: JobCategory;
  fixed_payment_mxn: number;
  job_date: string;
  start_time: string;
  end_time: string;
  conditions: string;
  neighborhood: string;
  exact_address: string;
  exact_latitude: number;
  exact_longitude: number;
  photos?: {
    file_name: string;
    mime_type: 'image/jpeg' | 'image/png';
    size_bytes: number;
  }[];
}

export interface UpdateJobInput extends CreateJobInput {
  job_id: string;
}

export interface OpenCaseInput {
  case_type: CaseType;
  job_id: string | null;
  ticket_category: TicketCategory | null;
  description: string;
  evidences?: {
    file_name: string;
    mime_type: 'image/jpeg' | 'image/png' | 'application/pdf';
    size_bytes: number;
  }[];
}

export interface SubmitReviewInput {
  job_id: string;
  reviewee_id: string;
  rating: number;
  comment: string;
}

export interface EmployerAuthSession {
  user_id: string;
  email: string;
  email_verified: boolean;
  profile: Profile | null;
  terms_accepted: TermsAcceptance[];
}

export interface IEmployerRepository {
  // 1. Auth & Perfil (UI-EMP-01, UI-EMP-13)
  getCurrentSession(): Promise<EmployerAuthSession | null>;
  login(email: string, password: string): Promise<EmployerAuthSession>;
  register(input: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    birth_date: string;
    accept_terms: boolean;
    accept_privacy: boolean;
  }): Promise<{ pending_verification_email: string; verification_code_hint: string }>;
  verifyEmailCode(email: string, code: string): Promise<EmployerAuthSession>;
  resetPassword(email: string): Promise<{ message: string }>;
  complete_profile(input: {
    full_name: string;
    phone: string;
    birth_date: string;
  }): Promise<Profile>;
  accept_terms(document: 'terms' | 'privacy', version: string): Promise<TermsAcceptance>;
  updateEmployerProfile(input: {
    full_name: string;
    phone: string;
    photo_path?: string | null;
  }): Promise<Profile>;
  logout(): Promise<void>;

  // 2. Trabajos (UI-EMP-02, UI-EMP-03, UI-EMP-04)
  listEmployerJobs(statusFilter?: JobStatus | 'all'): Promise<EmployerJobCardItem[]>;
  getEmployerJobDetail(jobId: string): Promise<EmployerJobDetailView>;
  create_job(input: CreateJobInput): Promise<string>;
  update_job(input: UpdateJobInput): Promise<void>;
  cancel_job(jobId: string): Promise<void>;
  uploadJobPhoto(
    jobId: string,
    file: { file_name: string; mime_type: 'image/jpeg' | 'image/png'; size_bytes: number },
  ): Promise<Attachment>;
  deleteJobPhoto(attachmentId: string): Promise<void>;

  // 3. Postulantes y Selección (UI-EMP-04, UI-EMP-05, UI-EMP-06)
  get_applicants(jobId: string): Promise<ApplicantSummary[]>;
  getApplicantPublicProfile(jobId: string, applicationId: string): Promise<ApplicantPublicProfile>;
  select_worker(applicationId: string): Promise<void>;
  reject_application(applicationId: string): Promise<void>;
  confirm_conditions(jobId: string): Promise<void>;
  get_counterpart_contact(jobId: string): Promise<CounterpartContact>;
  simulateWorkerArrival(jobId: string): Promise<void>; // Interactive demo helper to test arrival -> checkout transition

  // 4. Pago Escrow (UI-EMP-07, UI-EMP-12)
  getPaymentBreakdown(jobId: string): Promise<PaymentBreakdown>;
  createPaymentIntentMock(
    jobId: string,
    options?: {
      simulateDecline?: boolean;
      idempotencyKey?: string;
    },
  ): Promise<Payment>;
  listEmployerPaymentHistory(): Promise<EmployerPaymentHistoryItem[]>;

  // 5. Ejecución, Chat y Cierre (UI-EMP-08, UI-EMP-09)
  listChatMessages(jobId: string): Promise<ChatMessage[]>;
  sendChatMessage(jobId: string, body: string): Promise<ChatMessage>;
  reportChatMessage(messageId: string, reason: string): Promise<string>;
  getJobCompletionCode(jobId: string): Promise<JobCompletion | null>;
  respond_completion(
    jobId: string,
    decision: 'confirm' | 'dispute',
    disputeReason?: string,
  ): Promise<{ next_status: JobStatus; case_id?: string }>;
  simulateWorkerCompletionRequest(
    jobId: string,
    method: 'with_code' | 'without_code',
  ): Promise<void>;

  // 6. Casos y Evaluaciones (UI-EMP-10, UI-EMP-11, UI-EMP-14)
  open_case(input: OpenCaseInput): Promise<string>;
  listMyCases(statusFilter?: CaseStatus | 'all'): Promise<CaseWithThread[]>;
  getCaseById(caseId: string): Promise<CaseWithThread>;
  sendCaseMessage(caseId: string, body: string): Promise<CaseWithThread>;
  object_case(caseId: string, objectionNotes: string): Promise<CaseWithThread>;
  acceptResolvedCase(caseId: string): Promise<CaseWithThread>;
  submit_review(input: SubmitReviewInput): Promise<Review>;

  // 7. Notificaciones (UI-EMP-NOTIF)
  listNotifications(): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(): Promise<void>;
  getDeviceToken(): Promise<DeviceToken | null>;
  togglePushNotifications(enabled: boolean): Promise<DeviceToken | null>;
}
