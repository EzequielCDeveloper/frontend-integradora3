/**
 * Centralized In-Memory Store + MockEmployerRepository
 * Implements IEmployerRepository with full state machine rules, RLS checks, and reactive pub-sub.
 */
import { useSyncExternalStore } from 'react';
import type {
  CreateJobInput,
  EmployerAuthSession,
  IEmployerRepository,
  OpenCaseInput,
  SubmitReviewInput,
  UpdateJobInput,
} from '@/services/contracts/employer-repository.contract';
import {
  createInitialMockBackendSeed,
  type MockBackendDatabaseSeed,
} from './mock-backend.seed';
import type {
  ApplicantPublicProfile,
  ApplicantSummary,
  Attachment,
  CaseStatus,
  CaseWithThread,
  ChatMessage,
  CounterpartContact,
  DeviceToken,
  EmployerJobCardItem,
  EmployerJobDetailView,
  EmployerPaymentHistoryItem,
  JobCompletion,
  JobStatus,
  Notification,
  Payment,
  PaymentBreakdown,
  Profile,
  Review,
  TermsAcceptance,
} from '@/types/database';
import { DomainError, type DomainErrorCode } from '@/shared/utils/error-mapper';
import {
  calculatePlatformFeeMXN,
  calculateTotalChargedMXN,
  formatFolio,
} from '@/shared/utils/formatters';
import {
  validateAttachmentCandidate,
  validateBirthDateAdult,
  validateCaseMessageBody,
  validateChatMessageBody,
  validateEmail,
  validateFullName,
  validateJobForm,
  validateOpenCaseForm,
  validatePassword,
  validatePhone,
  validateReviewInput,
} from '@/shared/utils/validators';

export interface MockStoreState {
  db: MockBackendDatabaseSeed;
  activeEmployerId: string | null;
  pendingVerificationEmail: string | null;
  simulatedLatencyMs: number;
  nextSimulatedError: DomainErrorCode | null;
  processedIdempotencyKeys: Set<string>;
  version: number;
}

type Listener = () => void;

class MockBackendStoreManager {
  private state: MockStoreState;
  private listeners = new Set<Listener>();

  constructor() {
    const seed = createInitialMockBackendSeed();
    this.state = {
      db: seed,
      activeEmployerId: seed.currentEmployerId,
      pendingVerificationEmail: null,
      simulatedLatencyMs: 280,
      nextSimulatedError: null,
      processedIdempotencyKeys: new Set<string>(),
      version: 1,
    };
  }

  public getState = (): MockStoreState => this.state;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public notify(): void {
    this.state = {
      ...this.state,
      version: this.state.version + 1,
    };
    this.listeners.forEach((l) => l());
  }

  public resetStore(options?: { authenticated?: boolean; latencyMs?: number }): void {
    const seed = createInitialMockBackendSeed();
    this.state = {
      db: seed,
      activeEmployerId:
        options?.authenticated === false ? null : seed.currentEmployerId,
      pendingVerificationEmail: null,
      simulatedLatencyMs: options?.latencyMs ?? 280,
      nextSimulatedError: null,
      processedIdempotencyKeys: new Set<string>(),
      version: this.state.version + 1,
    };
    this.listeners.forEach((l) => l());
  }

  public setNextSimulatedError(code: DomainErrorCode | null): void {
    this.state = {
      ...this.state,
      nextSimulatedError: code,
    };
    this.listeners.forEach((l) => l());
  }

  public setSimulatedLatency(ms: number): void {
    this.state = {
      ...this.state,
      simulatedLatencyMs: Math.max(0, ms),
    };
  }

  public async waitAndCheckChaos(): Promise<void> {
    if (this.state.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.state.simulatedLatencyMs));
    }
    if (this.state.nextSimulatedError) {
      const code = this.state.nextSimulatedError;
      this.state.nextSimulatedError = null;
      this.notify();
      throw new DomainError(code);
    }
  }
}

export const mockStoreManager = new MockBackendStoreManager();

export function useMockBackendStore<T>(selector: (state: MockStoreState) => T): T {
  return useSyncExternalStore(
    mockStoreManager.subscribe,
    () => selector(mockStoreManager.getState()),
    () => selector(mockStoreManager.getState()),
  );
}

function generate6DigitCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export class MockEmployerRepository implements IEmployerRepository {
  private requireAuthProfile(): Profile {
    const { activeEmployerId, db } = mockStoreManager.getState();
    if (!activeEmployerId) {
      throw new DomainError('ERR_NOT_AUTHENTICATED');
    }
    const profile = db.profiles.find((p) => p.id === activeEmployerId);
    if (!profile) {
      throw new DomainError('ERR_NO_PROFILE');
    }
    if (profile.role !== 'employer') {
      throw new DomainError('ERR_FORBIDDEN');
    }
    return profile;
  }

  private requireCanWrite(): Profile {
    const profile = this.requireAuthProfile();
    const isSuspended =
      profile.account_status === 'suspended' &&
      (!profile.suspended_until ||
        new Date(profile.suspended_until).getTime() > Date.now());
    if (
      profile.account_status === 'blocked' ||
      profile.account_status === 'soft_deleted' ||
      isSuspended
    ) {
      throw new DomainError('ERR_ACCOUNT_RESTRICTED');
    }
    return profile;
  }

  private buildJobCardItem(jobId: string): EmployerJobCardItem {
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) throw new DomainError('ERR_NOT_FOUND');

    const apps = db.jobApplications.filter((a) => a.job_id === job.id);
    const pendingApps = apps.filter((a) => a.status === 'pending');

    const selectedWorker = job.selected_worker_id
      ? db.profiles.find((p) => p.id === job.selected_worker_id) ?? null
      : null;

    let selectedWorkerRating: number | null = null;
    if (selectedWorker) {
      const workerReviews = db.reviews.filter(
        (r) => r.reviewee_id === selectedWorker.id && r.moderation_status === 'visible',
      );
      selectedWorkerRating =
        workerReviews.length > 0
          ? Number(
              (
                workerReviews.reduce((acc, r) => acc + r.rating, 0) /
                workerReviews.length
              ).toFixed(1),
            )
          : 4.9;
    }

    const payment = db.payments.find((p) => p.job_id === job.id);
    const fee = payment
      ? payment.platform_fee_mxn
      : calculatePlatformFeeMXN(job.fixed_payment_mxn);
    const total = payment
      ? payment.total_charged_mxn
      : calculateTotalChargedMXN(job.fixed_payment_mxn);

    return {
      ...job,
      applicant_count: apps.length,
      pending_applicant_count: pendingApps.length,
      selected_worker_name: selectedWorker?.full_name ?? null,
      selected_worker_rating: selectedWorkerRating,
      selected_worker_photo: selectedWorker?.photo_path ?? null,
      payment_status: payment?.status ?? 'not_started',
      platform_fee_mxn: fee,
      total_charged_mxn: total,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. AUTH & PERFIL (UI-EMP-01, UI-EMP-13)
  // ---------------------------------------------------------------------------
  public async getCurrentSession(): Promise<EmployerAuthSession | null> {
    await mockStoreManager.waitAndCheckChaos();
    const { activeEmployerId, db } = mockStoreManager.getState();
    if (!activeEmployerId) return null;
    const profile = db.profiles.find((p) => p.id === activeEmployerId) ?? null;
    if (!profile) return null;
    const terms = db.termsAcceptances.filter((t) => t.user_id === activeEmployerId);
    return {
      user_id: activeEmployerId,
      email: profile.email,
      email_verified: true,
      profile,
      terms_accepted: terms,
    };
  }

  public async login(email: string, password: string): Promise<EmployerAuthSession> {
    await mockStoreManager.waitAndCheckChaos();
    const emailErr = validateEmail(email);
    if (emailErr) throw new DomainError('ERR_INVALID_CREDENTIALS', emailErr);
    if (!password || password.length < 6) {
      throw new DomainError('ERR_INVALID_CREDENTIALS');
    }

    const cleanEmail = email.trim().toLowerCase();
    const state = mockStoreManager.getState();
    const cred = state.db.credentials[cleanEmail];
    const profile = state.db.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail,
    );

    if (cred && !cred.email_verified) {
      throw new DomainError('ERR_EMAIL_NOT_VERIFIED');
    }

    if (cred && cred.password !== password) {
      throw new DomainError('ERR_INVALID_CREDENTIALS');
    }

    const targetProfile =
      profile ??
      state.db.profiles.find((p) => p.id === state.db.currentEmployerId)!;

    if (targetProfile.role !== 'employer') {
      throw new DomainError('ERR_FORBIDDEN');
    }

    state.activeEmployerId = targetProfile.id;
    state.pendingVerificationEmail = null;
    mockStoreManager.notify();

    return {
      user_id: targetProfile.id,
      email: targetProfile.email,
      email_verified: true,
      profile: targetProfile,
      terms_accepted: state.db.termsAcceptances.filter(
        (t) => t.user_id === targetProfile.id,
      ),
    };
  }

  public async register(input: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    birth_date: string;
    accept_terms: boolean;
    accept_privacy: boolean;
  }): Promise<{ pending_verification_email: string; verification_code_hint: string }> {
    await mockStoreManager.waitAndCheckChaos();

    if (validateFullName(input.full_name)) throw new DomainError('ERR_INVALID_NAME');
    if (validateEmail(input.email)) throw new DomainError('ERR_INVALID_CREDENTIALS');
    if (validatePhone(input.phone)) throw new DomainError('ERR_INVALID_PHONE');
    if (validateBirthDateAdult(input.birth_date)) throw new DomainError('ERR_UNDERAGE');
    if (validatePassword(input.password)) {
      throw new DomainError(
        'ERR_INVALID_CREDENTIALS',
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
    }
    if (!input.accept_terms || !input.accept_privacy) {
      throw new DomainError(
        'ERR_FORBIDDEN',
        'Debes aceptar los Términos de Uso y el Aviso de Privacidad para continuar.',
      );
    }

    const cleanEmail = input.email.trim().toLowerCase();
    const state = mockStoreManager.getState();
    const existing = state.db.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail,
    );
    if (existing) {
      throw new DomainError('ERR_PROFILE_EXISTS');
    }

    const newId = `emp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newProfile: Profile = {
      id: newId,
      role: 'employer',
      full_name: input.full_name.trim(),
      email: cleanEmail,
      phone: input.phone.trim(),
      birth_date: input.birth_date.trim(),
      photo_path: null,
      skills: null,
      availability: null,
      stripe_account_id: `cus_${Date.now()}`,
      stripe_onboarding_complete: true,
      account_status: 'active',
      suspended_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    state.db.profiles.push(newProfile);
    state.db.credentials[cleanEmail] = {
      password: input.password,
      email_verified: false,
    };
    state.db.termsAcceptances.push(
      {
        id: `trm-${Date.now()}-1`,
        user_id: newId,
        document: 'terms',
        version: 'v1.4',
        accepted_at: nowIso,
      },
      {
        id: `trm-${Date.now()}-2`,
        user_id: newId,
        document: 'privacy',
        version: 'v1.4',
        accepted_at: nowIso,
      },
    );
    state.pendingVerificationEmail = cleanEmail;
    mockStoreManager.notify();

    return {
      pending_verification_email: cleanEmail,
      verification_code_hint: '202611',
    };
  }

  public async verifyEmailCode(email: string, code: string): Promise<EmployerAuthSession> {
    await mockStoreManager.waitAndCheckChaos();
    const cleanEmail = email.trim().toLowerCase();
    if (code.trim().length < 4) {
      throw new DomainError('ERR_INVALID_CREDENTIALS', 'Código de verificación inválido.');
    }
    const state = mockStoreManager.getState();
    if (state.db.credentials[cleanEmail]) {
      state.db.credentials[cleanEmail].email_verified = true;
    }
    const profile =
      state.db.profiles.find((p) => p.email.toLowerCase() === cleanEmail) ??
      state.db.profiles.find((p) => p.id === state.db.currentEmployerId)!;

    state.activeEmployerId = profile.id;
    state.pendingVerificationEmail = null;
    mockStoreManager.notify();

    return {
      user_id: profile.id,
      email: profile.email,
      email_verified: true,
      profile,
      terms_accepted: state.db.termsAcceptances.filter((t) => t.user_id === profile.id),
    };
  }

  public async resetPassword(email: string): Promise<{ message: string }> {
    await mockStoreManager.waitAndCheckChaos();
    const err = validateEmail(email);
    if (err) throw new DomainError('ERR_INVALID_CREDENTIALS', err);
    return {
      message: `Se envió un enlace cifrado de recuperación a ${email.trim().toLowerCase()} (Supabase Auth D-09).`,
    };
  }

  public async complete_profile(input: {
    full_name: string;
    phone: string;
    birth_date: string;
  }): Promise<Profile> {
    await mockStoreManager.waitAndCheckChaos();
    if (validateFullName(input.full_name)) throw new DomainError('ERR_INVALID_NAME');
    if (validatePhone(input.phone)) throw new DomainError('ERR_INVALID_PHONE');
    if (validateBirthDateAdult(input.birth_date)) throw new DomainError('ERR_UNDERAGE');

    const profile = this.requireAuthProfile();
    profile.full_name = input.full_name.trim();
    profile.phone = input.phone.trim();
    profile.birth_date = input.birth_date.trim();
    profile.updated_at = new Date().toISOString();
    mockStoreManager.notify();
    return { ...profile };
  }

  public async accept_terms(
    document: 'terms' | 'privacy',
    version: string,
  ): Promise<TermsAcceptance> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const state = mockStoreManager.getState();
    const existing = state.db.termsAcceptances.find(
      (t) =>
        t.user_id === profile.id &&
        t.document === document &&
        t.version === version,
    );
    if (existing) return existing;

    const entry: TermsAcceptance = {
      id: `trm-${Date.now()}`,
      user_id: profile.id,
      document,
      version,
      accepted_at: new Date().toISOString(),
    };
    state.db.termsAcceptances.push(entry);
    mockStoreManager.notify();
    return entry;
  }

  public async updateEmployerProfile(input: {
    full_name: string;
    phone: string;
    photo_path?: string | null;
  }): Promise<Profile> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    if (validateFullName(input.full_name)) throw new DomainError('ERR_INVALID_NAME');
    if (validatePhone(input.phone)) throw new DomainError('ERR_INVALID_PHONE');

    profile.full_name = input.full_name.trim();
    profile.phone = input.phone.trim();
    if (input.photo_path !== undefined) {
      profile.photo_path = input.photo_path;
    }
    profile.updated_at = new Date().toISOString();
    mockStoreManager.notify();
    return { ...profile };
  }

  public async logout(): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const state = mockStoreManager.getState();
    state.activeEmployerId = null;
    state.pendingVerificationEmail = null;
    mockStoreManager.notify();
  }

  // ---------------------------------------------------------------------------
  // 2. TRABAJOS (UI-EMP-02, UI-EMP-03, UI-EMP-04)
  // ---------------------------------------------------------------------------
  public async listEmployerJobs(
    statusFilter: JobStatus | 'all' = 'all',
  ): Promise<EmployerJobCardItem[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();

    const employerJobs = db.jobs.filter(
      (j) =>
        j.employer_id === profile.id &&
        (statusFilter === 'all' || j.status === statusFilter),
    );

    return employerJobs.map((j) => this.buildJobCardItem(j.id));
  }

  public async getEmployerJobDetail(jobId: string): Promise<EmployerJobDetailView> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const card = this.buildJobCardItem(job.id);
    const priv = db.jobPrivates.find((p) => p.job_id === job.id) ?? {
      job_id: job.id,
      exact_address: job.neighborhood,
      exact_latitude: 29.072967,
      exact_longitude: -110.955919,
    };

    const photos = db.attachments.filter(
      (a) => a.job_id === job.id && a.kind === 'job_photo',
    );
    const completionEvidence = db.attachments.filter(
      (a) => a.job_id === job.id && a.kind === 'completion_evidence',
    );

    const confirmations = db.jobConfirmations.filter(
      (c) => c.job_id === job.id && c.selection_round === job.selection_round,
    );
    const employerConfirmed = confirmations.some((c) => c.user_id === profile.id);
    const workerConfirmed = job.selected_worker_id
      ? confirmations.some((c) => c.user_id === job.selected_worker_id)
      : false;

    const selectedWorker = job.selected_worker_id
      ? db.profiles.find((p) => p.id === job.selected_worker_id)
      : null;

    const employerReviewed = db.reviews.some(
      (r) => r.job_id === job.id && r.reviewer_id === profile.id,
    );

    return {
      ...card,
      private_data: priv,
      photos,
      completion_evidence: completionEvidence,
      employer_confirmed: employerConfirmed,
      worker_confirmed: workerConfirmed,
      worker_stripe_ready: selectedWorker?.stripe_onboarding_complete ?? false,
      employer_reviewed: employerReviewed,
    };
  }

  public async create_job(input: CreateJobInput): Promise<string> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();

    const errors = validateJobForm({
      title: input.title,
      description: input.description,
      category: input.category,
      fixed_payment_mxn: String(input.fixed_payment_mxn),
      job_date: input.job_date,
      start_time: input.start_time,
      end_time: input.end_time,
      conditions: input.conditions,
      neighborhood: input.neighborhood,
      exact_address: input.exact_address,
      exact_latitude: input.exact_latitude,
      exact_longitude: input.exact_longitude,
    });

    if (errors.job_date) throw new DomainError('ERR_DATE_IN_PAST');
    if (errors.neighborhood) throw new DomainError('ERR_NEIGHBORHOOD_REQUIRED');
    if (Object.keys(errors).length > 0) {
      const firstMsg = Object.values(errors)[0];
      throw new DomainError('ERR_INVALID_STATE', firstMsg);
    }

    if (input.photos && input.photos.length > 5) {
      throw new DomainError('ERR_ATTACHMENT_LIMIT');
    }

    const nowIso = new Date().toISOString();
    const jobId = `job-${Math.floor(1000 + Math.random() * 9000)}`;
    const state = mockStoreManager.getState();

    state.db.jobs.unshift({
      id: jobId,
      employer_id: profile.id,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      fixed_payment_mxn: Number(input.fixed_payment_mxn.toFixed(2)),
      job_date: input.job_date.trim(),
      start_time: input.start_time.trim(),
      end_time: input.end_time.trim(),
      start_at: `${input.job_date.trim()}T${input.start_time.trim()}:00-07:00`,
      end_at: `${input.job_date.trim()}T${input.end_time.trim()}:00-07:00`,
      conditions: input.conditions.trim() || null,
      neighborhood: input.neighborhood.trim(),
      status: 'published',
      moderation_status: 'visible',
      selected_worker_id: null,
      selection_round: 0,
      selection_expires_at: null,
      assigned_at: null,
      arrived_at: null,
      completion_method: null,
      completion_requested_at: null,
      completed_at: null,
      closed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    state.db.jobPrivates.push({
      job_id: jobId,
      exact_address: input.exact_address.trim(),
      exact_latitude: input.exact_latitude,
      exact_longitude: input.exact_longitude,
    });

    if (input.photos) {
      input.photos.forEach((photo, idx) => {
        const attErr = validateAttachmentCandidate(photo, 'job_photo', idx);
        if (attErr) throw new DomainError('ERR_INVALID_ATTACHMENT', attErr);
        state.db.attachments.push({
          id: `att-${jobId}-${idx + 1}`,
          owner_id: profile.id,
          kind: 'job_photo',
          job_id: jobId,
          case_id: null,
          storage_path: `storage://jobs/${jobId}/${photo.file_name}`,
          file_name: photo.file_name,
          mime_type: photo.mime_type,
          size_bytes: photo.size_bytes,
          created_at: nowIso,
        });
      });
    }

    mockStoreManager.notify();
    return jobId;
  }

  public async update_job(input: UpdateJobInput): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === input.job_id);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    if (
      (job.status !== 'published' && job.status !== 'has_applications') ||
      job.selected_worker_id !== null
    ) {
      throw new DomainError('ERR_JOB_NOT_EDITABLE');
    }

    const errors = validateJobForm({
      title: input.title,
      description: input.description,
      category: input.category,
      fixed_payment_mxn: String(input.fixed_payment_mxn),
      job_date: input.job_date,
      start_time: input.start_time,
      end_time: input.end_time,
      conditions: input.conditions,
      neighborhood: input.neighborhood,
      exact_address: input.exact_address,
      exact_latitude: input.exact_latitude,
      exact_longitude: input.exact_longitude,
    });

    if (errors.job_date) throw new DomainError('ERR_DATE_IN_PAST');
    if (Object.keys(errors).length > 0) {
      throw new DomainError('ERR_INVALID_STATE', Object.values(errors)[0]);
    }

    job.title = input.title.trim();
    job.description = input.description.trim();
    job.category = input.category;
    job.fixed_payment_mxn = Number(input.fixed_payment_mxn.toFixed(2));
    job.job_date = input.job_date.trim();
    job.start_time = input.start_time.trim();
    job.end_time = input.end_time.trim();
    job.start_at = `${input.job_date.trim()}T${input.start_time.trim()}:00-07:00`;
    job.end_at = `${input.job_date.trim()}T${input.end_time.trim()}:00-07:00`;
    job.conditions = input.conditions.trim() || null;
    job.neighborhood = input.neighborhood.trim();
    job.updated_at = new Date().toISOString();

    const priv = state.db.jobPrivates.find((p) => p.job_id === job.id);
    if (priv) {
      priv.exact_address = input.exact_address.trim();
      priv.exact_latitude = input.exact_latitude;
      priv.exact_longitude = input.exact_longitude;
    }

    mockStoreManager.notify();
  }

  public async cancel_job(jobId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    if (
      (job.status !== 'published' && job.status !== 'has_applications') ||
      job.selected_worker_id !== null
    ) {
      throw new DomainError('ERR_USE_CASE_INSTEAD');
    }

    const nowIso = new Date().toISOString();
    state.db.jobApplications.forEach((a) => {
      if (a.job_id === jobId && a.status === 'pending') {
        a.status = 'rejected';
        a.updated_at = nowIso;
      }
    });

    job.status = 'cancelled';
    job.closed_at = nowIso;
    job.updated_at = nowIso;
    mockStoreManager.notify();
  }

  public async uploadJobPhoto(
    jobId: string,
    file: { file_name: string; mime_type: 'image/jpeg' | 'image/png'; size_bytes: number },
  ): Promise<Attachment> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }
    if (job.status !== 'published' && job.status !== 'has_applications') {
      throw new DomainError('ERR_JOB_NOT_EDITABLE');
    }

    const existing = state.db.attachments.filter(
      (a) => a.job_id === jobId && a.kind === 'job_photo',
    );
    if (existing.length >= 5) {
      throw new DomainError('ERR_ATTACHMENT_LIMIT');
    }

    const err = validateAttachmentCandidate(file, 'job_photo', existing.length);
    if (err) {
      throw new DomainError('ERR_INVALID_ATTACHMENT', err);
    }

    const att: Attachment = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      owner_id: profile.id,
      kind: 'job_photo',
      job_id: jobId,
      case_id: null,
      storage_path: `storage://jobs/${jobId}/${file.file_name}`,
      file_name: file.file_name,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      created_at: new Date().toISOString(),
    };
    state.db.attachments.push(att);
    mockStoreManager.notify();
    return att;
  }

  public async deleteJobPhoto(attachmentId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const idx = state.db.attachments.findIndex(
      (a) => a.id === attachmentId && a.owner_id === profile.id,
    );
    if (idx !== -1) {
      state.db.attachments.splice(idx, 1);
      mockStoreManager.notify();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. POSTULANTES Y SELECCIÓN (UI-EMP-04, UI-EMP-05, UI-EMP-06)
  // ---------------------------------------------------------------------------
  public async get_applicants(jobId: string): Promise<ApplicantSummary[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const apps = db.jobApplications.filter((a) => a.job_id === jobId);
    return apps.map((a) => {
      const worker = db.profiles.find((p) => p.id === a.worker_id)!;
      const reviews = db.reviews.filter(
        (r) => r.reviewee_id === worker.id && r.moderation_status === 'visible',
      );
      const rating =
        reviews.length > 0
          ? Number(
              (
                reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
              ).toFixed(1),
            )
          : 4.9;
      // Privacy guard (RF-12): Strictly omit worker.phone and worker_location!
      return {
        application_id: a.id,
        worker_id: worker.id,
        status: a.status,
        applied_at: a.created_at,
        full_name: worker.full_name,
        photo_path: worker.photo_path,
        skills: worker.skills,
        availability: worker.availability,
        rating,
        review_count: Math.max(reviews.length, 1),
        stripe_onboarding_complete: worker.stripe_onboarding_complete,
      };
    });
  }

  public async getApplicantPublicProfile(
    jobId: string,
    applicationId: string,
  ): Promise<ApplicantPublicProfile> {
    const summaries = await this.get_applicants(jobId);
    const summary = summaries.find((s) => s.application_id === applicationId);
    if (!summary) {
      throw new DomainError('ERR_NOT_FOUND');
    }
    const { db } = mockStoreManager.getState();
    const workerReviews = db.reviews
      .filter(
        (r) =>
          r.reviewee_id === summary.worker_id && r.moderation_status === 'visible',
      )
      .map((r) => {
        const revJob = db.jobs.find((j) => j.id === r.job_id);
        const reviewer = db.profiles.find((p) => p.id === r.reviewer_id);
        return {
          id: r.id,
          job_id: r.job_id,
          job_title: revJob?.title ?? 'Servicio temporal verificado',
          reviewer_name: reviewer?.full_name ?? 'Empleador Verificado',
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
        };
      });

    return {
      ...summary,
      reviews: workerReviews,
    };
  }

  public async select_worker(applicationId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const app = state.db.jobApplications.find((a) => a.id === applicationId);
    if (!app) throw new DomainError('ERR_NOT_FOUND');

    const job = state.db.jobs.find((j) => j.id === app.job_id);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    if (
      (job.status !== 'published' && job.status !== 'has_applications') ||
      job.selected_worker_id !== null
    ) {
      throw new DomainError('ERR_JOB_NOT_SELECTABLE');
    }

    if (app.status !== 'pending') {
      throw new DomainError('ERR_NOT_PENDING');
    }

    if (new Date(job.start_at).getTime() <= Date.now()) {
      throw new DomainError('ERR_DATE_IN_PAST');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);

    app.status = 'accepted';
    app.updated_at = now.toISOString();

    job.status = 'assigned';
    job.selected_worker_id = app.worker_id;
    job.selection_round = job.selection_round + 1;
    job.assigned_at = now.toISOString();
    job.selection_expires_at = expiresAt.toISOString();
    job.updated_at = now.toISOString();

    // In mock simulation, the selected worker automatically confirms conditions for the round
    // so the employer can test the full lifecycle smoothly.
    state.db.jobConfirmations.push({
      id: `cnf-${Date.now()}-wrk`,
      job_id: job.id,
      user_id: app.worker_id,
      selection_round: job.selection_round,
      confirmed_at: now.toISOString(),
    });

    mockStoreManager.notify();
  }

  public async reject_application(applicationId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const app = state.db.jobApplications.find((a) => a.id === applicationId);
    if (!app) throw new DomainError('ERR_NOT_FOUND');

    const job = state.db.jobs.find((j) => j.id === app.job_id);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    if (app.status !== 'pending') {
      throw new DomainError('ERR_NOT_PENDING');
    }

    app.status = 'rejected';
    app.updated_at = new Date().toISOString();

    const remainingPending = state.db.jobApplications.some(
      (a) => a.job_id === job.id && a.status === 'pending',
    );
    if (!remainingPending && job.status === 'has_applications') {
      job.status = 'published';
      job.updated_at = new Date().toISOString();
    }

    mockStoreManager.notify();
  }

  public async confirm_conditions(jobId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }
    if (job.status !== 'assigned') {
      throw new DomainError('ERR_INVALID_STATE');
    }

    if (
      job.selection_expires_at &&
      new Date(job.selection_expires_at).getTime() <= Date.now()
    ) {
      // Expire selection back to has_applications per SQL app.expire_selection()
      state.db.jobApplications.forEach((a) => {
        if (a.job_id === job.id && a.status === 'accepted') {
          a.status = 'expired';
        }
      });
      job.status = 'has_applications';
      job.selected_worker_id = null;
      job.selection_expires_at = null;
      job.assigned_at = null;
      mockStoreManager.notify();
      throw new DomainError('ERR_SELECTION_EXPIRED');
    }

    const exists = state.db.jobConfirmations.some(
      (c) =>
        c.job_id === job.id &&
        c.user_id === profile.id &&
        c.selection_round === job.selection_round,
    );
    if (!exists) {
      state.db.jobConfirmations.push({
        id: `cnf-${Date.now()}-emp`,
        job_id: job.id,
        user_id: profile.id,
        selection_round: job.selection_round,
        confirmed_at: new Date().toISOString(),
      });
      job.updated_at = new Date().toISOString();
      mockStoreManager.notify();
    }
  }

  public async get_counterpart_contact(jobId: string): Promise<CounterpartContact> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const allowedStates: JobStatus[] = [
      'assigned',
      'arrival_registered',
      'in_progress',
      'completion_requested',
      'in_claim',
      'completed',
    ];
    if (!job.selected_worker_id || !allowedStates.includes(job.status)) {
      throw new DomainError('ERR_NOT_AVAILABLE');
    }

    const worker = db.profiles.find((p) => p.id === job.selected_worker_id);
    if (!worker) throw new DomainError('ERR_NOT_FOUND');

    return {
      full_name: worker.full_name,
      phone: worker.phone,
    };
  }

  public async simulateWorkerArrival(jobId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id || !job.selected_worker_id) {
      throw new DomainError('ERR_FORBIDDEN');
    }
    if (job.status !== 'assigned') {
      throw new DomainError('ERR_INVALID_STATE');
    }

    const confirmations = state.db.jobConfirmations.filter(
      (c) => c.job_id === job.id && c.selection_round === job.selection_round,
    );
    if (confirmations.length < 2) {
      throw new DomainError('ERR_CONDITIONS_NOT_ACCEPTED');
    }

    const nowIso = new Date().toISOString();
    job.status = 'arrival_registered';
    job.arrived_at = nowIso;
    job.updated_at = nowIso;

    const existingPay = state.db.payments.find((p) => p.job_id === job.id);
    if (!existingPay) {
      state.db.payments.push({
        id: `pay-${Date.now()}`,
        job_id: job.id,
        employer_id: profile.id,
        worker_id: job.selected_worker_id,
        job_amount_mxn: job.fixed_payment_mxn,
        platform_fee_mxn: calculatePlatformFeeMXN(job.fixed_payment_mxn),
        total_charged_mxn: calculateTotalChargedMXN(job.fixed_payment_mxn),
        stripe_payment_intent_id: null,
        status: 'payment_pending',
        payment_attempts: 0,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    mockStoreManager.notify();
  }

  // ---------------------------------------------------------------------------
  // 4. PAGO ESCROW (UI-EMP-07, UI-EMP-12)
  // ---------------------------------------------------------------------------
  public async getPaymentBreakdown(jobId: string): Promise<PaymentBreakdown> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const payment = db.payments.find((p) => p.job_id === jobId) ?? null;
    const jobAmount = payment ? payment.job_amount_mxn : job.fixed_payment_mxn;
    const fee = calculatePlatformFeeMXN(jobAmount);
    const total = calculateTotalChargedMXN(jobAmount);

    const arrivedAt = job.arrived_at;
    const expiresAt = arrivedAt
      ? new Date(new Date(arrivedAt).getTime() + 30 * 60 * 1000).toISOString()
      : null;

    return {
      job_id: job.id,
      payment_id: payment?.id ?? null,
      job_amount_mxn: jobAmount,
      platform_fee_mxn: fee,
      total_charged_mxn: total,
      status: payment?.status ?? 'payment_pending',
      payment_attempts: payment?.payment_attempts ?? 0,
      arrived_at: arrivedAt,
      expires_at: expiresAt,
    };
  }

  public async createPaymentIntentMock(
    jobId: string,
    options?: {
      simulateDecline?: boolean;
      idempotencyKey?: string;
    },
  ): Promise<Payment> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();

    if (
      options?.idempotencyKey &&
      state.processedIdempotencyKeys.has(options.idempotencyKey)
    ) {
      const existing = state.db.payments.find((p) => p.job_id === jobId);
      if (existing) return existing;
    }

    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    let payment = state.db.payments.find((p) => p.job_id === jobId);
    if (!payment) {
      const nowIso = new Date().toISOString();
      payment = {
        id: `pay-${Date.now()}`,
        job_id: job.id,
        employer_id: profile.id,
        worker_id: job.selected_worker_id ?? 'wrk-unknown',
        job_amount_mxn: job.fixed_payment_mxn,
        platform_fee_mxn: calculatePlatformFeeMXN(job.fixed_payment_mxn),
        total_charged_mxn: calculateTotalChargedMXN(job.fixed_payment_mxn),
        stripe_payment_intent_id: null,
        status: 'payment_pending',
        payment_attempts: 0,
        created_at: nowIso,
        updated_at: nowIso,
      };
      state.db.payments.push(payment);
    }

    if (payment.status === 'confirmed' || payment.status === 'transfer_pending') {
      return payment;
    }

    // Check 30 min window from arrived_at
    if (job.arrived_at) {
      const deadline = new Date(job.arrived_at).getTime() + 30 * 60 * 1000;
      if (Date.now() > deadline) {
        payment.status = 'cancelled';
        job.status = 'cancelled';
        job.closed_at = new Date().toISOString();
        mockStoreManager.notify();
        throw new DomainError('ERR_PAYMENT_WINDOW_EXPIRED');
      }
    }

    if (options?.simulateDecline) {
      payment.payment_attempts += 1;
      payment.status = 'failed';
      payment.updated_at = new Date().toISOString();

      if (payment.payment_attempts >= 3) {
        payment.status = 'cancelled';
        job.status = 'cancelled';
        job.closed_at = new Date().toISOString();
        mockStoreManager.notify();
        throw new DomainError('ERR_PAYMENT_ATTEMPTS_EXCEEDED');
      }
      mockStoreManager.notify();
      throw new DomainError('ERR_PAYMENT_DECLINED');
    }

    if (options?.idempotencyKey) {
      state.processedIdempotencyKeys.add(options.idempotencyKey);
    }

    const nowIso = new Date().toISOString();
    payment.payment_attempts += 1;
    payment.status = 'confirmed';
    payment.stripe_payment_intent_id = `pi_3SolidezEscrow_${Date.now()}`;
    payment.updated_at = nowIso;

    job.status = 'in_progress';
    job.completion_method = 'with_code';
    job.updated_at = nowIso;

    // Ensure 6-digit completion code is generated for the employer (UI-EMP-09 Mode A)
    const existingCode = state.db.jobCompletions.find((c) => c.job_id === job.id);
    if (!existingCode) {
      state.db.jobCompletions.push({
        job_id: job.id,
        code: generate6DigitCode(),
        code_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        attempts: 0,
        renewals: 0,
        used_at: null,
      });
    }

    mockStoreManager.notify();
    return { ...payment };
  }

  public async listEmployerPaymentHistory(): Promise<EmployerPaymentHistoryItem[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();

    const employerJobs = db.jobs.filter((j) => j.employer_id === profile.id);
    return employerJobs
      .filter((j) => db.payments.some((p) => p.job_id === j.id))
      .map((j) => {
        const pay = db.payments.find((p) => p.job_id === j.id)!;
        const worker = j.selected_worker_id
          ? db.profiles.find((p) => p.id === j.selected_worker_id) ?? null
          : null;
        const empReview = db.reviews.find(
          (r) => r.job_id === j.id && r.reviewer_id === profile.id,
        );
        const relCase = db.cases.find(
          (c) => c.job_id === j.id && c.case_type === 'claim',
        );

        return {
          job_id: j.id,
          folio: formatFolio(j.id, 'SLZ'),
          title: j.title,
          category: j.category,
          job_date: j.job_date,
          job_status: j.status,
          worker_id: worker?.id ?? null,
          worker_name: worker?.full_name ?? null,
          worker_rating: 4.9,
          job_amount_mxn: pay.job_amount_mxn,
          platform_fee_mxn: pay.platform_fee_mxn,
          total_charged_mxn: pay.total_charged_mxn,
          payment_status: pay.status,
          stripe_payment_intent_id: pay.stripe_payment_intent_id,
          employer_review_rating: empReview?.rating ?? null,
          case_id: relCase?.id ?? null,
          case_decision: relCase?.decision ?? null,
          approved_transfer_amount: relCase?.approved_transfer_amount ?? null,
          approved_refund_amount: relCase?.approved_refund_amount ?? null,
          resolution_notes: relCase?.resolution_notes ?? null,
          updated_at: pay.updated_at,
        };
      });
  }

  // ---------------------------------------------------------------------------
  // 5. EJECUCIÓN, CHAT Y CIERRE (UI-EMP-08, UI-EMP-09)
  // ---------------------------------------------------------------------------
  public async listChatMessages(jobId: string): Promise<ChatMessage[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    // Round/Worker isolation (OWASP A01 / SQL S-1): only messages for current selected_worker_id
    return db.chatMessages
      .filter(
        (m) =>
          m.job_id === jobId &&
          m.worker_id === job.selected_worker_id &&
          m.moderation_status === 'visible',
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
  }

  public async sendChatMessage(jobId: string, body: string): Promise<ChatMessage> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const msgErr = validateChatMessageBody(body);
    if (msgErr) throw new DomainError('ERR_INVALID_STATE', msgErr);

    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id || !job.selected_worker_id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const activeChatStates: JobStatus[] = [
      'assigned',
      'arrival_registered',
      'in_progress',
      'completion_requested',
      'in_claim',
    ];
    if (!activeChatStates.includes(job.status)) {
      throw new DomainError('ERR_INVALID_STATE');
    }

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      job_id: job.id,
      worker_id: job.selected_worker_id,
      sender_id: profile.id,
      body: body.trim(),
      moderation_status: 'visible',
      created_at: new Date().toISOString(),
    };
    state.db.chatMessages.push(msg);
    mockStoreManager.notify();
    return msg;
  }

  public async reportChatMessage(messageId: string, reason: string): Promise<string> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const msg = state.db.chatMessages.find((m) => m.id === messageId);
    if (!msg) throw new DomainError('ERR_NOT_FOUND');

    const nowIso = new Date().toISOString();
    const reportId = `cas-rep-${Date.now()}`;
    state.db.cases.unshift({
      id: reportId,
      case_type: 'report',
      status: 'pending',
      source: 'user',
      reporter_id: profile.id,
      job_id: msg.job_id,
      reported_user_id: msg.sender_id,
      target_type: 'chat_message',
      target_id: msg.id,
      ticket_category: null,
      description: reason.trim() || 'Reporte de mensaje inapropiado en chat.',
      decision: null,
      approved_transfer_amount: null,
      approved_refund_amount: null,
      resolution_notes: null,
      assigned_admin_id: null,
      resolved_at: null,
      closed_at: null,
      auto_close_deadline: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
    mockStoreManager.notify();
    return reportId;
  }

  public async getJobCompletionCode(jobId: string): Promise<JobCompletion | null> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    let comp = state.db.jobCompletions.find((c) => c.job_id === jobId) ?? null;
    if (
      !comp &&
      (job.status === 'in_progress' || job.status === 'completion_requested')
    ) {
      comp = {
        job_id: job.id,
        code: generate6DigitCode(),
        code_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        attempts: 0,
        renewals: 0,
        used_at: null,
      };
      state.db.jobCompletions.push(comp);
      mockStoreManager.notify();
    }
    return comp ? { ...comp } : null;
  }

  public async respond_completion(
    jobId: string,
    decision: 'confirm' | 'dispute',
    disputeReason?: string,
  ): Promise<{ next_status: JobStatus; case_id?: string }> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    if (
      job.status !== 'in_progress' &&
      job.status !== 'completion_requested'
    ) {
      throw new DomainError('ERR_INVALID_TRANSITION');
    }

    const nowIso = new Date().toISOString();
    const payment = state.db.payments.find((p) => p.job_id === job.id);

    if (decision === 'confirm') {
      job.status = 'completed';
      job.completed_at = nowIso;
      job.closed_at = nowIso;
      job.updated_at = nowIso;

      if (payment) {
        payment.status = 'transferred';
        payment.updated_at = nowIso;
      }

      const comp = state.db.jobCompletions.find((c) => c.job_id === job.id);
      if (comp && !comp.used_at) {
        comp.used_at = nowIso;
      }

      mockStoreManager.notify();
      return { next_status: 'completed' };
    }

    // decision === 'dispute' -> transition job to 'in_claim' and open claim case
    job.status = 'in_claim';
    job.updated_at = nowIso;
    if (payment) {
      payment.status = 'in_claim';
      payment.updated_at = nowIso;
    }

    const existingOpenClaim = state.db.cases.find(
      (c) =>
        c.job_id === job.id &&
        c.case_type === 'claim' &&
        c.status !== 'closed',
    );
    if (existingOpenClaim) {
      mockStoreManager.notify();
      return { next_status: 'in_claim', case_id: existingOpenClaim.id };
    }

    const newCaseId = `cas-${Math.floor(1000 + Math.random() * 9000)}`;
    state.db.cases.unshift({
      id: newCaseId,
      case_type: 'claim',
      status: 'open',
      source: 'user',
      reporter_id: profile.id,
      job_id: job.id,
      reported_user_id: job.selected_worker_id,
      target_type: null,
      target_id: null,
      ticket_category: 'job',
      description:
        disputeReason?.trim() ||
        'Impugnación de solicitud de finalización sin código. Solicito arbitraje sobre las evidencias presentadas.',
      decision: null,
      approved_transfer_amount: null,
      approved_refund_amount: null,
      resolution_notes: null,
      assigned_admin_id: null,
      resolved_at: null,
      closed_at: null,
      auto_close_deadline: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    mockStoreManager.notify();
    return { next_status: 'in_claim', case_id: newCaseId };
  }

  public async simulateWorkerCompletionRequest(
    jobId: string,
    method: 'with_code' | 'without_code',
  ): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === jobId);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const nowIso = new Date().toISOString();
    job.status = 'completion_requested';
    job.completion_method = method;
    job.completion_requested_at = nowIso;
    job.updated_at = nowIso;

    if (method === 'without_code') {
      const existingEv = state.db.attachments.filter(
        (a) => a.job_id === job.id && a.kind === 'completion_evidence',
      );
      if (existingEv.length === 0) {
        state.db.attachments.push({
          id: `att-comp-${Date.now()}`,
          owner_id: job.selected_worker_id ?? profile.id,
          kind: 'completion_evidence',
          job_id: job.id,
          case_id: null,
          storage_path: `storage://completions/${job.id}/evidencia_final.jpg`,
          file_name: 'evidencia_entrega_sitio.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 1_240_000,
          created_at: nowIso,
        });
      }
    }

    mockStoreManager.notify();
  }

  // ---------------------------------------------------------------------------
  // 6. CASOS Y EVALUACIONES (UI-EMP-10, UI-EMP-11, UI-EMP-14)
  // ---------------------------------------------------------------------------
  private buildCaseWithThread(caseId: string): CaseWithThread {
    const { db } = mockStoreManager.getState();
    const c = db.cases.find((item) => item.id === caseId);
    if (!c) throw new DomainError('ERR_NOT_FOUND');

    const job = c.job_id ? db.jobs.find((j) => j.id === c.job_id) ?? null : null;
    const pay = c.job_id
      ? db.payments.find((p) => p.job_id === c.job_id) ?? null
      : null;

    const messages = db.caseMessages
      .filter((m) => m.case_id === c.id && !m.is_internal)
      .map((m) => {
        const author = db.profiles.find((p) => p.id === m.author_id);
        return {
          ...m,
          author_name: author?.full_name ?? 'Mesa Fiduciaria Solidez MX',
          author_role: author?.role ?? 'admin',
        };
      });

    const attachments = db.attachments.filter(
      (a) => a.case_id === c.id && a.kind === 'case_evidence',
    );

    const prefix = c.case_type === 'claim' ? 'CASO' : 'TCK';
    return {
      ...c,
      folio: formatFolio(c.id, prefix),
      job_title: job?.title ?? null,
      job_folio: job ? formatFolio(job.id, 'SLZ') : null,
      total_charged_mxn: pay
        ? pay.total_charged_mxn
        : job
          ? calculateTotalChargedMXN(job.fixed_payment_mxn)
          : null,
      messages,
      attachments,
    };
  }

  public async open_case(input: OpenCaseInput): Promise<string> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const errors = validateOpenCaseForm({
      case_type: input.case_type,
      job_id: input.job_id,
      ticket_category: input.ticket_category,
      description: input.description,
    });
    if (Object.keys(errors).length > 0) {
      throw new DomainError('ERR_INVALID_STATE', Object.values(errors)[0]);
    }

    if (input.evidences && input.evidences.length > 5) {
      throw new DomainError('ERR_ATTACHMENT_LIMIT');
    }

    const state = mockStoreManager.getState();

    // Unique open claim per job constraint (SQL B-2: one_open_claim_per_job)
    if (input.case_type === 'claim' && input.job_id) {
      const existingClaim = state.db.cases.find(
        (c) =>
          c.job_id === input.job_id &&
          c.case_type === 'claim' &&
          c.status !== 'closed',
      );
      if (existingClaim) {
        throw new DomainError('ERR_CLAIM_ALREADY_OPEN');
      }
    }

    const nowIso = new Date().toISOString();
    const caseId = `cas-${Math.floor(1000 + Math.random() * 9000)}`;
    const job = input.job_id
      ? state.db.jobs.find((j) => j.id === input.job_id) ?? null
      : null;

    state.db.cases.unshift({
      id: caseId,
      case_type: input.case_type,
      status: 'open',
      source: 'user',
      reporter_id: profile.id,
      job_id: input.job_id,
      reported_user_id: job?.selected_worker_id ?? null,
      target_type: null,
      target_id: null,
      ticket_category: input.ticket_category ?? 'job',
      description: input.description.trim(),
      decision: null,
      approved_transfer_amount: null,
      approved_refund_amount: null,
      resolution_notes: null,
      assigned_admin_id: null,
      resolved_at: null,
      closed_at: null,
      auto_close_deadline: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    state.db.caseMessages.push({
      id: `cmsg-${caseId}-1`,
      case_id: caseId,
      author_id: profile.id,
      body: input.description.trim(),
      is_internal: false,
      created_at: nowIso,
    });

    if (input.case_type === 'claim' && job) {
      if (
        job.status === 'in_progress' ||
        job.status === 'completion_requested'
      ) {
        job.status = 'in_claim';
        job.updated_at = nowIso;
      }
      const pay = state.db.payments.find((p) => p.job_id === job.id);
      if (pay && pay.status === 'confirmed') {
        pay.status = 'in_claim';
        pay.updated_at = nowIso;
      }
    }

    if (input.evidences) {
      input.evidences.forEach((ev, idx) => {
        const attErr = validateAttachmentCandidate(ev, 'case_evidence', idx);
        if (attErr) throw new DomainError('ERR_INVALID_ATTACHMENT', attErr);
        state.db.attachments.push({
          id: `att-${caseId}-${idx + 1}`,
          owner_id: profile.id,
          kind: 'case_evidence',
          job_id: null,
          case_id: caseId,
          storage_path: `storage://cases/${caseId}/${ev.file_name}`,
          file_name: ev.file_name,
          mime_type: ev.mime_type,
          size_bytes: ev.size_bytes,
          created_at: nowIso,
        });
      });
    }

    mockStoreManager.notify();
    return caseId;
  }

  public async listMyCases(
    statusFilter: CaseStatus | 'all' = 'all',
  ): Promise<CaseWithThread[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();

    const myCases = db.cases.filter((c) => {
      if (c.case_type === 'report') return false;
      const isReporter = c.reporter_id === profile.id;
      const isJobEmployer = c.job_id
        ? db.jobs.some((j) => j.id === c.job_id && j.employer_id === profile.id)
        : false;
      const matchesStatus =
        statusFilter === 'all' || c.status === statusFilter;
      return (isReporter || isJobEmployer) && matchesStatus;
    });

    return myCases.map((c) => this.buildCaseWithThread(c.id));
  }

  public async getCaseById(caseId: string): Promise<CaseWithThread> {
    await mockStoreManager.waitAndCheckChaos();
    this.requireAuthProfile();
    return this.buildCaseWithThread(caseId);
  }

  public async sendCaseMessage(
    caseId: string,
    body: string,
  ): Promise<CaseWithThread> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const msgErr = validateCaseMessageBody(body);
    if (msgErr) throw new DomainError('ERR_INVALID_STATE', msgErr);

    const state = mockStoreManager.getState();
    const c = state.db.cases.find((item) => item.id === caseId);
    if (!c) throw new DomainError('ERR_NOT_FOUND');
    if (c.status === 'closed') {
      throw new DomainError('ERR_INVALID_TRANSITION');
    }

    const nowIso = new Date().toISOString();
    state.db.caseMessages.push({
      id: `cmsg-${Date.now()}`,
      case_id: c.id,
      author_id: profile.id,
      body: body.trim(),
      is_internal: false,
      created_at: nowIso,
    });
    c.updated_at = nowIso;
    mockStoreManager.notify();
    return this.buildCaseWithThread(c.id);
  }

  public async object_case(
    caseId: string,
    objectionNotes: string,
  ): Promise<CaseWithThread> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const msgErr = validateCaseMessageBody(objectionNotes);
    if (msgErr) throw new DomainError('ERR_INVALID_STATE', msgErr);

    const state = mockStoreManager.getState();
    const c = state.db.cases.find((item) => item.id === caseId);
    if (!c) throw new DomainError('ERR_NOT_FOUND');

    if (c.status !== 'resolved') {
      throw new DomainError('ERR_INVALID_TRANSITION');
    }

    if (
      c.auto_close_deadline &&
      new Date(c.auto_close_deadline).getTime() <= Date.now()
    ) {
      throw new DomainError('ERR_OBJECTION_WINDOW_EXPIRED');
    }

    const nowIso = new Date().toISOString();
    // State transition per SQL state_transitions: ('case_claim', 'resolved', 'in_review')
    c.status = 'in_review';
    c.updated_at = nowIso;

    state.db.caseMessages.push({
      id: `cmsg-obj-${Date.now()}`,
      case_id: c.id,
      author_id: profile.id,
      body: `[Objeción de Resolución · Plazo 7 días]: ${objectionNotes.trim()}`,
      is_internal: false,
      created_at: nowIso,
    });

    mockStoreManager.notify();
    return this.buildCaseWithThread(c.id);
  }

  public async acceptResolvedCase(caseId: string): Promise<CaseWithThread> {
    await mockStoreManager.waitAndCheckChaos();
    this.requireCanWrite();
    const state = mockStoreManager.getState();
    const c = state.db.cases.find((item) => item.id === caseId);
    if (!c) throw new DomainError('ERR_NOT_FOUND');
    if (c.status !== 'resolved') {
      throw new DomainError('ERR_INVALID_TRANSITION');
    }

    const nowIso = new Date().toISOString();
    c.status = 'closed';
    c.closed_at = nowIso;
    c.updated_at = nowIso;

    if (c.job_id) {
      const job = state.db.jobs.find((j) => j.id === c.job_id);
      const pay = state.db.payments.find((p) => p.job_id === c.job_id);
      if (job) {
        job.status = c.decision === 'refund_full' ? 'cancelled' : 'completed';
        job.closed_at = nowIso;
        job.updated_at = nowIso;
      }
      if (pay) {
        if (c.decision === 'refund_full') pay.status = 'refunded';
        else if (c.decision === 'partial')
          pay.status = 'partial_settlement_completed';
        else pay.status = 'transferred';
        pay.updated_at = nowIso;
      }
    }

    mockStoreManager.notify();
    return this.buildCaseWithThread(c.id);
  }

  public async submit_review(input: SubmitReviewInput): Promise<Review> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireCanWrite();
    const revErr = validateReviewInput(input.rating, input.comment);
    if (revErr) throw new DomainError('ERR_INVALID_STATE', revErr);

    if (profile.id === input.reviewee_id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const state = mockStoreManager.getState();
    const job = state.db.jobs.find((j) => j.id === input.job_id);
    if (!job || job.employer_id !== profile.id) {
      throw new DomainError('ERR_FORBIDDEN');
    }

    const duplicate = state.db.reviews.some(
      (r) => r.job_id === input.job_id && r.reviewer_id === profile.id,
    );
    if (duplicate) {
      throw new DomainError('ERR_ALREADY_REVIEWED');
    }

    const review: Review = {
      id: `rev-${Date.now()}`,
      job_id: input.job_id,
      reviewer_id: profile.id,
      reviewee_id: input.reviewee_id,
      rating: input.rating,
      comment: input.comment.trim(),
      moderation_status: 'visible',
      created_at: new Date().toISOString(),
    };
    state.db.reviews.unshift(review);
    mockStoreManager.notify();
    return review;
  }

  // ---------------------------------------------------------------------------
  // 7. NOTIFICACIONES (UI-EMP-NOTIF)
  // ---------------------------------------------------------------------------
  public async listNotifications(): Promise<Notification[]> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    return db.notifications
      .filter((n) => n.user_id === profile.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }

  public async markNotificationAsRead(notificationId: string): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const state = mockStoreManager.getState();
    const notif = state.db.notifications.find(
      (n) => n.id === notificationId && n.user_id === profile.id,
    );
    if (notif && !notif.read_at) {
      notif.read_at = new Date().toISOString();
      mockStoreManager.notify();
    }
  }

  public async markAllNotificationsAsRead(): Promise<void> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const state = mockStoreManager.getState();
    const nowIso = new Date().toISOString();
    state.db.notifications.forEach((n) => {
      if (n.user_id === profile.id && !n.read_at) {
        n.read_at = nowIso;
      }
    });
    mockStoreManager.notify();
  }

  public async getDeviceToken(): Promise<DeviceToken | null> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const { db } = mockStoreManager.getState();
    return db.deviceTokens.find((d) => d.user_id === profile.id) ?? null;
  }

  public async togglePushNotifications(enabled: boolean): Promise<DeviceToken | null> {
    await mockStoreManager.waitAndCheckChaos();
    const profile = this.requireAuthProfile();
    const state = mockStoreManager.getState();
    const existingIdx = state.db.deviceTokens.findIndex(
      (d) => d.user_id === profile.id,
    );

    if (!enabled) {
      if (existingIdx !== -1) {
        state.db.deviceTokens.splice(existingIdx, 1);
      }
      mockStoreManager.notify();
      return null;
    }

    if (existingIdx !== -1) {
      return state.db.deviceTokens[existingIdx];
    }

    const token: DeviceToken = {
      id: `dtk-${Date.now()}`,
      user_id: profile.id,
      token: `ExponentPushToken[solidez_emp_${Date.now()}]`,
      platform: 'android',
      created_at: new Date().toISOString(),
    };
    state.db.deviceTokens.push(token);
    mockStoreManager.notify();
    return token;
  }
}

export const employerRepository: IEmployerRepository = new MockEmployerRepository();
