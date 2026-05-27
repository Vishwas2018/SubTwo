'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type WizardFormData, type LongRunDay, LONG_RUN_DAYS } from '../wizard-types';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

const INJURY_HISTORY_MAX = 500;

export function Step5Constraints({ data, onChange }: Props) {
  const injuryLen = data.injury_history.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Constraints &amp; preferences</h2>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll work around your schedule and keep your history in mind.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="days_per_week">Training days per week</Label>
          <Select
            value={data.days_per_week}
            onValueChange={(v) => onChange({ days_per_week: v ?? '' })}
          >
            <SelectTrigger id="days_per_week" aria-label="Training days per week">
              <SelectValue placeholder="Select days" />
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
            onValueChange={(v) => onChange({ long_run_day: (v ?? '') as LongRunDay })}
          >
            <SelectTrigger id="long_run_day" aria-label="Long run day">
              <SelectValue placeholder="Select day" />
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="injury_history">
            Injury history{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <span
            className={`text-xs ${injuryLen > INJURY_HISTORY_MAX * 0.9 ? 'text-amber-600' : 'text-slate-400'}`}
            aria-live="polite"
          >
            {injuryLen}/{INJURY_HISTORY_MAX}
          </span>
        </div>
        <Textarea
          id="injury_history"
          placeholder="e.g. right calf strain 3 months ago, fully recovered"
          maxLength={INJURY_HISTORY_MAX}
          rows={3}
          value={data.injury_history}
          onChange={(e) => onChange({ injury_history: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          Other notes{' '}
          <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Anything else the AI should know"
          maxLength={500}
          rows={2}
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

export function validateStep5(data: WizardFormData): boolean {
  const days = parseInt(data.days_per_week);
  return !isNaN(days) && days >= 3 && days <= 7 && data.long_run_day !== '';
}
