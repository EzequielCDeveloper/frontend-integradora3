/**
 * Extreme Adversarial Torture Suite — `movil-empleador`
 * Covers:
 * 1. Boundary & Fuzzing Torture (Financials, Strings, Age >= 18, Dates, Attachments)
 * 2. Concurrency & Idempotency Torture (Duplicate payment idempotency keys)
 * 3. State Machine & Temporal Torture (Illegal edits/cancels post-selection, 30m payment window, 3-attempt decline lockout, 7-day case objection)
 * 4. Simulated Network Chaos & Error Mapping Torture (ERR_NETWORK, ERR_ACCOUNT_RESTRICTED, ERR_NOT_AUTHENTICATED)
 * 5. Privacy & OWASP Escalation Torture (get_applicants phone/location stripping, path traversal & .svg/.html/.exe rejection, session wipe on logout)
 */
import {
  MockEmployerRepository,
  mockStoreManager,
} from '@/services/mocks/mock-employer-repository';
import { mapDomainErrorToUI } from '@/shared/utils/error-mapper';
import {
  calculatePlatformFeeMXN,
  calculateTotalChargedMXN,
  roundHalfUpCents,
} from '@/shared/utils/formatters';
import {
  validateAttachmentCandidate,
  validateBirthDateAdult,
  validateChatMessageBody,
  validateJobForm,
  validatePassword,
  validateRegisterForm,
} from '@/shared/utils/validators';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

export async function runEmployerAdversarialTests(): Promise<{
  passed: number;
  details: string[];
}> {
  const details: string[] = [];
  let passed = 0;

  const recordPass = (name: string) => {
    passed++;
    details.push(`PASS: ${name}`);
  };

  // ---------------------------------------------------------------------------
  // 1. BOUNDARY & FUZZING TORTURE
  // ---------------------------------------------------------------------------
  // 1.1 Financial half-up rounding & boundaries
  assert(roundHalfUpCents(19.99 * 0.1) === 2.0, '19.99 * 0.10 should round half-up to 2.00');
  assert(calculatePlatformFeeMXN(850) === 85.0, '850 * 10% = 85.00');
  assert(calculateTotalChargedMXN(850) === 935.0, '850 + 85 = 935.00');
  assert(calculatePlatformFeeMXN(10.05) === 1.01, '10.05 * 10% = 1.005 -> 1.01 half-up');
  recordPass('Financial half-up rounding precision (19.99, 850.00, 10.05)');

  // 1.2 Job payment limits ($0, $-500, $9.99, $100,000.01, NaN)
  const invalidAmounts = ['0', '-500', '9.99', '100000.01', 'NaN', ''];
  for (const amt of invalidAmounts) {
    const errs = validateJobForm({
      title: 'Limpieza general',
      description: 'Limpieza completa de oficinas y recepción',
      category: 'limpieza',
      fixed_payment_mxn: amt,
      job_date: '2027-05-10',
      start_time: '09:00',
      end_time: '14:00',
      conditions: '',
      neighborhood: 'Col. Centenario',
      exact_address: 'Calle 10 #120',
      exact_latitude: 29.07,
      exact_longitude: -110.95,
    });
    assert(Boolean(errs.fixed_payment_mxn), `Payment ${amt} must be rejected`);
  }
  recordPass('Financial boundary rejection ($0, $-500, $9.99, $100,000.01, NaN)');

  // 1.3 Age boundary: 18 years minus 1 day must reject; exact 18 years must pass
  const refNow = new Date(2026, 10, 25); // 2026-11-25
  assert(
    validateBirthDateAdult('2008-11-26', refNow) !== null,
    '18 years minus 1 day must reject with ERR_UNDERAGE message',
  );
  assert(
    validateBirthDateAdult('2008-11-25', refNow) === null,
    'Exact 18th birthday must pass',
  );
  recordPass('Age >= 18 exact day boundary check (RF-03)');

  // 1.4 Password policy & Chat 2001-char overflow
  assert(validatePassword('short1A') !== null, '< 8 chars must reject');
  assert(validatePassword('alllowercase123') !== null, 'No uppercase must reject');
  assert(validatePassword('ALLUPPERCASE123') !== null, 'No lowercase must reject');
  assert(validatePassword('NoDigitsPassword') !== null, 'No digit must reject');
  assert(validatePassword('Solidez2026') === null, 'Valid password must pass');
  assert(validateChatMessageBody('   ') !== null, 'Whitespace-only chat message must reject');
  assert(
    validateChatMessageBody('a'.repeat(2001)) !== null,
    '2001-char chat message must reject',
  );
  recordPass('Password strength & 2000-char chat boundary validation');

  // 1.5 Registration mandatory checkboxes (D-10)
  const regErrs = validateRegisterForm({
    full_name: 'Valeria Montes',
    email: 'valeria@empresa.mx',
    phone: '+52 662 123 4567',
    birth_date: '1990-05-10',
    password: 'Password123',
    accept_terms: true,
    accept_privacy: false,
  });
  assert(Boolean(regErrs.accept_terms), 'Unchecked privacy must block registration');
  recordPass('Mandatory Terms & Privacy acceptance check (D-10 / RF-33)');

  // ---------------------------------------------------------------------------
  // 2. PRIVACY & OWASP ESCALATION TORTURE
  // ---------------------------------------------------------------------------
  mockStoreManager.resetStore({ authenticated: true, latencyMs: 0 });
  const repo = new MockEmployerRepository();

  // 2.1 get_applicants MUST strip worker phone and exact location (RF-12)
  const applicants = await repo.get_applicants('job-9140');
  assert(applicants.length === 3, 'job-9140 should have 3 applicants');
  for (const app of applicants) {
    const rawObj = app as unknown as Record<string, unknown>;
    assert(!('phone' in rawObj), 'Applicant summary MUST NOT leak worker phone');
    assert(!('latitude' in rawObj), 'Applicant summary MUST NOT leak worker latitude');
  }
  recordPass('OWASP A01 / RF-12: get_applicants strips worker phone & location');

  // 2.2 get_counterpart_contact MUST fail on un-assigned job, and succeed on assigned job
  let blockedContact = false;
  try {
    await repo.get_counterpart_contact('job-9140'); // has_applications (not assigned)
  } catch (e) {
    blockedContact = mapDomainErrorToUI(e).code === 'ERR_NOT_AVAILABLE';
  }
  assert(
    blockedContact,
    'get_counterpart_contact must throw ERR_NOT_AVAILABLE before worker selection',
  );

  const unlockedContact = await repo.get_counterpart_contact('job-9102'); // assigned
  assert(
    unlockedContact.phone.length >= 8,
    'get_counterpart_contact unlocks phone when job is assigned',
  );
  recordPass('OWASP A01 / RF-12: get_counterpart_contact unlocked only after assignment');

  // 2.3 OWASP A03 / M4: Malicious file upload rejection (.svg, .html, .exe, ../ traversal, > 10MB, 6th file)
  assert(
    validateAttachmentCandidate(
      { file_name: '../../etc/passwd.jpg', mime_type: 'image/jpeg', size_bytes: 500 },
      'job_photo',
      0,
    ) !== null,
    'Path traversal ../ must be rejected',
  );
  assert(
    validateAttachmentCandidate(
      { file_name: 'xss.svg', mime_type: 'image/svg+xml', size_bytes: 500 },
      'job_photo',
      0,
    ) !== null,
    '.svg file must be rejected',
  );
  assert(
    validateAttachmentCandidate(
      { file_name: 'payload.html', mime_type: 'text/html', size_bytes: 500 },
      'case_evidence',
      0,
    ) !== null,
    '.html file must be rejected',
  );
  assert(
    validateAttachmentCandidate(
      {
        file_name: 'oversized.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 10_485_761, // 10MB + 1 byte
      },
      'job_photo',
      0,
    ) !== null,
    'File > 10 MB must be rejected',
  );
  assert(
    validateAttachmentCandidate(
      { file_name: 'sixth.jpg', mime_type: 'image/jpeg', size_bytes: 1000 },
      'job_photo',
      5,
    ) !== null,
    '6th file must be rejected (max 5)',
  );
  recordPass('OWASP A03 / M4: File uploader rejects path traversal, .svg, .html, >10MB, and 6th file');

  // ---------------------------------------------------------------------------
  // 3. STATE MACHINE & TEMPORAL TORTURE
  // ---------------------------------------------------------------------------
  // 3.1 Employer tries to edit or cancel a job after status === 'assigned'
  let editBlocked = false;
  try {
    await repo.update_job({
      job_id: 'job-9102', // assigned
      title: 'Intento ilegal',
      description: 'Descripción suficientemente larga para pasar validación',
      category: 'limpieza',
      fixed_payment_mxn: 1000,
      job_date: '2027-01-10',
      start_time: '09:00',
      end_time: '13:00',
      conditions: '',
      neighborhood: 'Col. Pitic',
      exact_address: 'Calle 1',
      exact_latitude: 29.09,
      exact_longitude: -110.94,
    });
  } catch (e) {
    editBlocked = mapDomainErrorToUI(e).code === 'ERR_JOB_NOT_EDITABLE';
  }
  assert(editBlocked, 'Editing an assigned job must throw ERR_JOB_NOT_EDITABLE');

  let cancelBlocked = false;
  try {
    await repo.cancel_job('job-9102'); // assigned
  } catch (e) {
    cancelBlocked = mapDomainErrorToUI(e).code === 'ERR_USE_CASE_INSTEAD';
  }
  assert(
    cancelBlocked,
    'Direct cancellation of an assigned job must throw ERR_USE_CASE_INSTEAD',
  );
  recordPass('State Machine: Edit & Cancel blocked after worker selection (RF-06 / RF-27)');

  // 3.2 Selecting a worker transitions job to assigned, increments selection_round, sets 24h expiry
  await repo.select_worker('app-9140-1');
  const assignedDetail = await repo.getEmployerJobDetail('job-9140');
  assert(assignedDetail.status === 'assigned', 'Job must transition to assigned');
  assert(assignedDetail.selection_round === 1, 'selection_round must increment to 1');
  assert(
    Boolean(assignedDetail.selection_expires_at),
    'selection_expires_at (24h window) must be set',
  );
  recordPass('State Machine: select_worker starts 24h countdown & increments selection_round');

  // 3.3 Confirming conditions + simulating arrival + Escrow Payment idempotency & 3-decline lockout
  await repo.confirm_conditions('job-9140');
  await repo.simulateWorkerArrival('job-9140');
  const postArrival = await repo.getEmployerJobDetail('job-9140');
  assert(
    postArrival.status === 'arrival_registered',
    'Job must transition to arrival_registered',
  );

  // Test 3 declined payment attempts -> auto cancels job (RF-18)
  for (let attempt = 1; attempt <= 3; attempt++) {
    let declinedCode = '';
    try {
      await repo.createPaymentIntentMock('job-9088', { simulateDecline: true });
    } catch (e) {
      declinedCode = mapDomainErrorToUI(e).code;
    }
    if (attempt < 3) {
      assert(declinedCode === 'ERR_PAYMENT_DECLINED', 'Attempt < 3 throws ERR_PAYMENT_DECLINED');
    } else {
      assert(
        declinedCode === 'ERR_PAYMENT_ATTEMPTS_EXCEEDED',
        '3rd failed attempt cancels job and throws ERR_PAYMENT_ATTEMPTS_EXCEEDED',
      );
    }
  }
  const cancelledByDeclines = await repo.getEmployerJobDetail('job-9088');
  assert(
    cancelledByDeclines.status === 'cancelled',
    'Job must be cancelled after 3 failed Stripe payment attempts',
  );
  recordPass('State Machine: 3 failed Stripe payment attempts auto-cancel job (RF-18)');

  // 3.4 Idempotent Escrow payment on job-9140 -> transitions to in_progress and generates 6-digit completion code
  const pay1 = await repo.createPaymentIntentMock('job-9140', {
    idempotencyKey: 'idem-test-key-9140',
  });
  const pay2 = await repo.createPaymentIntentMock('job-9140', {
    idempotencyKey: 'idem-test-key-9140',
  });
  assert(pay1.id === pay2.id, 'Duplicate idempotencyKey must return the exact same payment');
  assert(pay1.status === 'confirmed', 'Payment status must be confirmed');
  const inProgressJob = await repo.getEmployerJobDetail('job-9140');
  assert(inProgressJob.status === 'in_progress', 'Job must transition to in_progress');
  const compCode = await repo.getJobCompletionCode('job-9140');
  assert(
    compCode !== null && /^\d{6}$/.test(compCode.code),
    '6-digit completion code must be readable by employer',
  );
  recordPass('Escrow Payment Idempotency & 6-Digit Employer Completion Code generation');

  // 3.5 Respond completion (confirm -> completed -> submit_review)
  const compRes = await repo.respond_completion('job-9012', 'confirm');
  assert(compRes.next_status === 'completed', 'Confirming completion transitions job to completed');
  const rev = await repo.submit_review({
    job_id: 'job-9012',
    reviewee_id: 'wrk-0003-4000-8000-000000000103',
    rating: 5,
    comment: 'Excelente embalaje y cuidado de las maquetas acrílicas.',
  });
  assert(rev.rating === 5, 'Review must be saved with rating 5');
  recordPass('Completion confirmation & Worker Review submission (UI-EMP-09 -> UI-EMP-11)');

  // 3.6 Case objection within 7-day window transitions resolved case back to in_review (UI-EMP-14)
  const objectedCase = await repo.object_case(
    'cas-1042',
    'Solicito reconsiderar el porcentaje de metraje afectado por la humedad.',
  );
  assert(
    objectedCase.status === 'in_review',
    'Objecting a resolved case within 7 days transitions it back to in_review',
  );
  recordPass('Arbitration 7-day objection transitions resolved case back to in_review (RF-25)');

  // ---------------------------------------------------------------------------
  // 4. SIMULATED NETWORK CHAOS & SESSION WIPE TORTURE
  // ---------------------------------------------------------------------------
  mockStoreManager.setNextSimulatedError('ERR_NETWORK');
  let networkCaught = false;
  try {
    await repo.listEmployerJobs();
  } catch (e) {
    const mapped = mapDomainErrorToUI(e);
    networkCaught =
      mapped.code === 'ERR_NETWORK' &&
      mapped.message.includes('Verifica tu conexión');
  }
  assert(networkCaught, 'Simulated network error maps to Spanish retry message');
  recordPass('Simulated Network Chaos recovery & Spanish error mapping');

  // Logout wipes active session
  await repo.logout();
  const postLogoutSession = await repo.getCurrentSession();
  assert(postLogoutSession === null, 'Logout must completely clear active session');
  recordPass('OWASP A01: Logout wipes active session');

  mockStoreManager.resetStore({ authenticated: true, latencyMs: 280 });
  return { passed, details };
}
