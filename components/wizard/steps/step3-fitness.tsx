'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { type WizardFormData, type CanRun5K } from '../wizard-types';
import { TimeInput } from '../time-input';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

function BeginnerFields({ data, onChange }: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="weekly_km_beginner">Current weekly distance (km)</Label>
        <Input
          id="weekly_km_beginner"
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
        <Label htmlFor="longest_run">Longest recent run (km)</Label>
        <Input
          id="longest_run"
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
          {[
            { value: 'yes', label: 'Yes, comfortably' },
            { value: 'sometimes', label: 'Sometimes, with a few walk breaks' },
            { value: 'no', label: 'Not yet' },
          ].map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={`5k-${opt.value}`} />
              <Label htmlFor={`5k-${opt.value}`} className="font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </>
  );
}

function IntermediateFields({ data, onChange }: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="weekly_km_int">Current weekly distance (km)</Label>
        <Input
          id="weekly_km_int"
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
        <legend className="px-1 text-sm font-medium text-slate-700">
          Most recent race
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="recent_dist">Distance (km)</Label>
            <Input
              id="recent_dist"
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
            <Label htmlFor="recent_date">Date</Label>
            <Input
              id="recent_date"
              type="date"
              value={data.recent_race_date}
              onChange={(e) => onChange({ recent_race_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="recent_time">Finish time (h:mm:ss)</Label>
          <TimeInput
            id="recent_time"
            value={data.recent_race_time}
            onChange={(v) => onChange({ recent_race_time: v })}
            placeholder="e.g. 0:50:30"
          />
        </div>
      </fieldset>
    </>
  );
}

function AdvancedFields({ data, onChange }: Props) {
  return (
    <>
      <IntermediateFields data={data} onChange={onChange} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="peak_km">Peak weekly km</Label>
          <Input
            id="peak_km"
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
        <Label htmlFor="threshold_pace">
          Threshold pace per km (mm:ss){' '}
          <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <TimeInput
          id="threshold_pace"
          value={data.threshold_pace_time}
          onChange={(v) => onChange({ threshold_pace_time: v })}
          placeholder="e.g. 4:30"
          format="mm:ss"
        />
      </div>
    </>
  );
}

export function Step3Fitness({ data, onChange }: Props) {
  const level = data.experience_level;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Current fitness</h2>
        <p className="mt-1 text-sm text-slate-500">
          Honest numbers help us calibrate your plan correctly.
        </p>
      </div>

      {level === 'beginner' && <BeginnerFields data={data} onChange={onChange} />}
      {level === 'intermediate' && <IntermediateFields data={data} onChange={onChange} />}
      {level === 'advanced' && <AdvancedFields data={data} onChange={onChange} />}
    </div>
  );
}

export function validateStep3(data: WizardFormData): boolean {
  const level = data.experience_level;
  const km = parseFloat(data.weekly_km_current);
  if (isNaN(km) || km < 0) return false;

  if (level === 'beginner') {
    const lr = parseFloat(data.longest_recent_run_km);
    return !isNaN(lr) && lr >= 0 &&
      (data.can_run_5k_without_stopping === 'yes' ||
       data.can_run_5k_without_stopping === 'sometimes' ||
       data.can_run_5k_without_stopping === 'no');
  }

  if (level === 'intermediate' || level === 'advanced') {
    const rd = parseFloat(data.recent_race_distance_km);
    const rt = data.recent_race_time.trim();
    if (isNaN(rd) || rd < 1 || !data.recent_race_date || !rt) return false;
    // Basic time format check: contains at least one colon
    if (!rt.includes(':')) return false;

    if (level === 'advanced') {
      const pk = parseFloat(data.peak_weekly_km);
      const yr = parseFloat(data.years_running);
      return !isNaN(pk) && pk >= 0 && !isNaN(yr) && yr >= 0;
    }
    return true;
  }

  return false;
}
