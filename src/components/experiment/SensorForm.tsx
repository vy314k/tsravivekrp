import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { SensorConfig, FIELD_TOOLTIPS } from '@/types/experiment';

interface SensorFormProps {
  sensor: SensorConfig;
  onChange: (sensor: SensorConfig) => void;
}

export function SensorForm({ sensor, onChange }: SensorFormProps) {
  const update = (key: keyof SensorConfig, value: any) => {
    onChange({ ...sensor, [key]: value });
  };

  const updateArrivalModel = (field: string, value: any) => {
    onChange({
      ...sensor,
      arrival_model: { ...sensor.arrival_model, [field]: value },
    });
  };

  const updateHarvestModel = (field: string, value: any) => {
    onChange({
      ...sensor,
      harvest_model: { ...sensor.harvest_model, [field]: value },
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Sensor ID */}
      <div className="space-y-2">
        <Label htmlFor={`${sensor.id}-id`}>Sensor ID</Label>
        <Input
          id={`${sensor.id}-id`}
          value={sensor.id}
          onChange={(e) => update('id', e.target.value)}
        />
      </div>

      {/* Task Arrival */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-arrival`}>J_mean (bits/slot)</Label>
          <FieldTooltip field="J_mean_bits_per_slot" />
        </div>
        <Input
          id={`${sensor.id}-arrival`}
          type="number"
          value={sensor.J_mean_bits_per_slot}
          onChange={(e) => update('J_mean_bits_per_slot', parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Arrival Model Type */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Arrival Model</Label>
          <FieldTooltip field="arrival_model" />
        </div>
        <Select
          value={sensor.arrival_model.type}
          onValueChange={(v) => updateArrivalModel('type', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="poisson">Poisson</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="uniform">Uniform</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Arrival Model Lambda (for Poisson) */}
      {sensor.arrival_model.type === 'poisson' && (
        <div className="space-y-2">
          <Label htmlFor={`${sensor.id}-lambda`}>Lambda (λ)</Label>
          <Input
            id={`${sensor.id}-lambda`}
            type="number"
            step={0.1}
            value={sensor.arrival_model.lambda || 1}
            onChange={(e) => updateArrivalModel('lambda', parseFloat(e.target.value) || 1)}
          />
        </div>
      )}

      {/* Battery */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-battery`}>Battery (J)</Label>
          <FieldTooltip field="battery_J" />
        </div>
        <Input
          id={`${sensor.id}-battery`}
          type="number"
          step={0.01}
          min={0}
          value={sensor.battery_J}
          onChange={(e) => update('battery_J', parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Harvest Mean */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-harvest`}>Harvest Mean (J/slot)</Label>
          <FieldTooltip field="harvest_mean_J_per_slot" />
        </div>
        <Input
          id={`${sensor.id}-harvest`}
          type="number"
          step={0.001}
          min={0}
          value={sensor.harvest_mean_J_per_slot}
          onChange={(e) => update('harvest_mean_J_per_slot', parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Harvest Model Type */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Harvest Model</Label>
          <FieldTooltip field="harvest_model" />
        </div>
        <Select
          value={sensor.harvest_model.type}
          onValueChange={(v) => updateHarvestModel('type', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bernoulli">Bernoulli</SelectItem>
            <SelectItem value="constant">Constant</SelectItem>
            <SelectItem value="gaussian">Gaussian</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Harvest Model P (for Bernoulli) */}
      {sensor.harvest_model.type === 'bernoulli' && (
        <div className="space-y-2">
          <Label htmlFor={`${sensor.id}-harvestP`}>Harvest Probability</Label>
          <Input
            id={`${sensor.id}-harvestP`}
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={sensor.harvest_model.p || 0.1}
            onChange={(e) => updateHarvestModel('p', parseFloat(e.target.value) || 0.1)}
          />
        </div>
      )}

      {/* Max CPU Frequency */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-fmax`}>f_max (Hz)</Label>
          <FieldTooltip field="f_max_Hz" />
        </div>
        <Input
          id={`${sensor.id}-fmax`}
          type="number"
          value={sensor.f_max_Hz}
          onChange={(e) => update('f_max_Hz', parseFloat(e.target.value) || 1e9)}
        />
      </div>

      {/* Delta */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-delta`}>δ (cycles/bit)</Label>
          <FieldTooltip field="delta_cycles_per_bit" />
        </div>
        <Input
          id={`${sensor.id}-delta`}
          type="number"
          min={100}
          max={5000}
          value={sensor.delta_cycles_per_bit}
          onChange={(e) => update('delta_cycles_per_bit', parseInt(e.target.value) || 1000)}
        />
      </div>

      {/* Max TX Power */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-pmax`}>p_max (W)</Label>
          <FieldTooltip field="p_max_W" />
        </div>
        <Input
          id={`${sensor.id}-pmax`}
          type="number"
          step={0.01}
          min={0}
          value={sensor.p_max_W}
          onChange={(e) => update('p_max_W', parseFloat(e.target.value) || 0.05)}
        />
      </div>

      {/* Channel Gain */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-channel`}>Channel Gain</Label>
          <FieldTooltip field="channel_mean_gain" />
        </div>
        <Input
          id={`${sensor.id}-channel`}
          type="number"
          value={sensor.channel_mean_gain}
          onChange={(e) => update('channel_mean_gain', parseFloat(e.target.value) || 1e-6)}
        />
      </div>

      {/* Channel Variance */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-variance`}>Channel Variance</Label>
          <FieldTooltip field="channel_variance" />
        </div>
        <Input
          id={`${sensor.id}-variance`}
          type="number"
          value={sensor.channel_variance}
          onChange={(e) => update('channel_variance', parseFloat(e.target.value) || 1e-12)}
        />
      </div>

      {/* Offload Mode */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Offload Mode</Label>
          <FieldTooltip field="offload_mode" />
        </div>
        <Select
          value={sensor.offload_mode}
          onValueChange={(v) => update('offload_mode', v as 'binary' | 'fractional')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fractional">Fractional (α ∈ [0,1])</SelectItem>
            <SelectItem value="binary">Binary (0 or 1)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Priority Weight */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-priority`}>Priority Weight</Label>
          <FieldTooltip field="priority_weight" />
        </div>
        <Input
          id={`${sensor.id}-priority`}
          type="number"
          step={0.1}
          min={0.1}
          max={10}
          value={sensor.priority_weight}
          onChange={(e) => update('priority_weight', parseFloat(e.target.value) || 1)}
        />
      </div>

      {/* Initial Queue */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${sensor.id}-initQueue`}>Initial Queue (bits)</Label>
          <FieldTooltip field="initial_queue_bits" />
        </div>
        <Input
          id={`${sensor.id}-initQueue`}
          type="number"
          min={0}
          value={sensor.initial_queue_bits}
          onChange={(e) => update('initial_queue_bits', parseInt(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function FieldTooltip({ field }: { field: string }) {
  const info = FIELD_TOOLTIPS[field];
  if (!info) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{info.description}</p>
          <p className="text-xs text-muted-foreground">
            Unit: {info.unit} | Range: {info.range}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
