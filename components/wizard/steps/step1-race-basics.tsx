'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type WizardFormData, QUICK_DISTANCES, isFutureDate } from '../wizard-types';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

export function Step1RaceBasics({ data, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Tell us about your race</h2>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll build a plan that gets you to the start line ready to run.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="race_distance_km">Race distance (km)</Label>
        <div className="flex gap-2">
          {QUICK_DISTANCES.map((d) => (
            <Button
              key={d.value}
              type="button"
              variant={data.race_distance_km === d.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ race_distance_km: d.value })}
              className={
                data.race_distance_km === d.value
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'
                  : ''
              }
            >
              {d.label}
            </Button>
          ))}
        </div>
        <Input
          id="race_distance_km"
          type="number"
          min="1"
          max="200"
          step="0.1"
          placeholder="or enter distance"
          value={data.race_distance_km}
          onChange={(e) => onChange({ race_distance_km: e.target.value })}
          aria-label="Race distance in kilometres"
        />
        {data.race_distance_km && (
          (() => {
            const val = parseFloat(data.race_distance_km);
            if (isNaN(val) || val < 1 || val > 200) {
              return (
                <p className="text-xs text-red-600" role="alert">
                  Distance must be between 1 and 200 km
                </p>
              );
            }
            return null;
          })()
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="race_date">Race date</Label>
        <Input
          id="race_date"
          type="date"
          min={today}
          value={data.race_date}
          onChange={(e) => onChange({ race_date: e.target.value })}
          aria-label="Race date"
        />
        {data.race_date && !isFutureDate(data.race_date) && (
          <p className="text-xs text-red-600" role="alert">
            Race date must be in the future
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="race_name">
          Race name <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="race_name"
          type="text"
          placeholder="e.g. Melbourne Marathon"
          maxLength={200}
          value={data.race_name}
          onChange={(e) => onChange({ race_name: e.target.value })}
        />
      </div>
    </div>
  );
}

export function validateStep1(data: WizardFormData): boolean {
  const dist = parseFloat(data.race_distance_km);
  return !isNaN(dist) && dist >= 1 && dist <= 200 && isFutureDate(data.race_date);
}
