'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type WizardFormData,
  type ExperienceLevel,
  type CanRun5K,
  type LongRunDay,
  LONG_RUN_DAYS,
} from '../wizard-types';
import { TimeInput } from '../time-input';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

// ─── Experience level ─────────────────────────────────────────────────────────

const LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to structured training or running less than 2 years.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with regular training, have completed races.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Consistent high mileage, track workouts, chasing PRs.',
  },
];

// ─── Fitness sub-sections ─────────────────────────────────────────────────────

function BeginnerFitness({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="weekly_km_current">Current weekly distance (km)</Label>
        <Input
          id="weekly_km_current"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="e.g. 20"
          value={data.weekly_km_current}
          onChange={(e) => onChange({ weekly_km_current: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="longest_recent_run_km">Longest recent run (km)</Label>
        <Input
          id="longest_recent_run_km"
          type="number"
          min="0"
          max="50"
          step="0.5"
          placeholder="e.g. 8"
          value={data.longest_recent_run_km}
          onChange={(e) => onChange({ longest_recent_run_km: e.target.value })}
        />
      </div>

      <div className="space-y-3">
        <Label>Can you run 5K without stopping?</Label>
        <RadioGroup
          value={data.can_run_5k_without_stopping}
          onValueChange={(v) => onChange({ can_run_5k_without_stopping: v as CanRun5K })}
          aria-label="Can run 5K without stopping"
        >
          {([
            { value: 'yes', label: 'Yes, comfortably' },
            { value: 'sometimes', label: 'Sometimes, with walk breaks' },
            { value: 'no', label: 'Not yet' },
          ] as const).map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={`5k-${opt.value}`} />
              <Label htmlFor={`5k-${opt.value}`} className="font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

function IntermediateFitness({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="weekly_km_current">Current weekly distance (km)</Label>
        <Input
          id="weekly_km_current"
          type="number"
          min="0"
          max="200"
          step="1"
          placeholder="e.g. 50"
          value={data.weekly_km_current}
          onChange={(e) => onChange({ weekly_km_current: e.target.value })}
        />
      </div>

      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Most recent race</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="recent_race_distance_km">Distance (km)</Label>
            <Input
              id="recent_race_distance_km"
              type="number"
              min="1"
              max="100"
              step="0.1"
              placeholder="e.g. 10"
              value={data.recent_race_distance_km}
              onChange={(e) => onChange({ recent_race_distance_km: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="recent_race_date">Date</Label>
            <Input
              id="recent_race_date"
              type="date"
              value={data.recent_race_date}
              onChange={(e) => onChange({ recent_race_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="recent_race_time">Finish time (h:mm:ss)</Label>
          <TimeInput
            id="recent_race_time"
            value={data.recent_race_time}
            onChange={(v) => onChange({ recent_race_time: v })}
            placeholder="e.g. 0:50:30"
          />
        </div>
      </fieldset>
    </div>
  );
}

function AdvancedFitness({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <IntermediateFitness data={data} onChange={onChange} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="peak_weekly_km">Peak weekly km</Label>
          <Input
            id="peak_weekly_km"
            type="number"
            min="0"
            max="300"
            step="1"
            placeholder="e.g. 90"
            value={data.peak_weekly_km}
            onChange={(e) => onChange({ peak_weekly_km: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="years_running">Years running</Label>
          <Input
            id="years_running"
            type="number"
            min="0"
            max="50"
            step="1"
            placeholder="e.g. 5"
            value={data.years_running}
            onChange={(e) => onChange({ years_running: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="threshold_pace_time">
          Threshold pace /km (mm:ss){' '}
          <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <TimeInput
          id="threshold_pace_time"
          value={data.threshold_pace_time}
          onChange={(v) => onChange({ threshold_pace_time: v })}
          placeholder="e.g. 4:30"
          format="mm:ss"
        />
      </div>
    </div>
  );
}

// ─── Training schedule (with smart defaults) ──────────────────────────────────

function TrainingSchedule({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="days_per_week">Training days / week</Label>
          <Select
            value={data.days_per_week}
            onValueChange={(v) => onChange({ days_per_week: v ?? '' })}
          >
            <SelectTrigger id="days_per_week" aria-label="Training days per week">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 7].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="long_run_day">Long run day</Label>
          <Select
            value={data.long_run_day}
            onValueChange={(v) => onChange({ long_run_day: v as LongRunDay })}
          >
            <SelectTrigger id="long_run_day" aria-label="Long run day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LONG_RUN_DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Step2AboutYou({ data, onChange }: Props) {
  const level = data.experience_level;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">About you</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your fitness level and schedule let us build the right plan.
        </p>
      </div>

      {/* Experience level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Experience level</Label>
        <RadioGroup
          value={data.experience_level}
          onValueChange={(val) => onChange({ experience_level: val as ExperienceLevel })}
          aria-label="Experience level"
        >
          {LEVELS.map((l) => (
            <div key={l.value} className="flex items-start space-x-3">
              <RadioGroupItem value={l.value} id={`level-${l.value}`} className="mt-1" />
              <Label htmlFor={`level-${l.value}`} className="flex flex-col cursor-pointer">
                <span className="font-medium text-slate-900">{l.label}</span>
                <span className="text-sm text-slate-500 font-normal">{l.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Fitness (conditional on level) */}
      {level === 'beginner' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Your current fitness</p>
          <BeginnerFitness data={data} onChange={onChange} />
        </div>
      )}
      {level === 'intermediate' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Your current fitness</p>
          <IntermediateFitness data={data} onChange={onChange} />
        </div>
      )}
      {level === 'advanced' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Your current fitness</p>
          <AdvancedFitness data={data} onChange={onChange} />
        </div>
      )}

      {/* Training schedule — always shown with smart defaults */}
      {level && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-700">Training schedule</p>
          <TrainingSchedule data={data} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateStep2AboutYou(data: WizardFormData): boolean {
  const level = data.experience_level;
  if (!level) return false;

  const km = parseFloat(data.weekly_km_current);
  if (isNaN(km) || km < 0) return false;

  if (level === 'beginner') {
    const lr = parseFloat(data.longest_recent_run_km);
    return (
      !isNaN(lr) &&
      lr >= 0 &&
      (data.can_run_5k_without_stopping === 'yes' ||
        data.can_run_5k_without_stopping === 'sometimes' ||
        data.can_run_5k_without_stopping === 'no')
    );
  }

  // intermediate or advanced: require recent race
  const rd = parseFloat(data.recent_race_distance_km);
  const rt = data.recent_race_time.trim();
  if (isNaN(rd) || rd < 1 || !data.recent_race_date || !rt || !rt.includes(':')) return false;

  if (level === 'advanced') {
    const pk = parseFloat(data.peak_weekly_km);
    const yr = parseFloat(data.years_running);
    return !isNaN(pk) && pk >= 0 && !isNaN(yr) && yr >= 0;
  }

  return true;
}
