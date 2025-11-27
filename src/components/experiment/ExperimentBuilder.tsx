import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Settings2, 
  Cpu, 
  Zap, 
  Radio, 
  ChevronDown, 
  Copy, 
  Trash2, 
  Shuffle, 
  Upload,
  Download,
  Info,
  FileText
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { 
  ExperimentConfig, 
  SensorConfig, 
  FIELD_TOOLTIPS, 
  PRESET_EXPERIMENTS 
} from '@/types/experiment';
import { SeededRandom, generateRandomSensor } from '@/lib/algorithms/random';
import { SensorForm } from './SensorForm';
import { SensorSummaryTable } from './SensorSummaryTable';

interface ExperimentBuilderProps {
  onStartExperiment: (config: ExperimentConfig) => void;
  isRunning: boolean;
}

const DEFAULT_CONFIG: Partial<ExperimentConfig> = {
  experiment_name: 'new-experiment',
  seed: 42,
  slots: 200,
  slot_duration_s: 1.0,
  bandwidth_Hz: 1e6,
  V: 10,
  prediction_horizon: 5,
  opt_mode: 'per-slot',
  optimizer: {
    population: 40,
    generations: 6,
    mutation_prob: 0.05,
    random_restarts: 3,
    max_evals: 500,
  },
  global_params: {
    delta_cycles_per_bit: 1000,
    theta: 1e-27,
    noise_power_W: 9e-14,
    tau_s: 1.0,
  },
  edge_servers: [
    { id: 'edge-1', f_k_Hz: 15e9, f_max_Hz: 15e9, num_cores: 8 },
  ],
  cloud: {
    latency_s: 0.02,
    compute_capacity_cycles_per_slot: 1e12,
  },
};

export function ExperimentBuilder({ onStartExperiment, isRunning }: ExperimentBuilderProps) {
  const [numSensors, setNumSensors] = useState<number>(2);
  const [showSensorForms, setShowSensorForms] = useState(false);
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [config, setConfig] = useState<Partial<ExperimentConfig>>(DEFAULT_CONFIG);
  const [randomSeed, setRandomSeed] = useState(42);
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set());

  // Initialize sensors when number is set
  const initializeSensors = useCallback((n: number, seed: number) => {
    const random = new SeededRandom(seed);
    const newSensors: SensorConfig[] = [];
    for (let i = 0; i < n; i++) {
      newSensors.push(generateRandomSensor(`sensor-${i + 1}`, random));
    }
    setSensors(newSensors);
    setSelectedSensors(new Set(newSensors.slice(0, 3).map(s => s.id)));
    setShowSensorForms(true);
  }, []);

  const handleNumSensorsSubmit = () => {
    if (numSensors >= 1 && numSensors <= 20) {
      initializeSensors(numSensors, randomSeed);
    } else {
      toast({
        title: 'Invalid number',
        description: 'Number of sensors must be between 1 and 20',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateRandom = () => {
    initializeSensors(numSensors, randomSeed);
    toast({
      title: 'Sensors generated',
      description: `Generated ${numSensors} random sensors with seed ${randomSeed}`,
    });
  };

  const updateSensor = (index: number, sensor: SensorConfig) => {
    const newSensors = [...sensors];
    newSensors[index] = sensor;
    setSensors(newSensors);
  };

  const duplicateSensor = (index: number) => {
    const source = sensors[index];
    const newSensor: SensorConfig = {
      ...source,
      id: `sensor-${sensors.length + 1}`,
    };
    setSensors([...sensors, newSensor]);
    setNumSensors(sensors.length + 1);
  };

  const removeSensor = (index: number) => {
    if (sensors.length > 1) {
      const newSensors = sensors.filter((_, i) => i !== index);
      setSensors(newSensors);
      setNumSensors(newSensors.length);
    }
  };

  const loadPreset = (presetName: string) => {
    const preset = PRESET_EXPERIMENTS[presetName];
    if (preset) {
      setConfig({ ...DEFAULT_CONFIG, ...preset });
      if (preset.sensors) {
        setSensors(preset.sensors);
        setNumSensors(preset.sensors.length);
        setShowSensorForms(true);
        setSelectedSensors(new Set(preset.sensors.slice(0, 3).map(s => s.id)));
      }
      toast({
        title: 'Preset loaded',
        description: `Loaded "${presetName}" preset configuration`,
      });
    }
  };

  const exportConfig = () => {
    const fullConfig: ExperimentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      sensors,
    } as ExperimentConfig;
    
    const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.experiment_name || 'experiment'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setConfig(imported);
          if (imported.sensors) {
            setSensors(imported.sensors);
            setNumSensors(imported.sensors.length);
            setShowSensorForms(true);
          }
          toast({
            title: 'Configuration imported',
            description: 'Successfully loaded experiment configuration',
          });
        } catch {
          toast({
            title: 'Import failed',
            description: 'Invalid JSON file',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleStartExperiment = () => {
    if (sensors.length === 0) {
      toast({
        title: 'No sensors',
        description: 'Please configure at least one sensor',
        variant: 'destructive',
      });
      return;
    }

    const fullConfig: ExperimentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      sensors,
    } as ExperimentConfig;

    onStartExperiment(fullConfig);
  };

  const toggleSensorSelection = (sensorId: string) => {
    const newSelected = new Set(selectedSensors);
    if (newSelected.has(sensorId)) {
      newSelected.delete(sensorId);
    } else {
      newSelected.add(sensorId);
    }
    setSelectedSensors(newSelected);
  };

  return (
    <div className="space-y-6">
      {/* Header with presets and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Experiment Builder</h2>
          <p className="text-muted-foreground">
            Configure TSRA vs P-TSRA simulation parameters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadPreset('micro-sim-2sensors')}>
            <FileText className="mr-2 h-4 w-4" />
            Load 2-Sensor Preset
          </Button>
          <Button variant="outline" size="sm" onClick={exportConfig}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importConfig}
            />
          </label>
        </div>
      </div>

      {/* Step 1: Number of Sensors */}
      {!showSensorForms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Step 1: Configure Number of Sensors
            </CardTitle>
            <CardDescription>
              Enter the number of IoT sensors for your simulation (1-20)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="numSensors">Number of Sensors (n)</Label>
                <Input
                  id="numSensors"
                  type="number"
                  min={1}
                  max={20}
                  value={numSensors}
                  onChange={(e) => setNumSensors(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 max-w-xs">
                <Label htmlFor="randomSeed">Random Seed</Label>
                <Input
                  id="randomSeed"
                  type="number"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleNumSensorsSubmit}>
                Configure {numSensors} Sensor{numSensors > 1 ? 's' : ''}
              </Button>
              <Button variant="outline" onClick={handleGenerateRandom}>
                <Shuffle className="mr-2 h-4 w-4" />
                Generate Random
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Sensor Configuration */}
      {showSensorForms && (
        <Tabs defaultValue="sensors" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sensors">
              <Cpu className="mr-2 h-4 w-4" />
              Sensors ({sensors.length})
            </TabsTrigger>
            <TabsTrigger value="global">
              <Settings2 className="mr-2 h-4 w-4" />
              Global Parameters
            </TabsTrigger>
            <TabsTrigger value="optimizer">
              <Zap className="mr-2 h-4 w-4" />
              Optimizer
            </TabsTrigger>
          </TabsList>

          {/* Sensors Tab */}
          <TabsContent value="sensors" className="space-y-4">
            {/* Sensor Summary Table */}
            <SensorSummaryTable 
              sensors={sensors}
              selectedSensors={selectedSensors}
              onToggleSelection={toggleSensorSelection}
            />

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateRandom}>
                <Shuffle className="mr-2 h-4 w-4" />
                Regenerate All
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Label htmlFor="changeSeed" className="text-sm">Seed:</Label>
                <Input
                  id="changeSeed"
                  type="number"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(parseInt(e.target.value) || 0)}
                  className="w-24 h-8"
                />
              </div>
            </div>

            {/* Individual Sensor Forms */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {sensors.map((sensor, index) => (
                  <Collapsible key={sensor.id}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                              <CardTitle className="text-base">{sensor.id}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {(sensor.J_mean_bits_per_slot / 1e3).toFixed(0)}kb/slot
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {(sensor.f_max_Hz / 1e9).toFixed(1)} GHz
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => duplicateSensor(index)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeSensor(index)}
                                disabled={sensors.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <SensorForm
                            sensor={sensor}
                            onChange={(updated) => updateSensor(index, updated)}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Global Parameters Tab */}
          <TabsContent value="global" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Simulation Parameters</CardTitle>
                <CardDescription>
                  Configure time slots, channel, and Lyapunov tradeoff
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Experiment Name */}
                  <div className="space-y-2">
                    <Label htmlFor="expName">Experiment Name</Label>
                    <Input
                      id="expName"
                      value={config.experiment_name}
                      onChange={(e) => setConfig({ ...config, experiment_name: e.target.value })}
                    />
                  </div>

                  {/* Seed */}
                  <div className="space-y-2">
                    <Label htmlFor="seed">Random Seed</Label>
                    <Input
                      id="seed"
                      type="number"
                      value={config.seed}
                      onChange={(e) => setConfig({ ...config, seed: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  {/* Number of Slots */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="slots">Number of Slots</Label>
                      <FieldTooltip field="slot_duration_s" />
                    </div>
                    <Input
                      id="slots"
                      type="number"
                      min={10}
                      max={1000}
                      value={config.slots}
                      onChange={(e) => setConfig({ ...config, slots: parseInt(e.target.value) || 100 })}
                    />
                  </div>

                  {/* Slot Duration */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="slotDuration">Slot Duration (τ)</Label>
                      <FieldTooltip field="slot_duration_s" />
                    </div>
                    <Input
                      id="slotDuration"
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={2}
                      value={config.slot_duration_s}
                      onChange={(e) => setConfig({ ...config, slot_duration_s: parseFloat(e.target.value) || 1 })}
                    />
                  </div>

                  {/* Bandwidth */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bandwidth">Bandwidth (Hz)</Label>
                      <FieldTooltip field="bandwidth_Hz" />
                    </div>
                    <Input
                      id="bandwidth"
                      type="number"
                      value={config.bandwidth_Hz}
                      onChange={(e) => setConfig({ ...config, bandwidth_Hz: parseFloat(e.target.value) || 1e6 })}
                    />
                  </div>

                  {/* Prediction Horizon */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="horizon">Prediction Horizon (H)</Label>
                      <FieldTooltip field="prediction_horizon" />
                    </div>
                    <Input
                      id="horizon"
                      type="number"
                      min={0}
                      max={20}
                      value={config.prediction_horizon}
                      onChange={(e) => setConfig({ ...config, prediction_horizon: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* V Parameter Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label>Lyapunov V Parameter</Label>
                      <FieldTooltip field="V" />
                    </div>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      V = {config.V}
                    </span>
                  </div>
                  <Slider
                    value={[Math.log10(config.V || 1)]}
                    min={0}
                    max={3}
                    step={0.1}
                    onValueChange={([v]) => setConfig({ ...config, V: Math.pow(10, v) })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (favor throughput)</span>
                    <span>1000 (favor energy)</span>
                  </div>
                </div>

                {/* Global Physics Parameters */}
                <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="theta">θ (CPU coefficient)</Label>
                      <FieldTooltip field="theta" />
                    </div>
                    <Input
                      id="theta"
                      type="number"
                      value={config.global_params?.theta}
                      onChange={(e) => setConfig({
                        ...config,
                        global_params: { ...config.global_params!, theta: parseFloat(e.target.value) || 1e-27 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="noise">Noise Power (σ²)</Label>
                      <FieldTooltip field="noise_power_W" />
                    </div>
                    <Input
                      id="noise"
                      type="number"
                      value={config.global_params?.noise_power_W}
                      onChange={(e) => setConfig({
                        ...config,
                        global_params: { ...config.global_params!, noise_power_W: parseFloat(e.target.value) || 9e-14 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="delta">δ (cycles/bit)</Label>
                      <FieldTooltip field="delta_cycles_per_bit" />
                    </div>
                    <Input
                      id="delta"
                      type="number"
                      value={config.global_params?.delta_cycles_per_bit}
                      onChange={(e) => setConfig({
                        ...config,
                        global_params: { ...config.global_params!, delta_cycles_per_bit: parseInt(e.target.value) || 1000 }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optimizer Tab */}
          <TabsContent value="optimizer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GA Optimizer Configuration</CardTitle>
                <CardDescription>
                  Configure the genetic algorithm for P-TSRA optimization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="population">Population Size</Label>
                    <Input
                      id="population"
                      type="number"
                      min={10}
                      max={200}
                      value={config.optimizer?.population}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, population: parseInt(e.target.value) || 40 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generations">Generations</Label>
                    <Input
                      id="generations"
                      type="number"
                      min={1}
                      max={50}
                      value={config.optimizer?.generations}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, generations: parseInt(e.target.value) || 6 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mutation">Mutation Probability</Label>
                    <Input
                      id="mutation"
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      value={config.optimizer?.mutation_prob}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, mutation_prob: parseFloat(e.target.value) || 0.05 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restarts">Random Restarts</Label>
                    <Input
                      id="restarts"
                      type="number"
                      min={1}
                      max={20}
                      value={config.optimizer?.random_restarts}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, random_restarts: parseInt(e.target.value) || 3 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxEvals">Max Evaluations</Label>
                    <Input
                      id="maxEvals"
                      type="number"
                      min={100}
                      max={10000}
                      value={config.optimizer?.max_evals}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, max_evals: parseInt(e.target.value) || 500 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeBudget">Time Budget (s)</Label>
                    <Input
                      id="timeBudget"
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={10}
                      value={config.optimizer?.time_budget_s || 2.0}
                      onChange={(e) => setConfig({
                        ...config,
                        optimizer: { ...config.optimizer!, time_budget_s: parseFloat(e.target.value) || 2.0 }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Run Button */}
      {showSensorForms && (
        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={handleStartExperiment}
            disabled={isRunning || sensors.length === 0}
            className="min-w-[200px]"
          >
            {isRunning ? (
              <>
                <Radio className="mr-2 h-5 w-5 animate-pulse" />
                Running Simulation...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start Experiment
              </>
            )}
          </Button>
        </div>
      )}
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
