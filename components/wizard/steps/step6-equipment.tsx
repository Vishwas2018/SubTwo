'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type WizardFormData } from '../wizard-types';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

export function Step6Equipment({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Equipment</h2>
        <p className="mt-1 text-sm text-slate-500">
          All optional — helps the AI personalise session notes.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shoes">Running shoes</Label>
          <Input
            id="shoes"
            type="text"
            placeholder="e.g. Nike Vaporfly Next% 2"
            maxLength={100}
            value={data.shoes}
            onChange={(e) => onChange({ shoes: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuel">Preferred fuel / gels</Label>
          <Input
            id="fuel"
            type="text"
            placeholder="e.g. Maurten 100, SIS gels"
            maxLength={100}
            value={data.fuel}
            onChange={(e) => onChange({ fuel: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_kg">Body weight (kg)</Label>
          <Input
            id="weight_kg"
            type="number"
            min="30"
            max="200"
            step="0.1"
            placeholder="e.g. 68"
            value={data.weight_kg}
            onChange={(e) => onChange({ weight_kg: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// Equipment step is always valid (all fields optional)
export function validateStep6(): boolean {
  return true;
}
