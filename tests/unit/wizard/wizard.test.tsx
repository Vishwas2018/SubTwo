// RTL + unit tests for the wizard UI and supporting logic.
// Refs: P2-01
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  timeToSeconds,
  secondsToTime,
  isFutureDate,
  INITIAL_FORM_DATA,
  type WizardFormData,
} from '@/components/wizard/wizard-types';
import { validateStep1 } from '@/components/wizard/steps/step1-race-basics';
import { validateStep2 } from '@/components/wizard/steps/step2-experience';
import { validateStep3 } from '@/components/wizard/steps/step3-fitness';
import { validateStep4 } from '@/components/wizard/steps/step4-goal';
import { validateStep5 } from '@/components/wizard/steps/step5-constraints';
import { validateStep6 } from '@/components/wizard/steps/step6-equipment';
import { assembleWizardInput } from '@/components/wizard/assemble-wizard-input';
import { Step1RaceBasics } from '@/components/wizard/steps/step1-race-basics';
import { Step2Experience } from '@/components/wizard/steps/step2-experience';
import { Step3Fitness } from '@/components/wizard/steps/step3-fitness';
import { Step5Constraints } from '@/components/wizard/steps/step5-constraints';

// Mock next/navigation for WizardPage tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// ─── Pure function: timeToSeconds ─────────────────────────────────────────────

describe('timeToSeconds', () => {
  it('converts "1:59:59" to 7199', () => {
    expect(timeToSeconds('1:59:59')).toBe(7199);
  });

  it('converts "0:45:00" to 2700', () => {
    expect(timeToSeconds('0:45:00')).toBe(2700);
  });

  it('converts "4:30" (mm:ss) to 270', () => {
    expect(timeToSeconds('4:30')).toBe(270);
  });

  it('converts "50:30" to 3030', () => {
    expect(timeToSeconds('50:30')).toBe(3030);
  });

  it('returns null for empty string', () => {
    expect(timeToSeconds('')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(timeToSeconds('abc')).toBeNull();
  });

  it('returns null for invalid seconds ≥60', () => {
    expect(timeToSeconds('1:60')).toBeNull();
  });

  it('secondsToTime converts 7199 to "1:59:59"', () => {
    expect(secondsToTime(7199)).toBe('1:59:59');
  });

  it('secondsToTime pads minutes and seconds', () => {
    expect(secondsToTime(3661)).toBe('1:01:01');
  });
});

// ─── Pure function: isFutureDate ──────────────────────────────────────────────

describe('isFutureDate', () => {
  it('returns true for a date well in the future', () => {
    expect(isFutureDate('2027-01-01')).toBe(true);
  });

  it('returns false for a past date', () => {
    expect(isFutureDate('2020-01-01')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isFutureDate('')).toBe(false);
  });
});

// ─── Step validators ──────────────────────────────────────────────────────────

function makeData(patch: Partial<WizardFormData> = {}): WizardFormData {
  return { ...INITIAL_FORM_DATA, ...patch };
}

describe('validateStep1', () => {
  it('valid distance + future date → true', () => {
    expect(validateStep1(makeData({ race_distance_km: '21.1', race_date: '2027-06-01' }))).toBe(true);
  });

  it('past date → false', () => {
    expect(validateStep1(makeData({ race_distance_km: '10', race_date: '2020-01-01' }))).toBe(false);
  });

  it('distance 0 → false', () => {
    expect(validateStep1(makeData({ race_distance_km: '0', race_date: '2027-06-01' }))).toBe(false);
  });

  it('distance > 200 → false', () => {
    expect(validateStep1(makeData({ race_distance_km: '201', race_date: '2027-06-01' }))).toBe(false);
  });

  it('empty distance → false', () => {
    expect(validateStep1(makeData({ race_date: '2027-06-01' }))).toBe(false);
  });
});

describe('validateStep2', () => {
  it('beginner selected → true', () => {
    expect(validateStep2(makeData({ experience_level: 'beginner' }))).toBe(true);
  });

  it('nothing selected → false', () => {
    expect(validateStep2(makeData())).toBe(false);
  });
});

describe('validateStep3 — beginner', () => {
  const base = makeData({
    experience_level: 'beginner',
    weekly_km_current: '20',
    longest_recent_run_km: '8',
    can_run_5k_without_stopping: 'yes',
  });

  it('all beginner fields filled → true', () => {
    expect(validateStep3(base)).toBe(true);
  });

  it('missing can_run_5k → false', () => {
    expect(validateStep3({ ...base, can_run_5k_without_stopping: '' })).toBe(false);
  });
});

describe('validateStep3 — intermediate', () => {
  const base = makeData({
    experience_level: 'intermediate',
    weekly_km_current: '50',
    recent_race_distance_km: '10',
    recent_race_time: '0:50:00',
    recent_race_date: '2025-01-01',
  });

  it('valid intermediate data → true', () => {
    expect(validateStep3(base)).toBe(true);
  });

  it('missing recent race time → false', () => {
    expect(validateStep3({ ...base, recent_race_time: '' })).toBe(false);
  });
});

describe('validateStep3 — advanced', () => {
  const base = makeData({
    experience_level: 'advanced',
    weekly_km_current: '80',
    recent_race_distance_km: '21.1',
    recent_race_time: '1:35:00',
    recent_race_date: '2025-01-01',
    peak_weekly_km: '100',
    years_running: '5',
  });

  it('valid advanced data → true', () => {
    expect(validateStep3(base)).toBe(true);
  });

  it('missing peak_weekly_km → false', () => {
    expect(validateStep3({ ...base, peak_weekly_km: '' })).toBe(false);
  });
});

describe('validateStep4', () => {
  it('ai_suggest → true', () => {
    expect(validateStep4(makeData({ goal_type: 'ai_suggest' }))).toBe(true);
  });

  it('specific with valid time → true', () => {
    expect(validateStep4(makeData({ goal_type: 'specific', goal_time: '1:59:59' }))).toBe(true);
  });

  it('specific with empty time → false', () => {
    expect(validateStep4(makeData({ goal_type: 'specific', goal_time: '' }))).toBe(false);
  });

  it('nothing selected → false', () => {
    expect(validateStep4(makeData())).toBe(false);
  });
});

describe('validateStep5', () => {
  it('valid days + long run day → true', () => {
    expect(validateStep5(makeData({ days_per_week: '5', long_run_day: 'sat' }))).toBe(true);
  });

  it('missing long_run_day → false', () => {
    expect(validateStep5(makeData({ days_per_week: '5' }))).toBe(false);
  });

  it('days < 3 → false', () => {
    expect(validateStep5(makeData({ days_per_week: '2', long_run_day: 'sat' }))).toBe(false);
  });

  it('days > 7 → false', () => {
    expect(validateStep5(makeData({ days_per_week: '8', long_run_day: 'sat' }))).toBe(false);
  });
});

describe('validateStep6', () => {
  it('always returns true (all optional)', () => {
    expect(validateStep6()).toBe(true);
  });
});

// ─── assembleWizardInput ──────────────────────────────────────────────────────

function intermediateFormData(): WizardFormData {
  return makeData({
    race_distance_km: '21.1',
    race_date: '2027-06-01',
    race_name: 'Test Half',
    experience_level: 'intermediate',
    weekly_km_current: '50',
    recent_race_distance_km: '10',
    recent_race_time: '0:50:00',
    recent_race_date: '2025-01-01',
    goal_type: 'specific',
    goal_time: '1:59:59',
    days_per_week: '5',
    long_run_day: 'sat',
  });
}

describe('assembleWizardInput', () => {
  it('assembles valid intermediate WizardInput', () => {
    const result = assembleWizardInput(intermediateFormData());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.experience_level).toBe('intermediate');
    expect(result.data.race_distance_km).toBe(21.1);
  });

  it('converts goal_time to seconds correctly', () => {
    const result = assembleWizardInput(intermediateFormData());
    if (!result.success) return;
    if (result.data.experience_level !== 'intermediate') return;
    expect(result.data.wizard_data.goal_time_seconds).toBe(7199);
  });

  it('converts recent_race_time to seconds', () => {
    const result = assembleWizardInput(intermediateFormData());
    if (!result.success) return;
    if (result.data.experience_level !== 'intermediate') return;
    expect(result.data.wizard_data.recent_race.time_seconds).toBe(3000);
  });

  it('returns error for missing experience_level', () => {
    const result = assembleWizardInput(makeData());
    expect(result.success).toBe(false);
  });

  it('returns error if WizardInputSchema rejects', () => {
    // Past race_date should fail FutureDateSchema
    const result = assembleWizardInput({ ...intermediateFormData(), race_date: '2020-01-01' });
    expect(result.success).toBe(false);
  });

  it('beginner: assembles correctly without recent_race', () => {
    const data = makeData({
      race_distance_km: '5',
      race_date: '2027-06-01',
      experience_level: 'beginner',
      weekly_km_current: '15',
      longest_recent_run_km: '5',
      can_run_5k_without_stopping: 'yes',
      days_per_week: '4',
      long_run_day: 'sun',
    });
    const result = assembleWizardInput(data);
    expect(result.success).toBe(true);
  });
});

// ─── Step1 component — distance bounds + future date ─────────────────────────

describe('Step1RaceBasics component', () => {
  const noop = () => {};

  it('renders distance input and quick-select buttons', () => {
    render(
      <Step1RaceBasics
        data={INITIAL_FORM_DATA}
        onChange={noop}
      />,
    );
    expect(screen.getByLabelText(/race distance/i)).toBeInTheDocument();
    expect(screen.getByText('5K')).toBeInTheDocument();
    expect(screen.getByText('Half')).toBeInTheDocument();
  });

  it('shows error when past date entered', () => {
    render(
      <Step1RaceBasics
        data={{ ...INITIAL_FORM_DATA, race_date: '2020-01-01' }}
        onChange={noop}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/future/i);
  });

  it('shows error when distance out of range', () => {
    render(
      <Step1RaceBasics
        data={{ ...INITIAL_FORM_DATA, race_distance_km: '0' }}
        onChange={noop}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/1 and 200/i);
  });

  it('calls onChange with quick-select value on button click', async () => {
    const onChange = vi.fn();
    render(<Step1RaceBasics data={INITIAL_FORM_DATA} onChange={onChange} />);
    const halfBtn = screen.getByText('Half');
    await userEvent.click(halfBtn);
    expect(onChange).toHaveBeenCalledWith({ race_distance_km: '21.1' });
  });
});

// ─── Step2 → Step3 branching ──────────────────────────────────────────────────

describe('Step2Experience component', () => {
  it('renders all three level options', () => {
    render(<Step2Experience data={INITIAL_FORM_DATA} onChange={() => {}} />);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('calls onChange with selected level', async () => {
    const onChange = vi.fn();
    render(<Step2Experience data={INITIAL_FORM_DATA} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /intermediate/i }));
    expect(onChange).toHaveBeenCalledWith({ experience_level: 'intermediate' });
  });
});

describe('Step3Fitness branching', () => {
  it('beginner branch shows "longest recent run" field', () => {
    render(
      <Step3Fitness
        data={{ ...INITIAL_FORM_DATA, experience_level: 'beginner' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/longest recent run/i)).toBeInTheDocument();
    expect(screen.queryByText(/most recent race/i)).not.toBeInTheDocument();
  });

  it('intermediate branch shows "most recent race" section', () => {
    render(
      <Step3Fitness
        data={{ ...INITIAL_FORM_DATA, experience_level: 'intermediate' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/most recent race/i)).toBeInTheDocument();
    expect(screen.queryByText(/longest recent run/i)).not.toBeInTheDocument();
  });

  it('advanced branch shows peak weekly km field', () => {
    render(
      <Step3Fitness
        data={{ ...INITIAL_FORM_DATA, experience_level: 'advanced' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/peak weekly km/i)).toBeInTheDocument();
  });
});

// ─── Step5 injury_history character counter ───────────────────────────────────

describe('Step5Constraints character counter', () => {
  it('shows 0/500 counter initially', () => {
    render(<Step5Constraints data={INITIAL_FORM_DATA} onChange={() => {}} />);
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('updates counter as user types', async () => {
    let data = { ...INITIAL_FORM_DATA };
    const onChange = (patch: Partial<WizardFormData>) => {
      data = { ...data, ...patch };
    };

    const { rerender } = render(<Step5Constraints data={data} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/right calf/i);

    await userEvent.type(textarea, 'knee pain');
    data = { ...data, injury_history: 'knee pain' };
    rerender(<Step5Constraints data={data} onChange={onChange} />);

    expect(screen.getByText('9/500')).toBeInTheDocument();
  });

  it('enforces 500 character maximum', () => {
    const longText = 'x'.repeat(500);
    render(
      <Step5Constraints
        data={{ ...INITIAL_FORM_DATA, injury_history: longText }}
        onChange={() => {}}
      />,
    );
    const textarea = screen.getByPlaceholderText(/right calf/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });
});
