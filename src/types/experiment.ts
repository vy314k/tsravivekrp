// Input schema types for IoT Task Scheduling experiments
// Based on paper: "Optimal Task Scheduling and Resource Allocation for Self-Powered Sensors in IoT"

export interface ArrivalModel {
  type: 'poisson' | 'fixed' | 'uniform';
  lambda?: number;      // For Poisson distribution
  value_bits?: number;  // For fixed arrival
  min_bits?: number;    // For uniform distribution
  max_bits?: number;    // For uniform distribution
}

export interface HarvestModel {
  type: 'bernoulli' | 'constant' | 'gaussian';
  p?: number;         // For Bernoulli - probability of harvest event
  value_J?: number;   // Harvest amount when event occurs (Bernoulli/constant)
  mean_J?: number;    // For Gaussian
  std_J?: number;     // For Gaussian
}

export interface SensorConfig {
  id: string;
  J_mean_bits_per_slot: number;           // Average task arrival (bits/slot)
  arrival_model: ArrivalModel;
  initial_queue_bits: number;             // Initial backlog (bits)
  battery_J: number;                      // Initial battery energy (Joules)
  harvest_mean_J_per_slot: number;        // Average harvest energy per slot (J)
  harvest_model: HarvestModel;
  f_max_Hz: number;                       // Max CPU frequency (Hz)
  delta_cycles_per_bit: number;           // CPU cycles per bit (δ_u)
  p_max_W: number;                        // Max transmit power (Watts)
  channel_mean_gain: number;              // Linear channel gain (not dB)
  channel_variance: number;               // Channel variance for fading
  offload_mode: 'binary' | 'fractional';  // Binary or fractional offloading
  priority_weight: number;                // Scheduler weight
}

export interface EdgeServerConfig {
  id: string;
  f_k_Hz: number;       // Edge server CPU frequency (Hz)
  f_max_Hz: number;     // Max CPU frequency (Hz)
  num_cores: number;    // Number of cores
}

export interface CloudConfig {
  latency_s: number;                        // Cloud latency (seconds)
  compute_capacity_cycles_per_slot: number; // Compute capacity
}

export interface OptimizerConfig {
  population: number;      // GA population size
  generations: number;     // Number of generations
  mutation_prob: number;   // Mutation probability [0,1]
  random_restarts: number; // Number of random restarts
  max_evals: number;       // Maximum evaluations
  time_budget_s?: number;  // Optional time budget per decision
}

export interface GlobalParams {
  delta_cycles_per_bit: number;  // Default δ_u (cycles/bit)
  theta: number;                  // Energy coefficient for CPU (θ)
  noise_power_W: number;          // Noise variance (σ²) in Watts
  tau_s: number;                  // Slot duration (τ) seconds
}

export interface ExperimentConfig {
  experiment_name: string;
  seed: number;
  slots: number;                              // Number of time slots
  slot_duration_s: number;                    // τ: slot duration
  bandwidth_Hz: number;                       // W: channel bandwidth
  V: number;                                  // Lyapunov tradeoff parameter
  prediction_horizon: number;                 // H: MPC horizon for P-TSRA
  opt_mode: 'per-slot' | 'per-horizon';
  optimizer: OptimizerConfig;
  global_params: GlobalParams;
  sensors: SensorConfig[];
  edge_servers: EdgeServerConfig[];
  cloud: CloudConfig;
}

// Simulation result types
export interface SensorSlotResult {
  id: string;
  H_l: number;           // Local queue backlog (bits)
  H_o: number;           // Offload queue backlog (bits)
  H_k: number;           // Edge queue backlog (bits)
  alpha: number;         // Offload fraction [0,1]
  local_energy_J: number;
  tx_energy_J: number;
  p_tx_W: number;        // Transmission power used
  f_cpu_Hz: number;      // CPU frequency used
  arrival_bits: number;  // Task arrival this slot
  harvest_J: number;     // Energy harvested this slot
  battery_J: number;     // Current battery level
}

export interface EdgeSlotResult {
  ES_allocations: {
    sensor_id: string;
    xi: number;          // Resource allocation fraction
    processed_bits: number;
  }[];
}

export interface GlobalMetrics {
  total_backlog_bits: number;
  total_energy_J: number;
  best_fitness: number;
  avg_latency_ms: number;
}

export interface SlotResult {
  slot: number;
  sensor_results: SensorSlotResult[];
  edge_results: EdgeSlotResult;
  global_metrics: GlobalMetrics;
  algorithm: 'TSRA' | 'P-TSRA';
}

export interface SimulationState {
  run_id: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  current_slot: number;
  total_slots: number;
  tsra_results: SlotResult[];
  ptsra_results: SlotResult[];
  optimizer_log: OptimizerLogEntry[];
}

export interface OptimizerLogEntry {
  slot: number;
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  infeasible_count: number;
  elapsed_ms: number;
}

// Preset experiments
export const PRESET_EXPERIMENTS: Record<string, Partial<ExperimentConfig>> = {
  'micro-sim-2sensors': {
    experiment_name: 'micro-sim-2sensors',
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
    sensors: [
      {
        id: 's1',
        J_mean_bits_per_slot: 100000,
        arrival_model: { type: 'poisson', lambda: 1.0 },
        initial_queue_bits: 0,
        battery_J: 0.5,
        harvest_mean_J_per_slot: 0.01,
        harvest_model: { type: 'bernoulli', p: 0.1, value_J: 0.02 },
        f_max_Hz: 1e9,
        delta_cycles_per_bit: 1000,
        p_max_W: 0.05,
        channel_mean_gain: 1e-6,
        channel_variance: 1e-12,
        offload_mode: 'fractional',
        priority_weight: 1.0,
      },
      {
        id: 's2',
        J_mean_bits_per_slot: 50000,
        arrival_model: { type: 'fixed', value_bits: 50000 },
        initial_queue_bits: 0,
        battery_J: 0.2,
        harvest_mean_J_per_slot: 0.005,
        harvest_model: { type: 'constant', value_J: 0.005 },
        f_max_Hz: 5e8,
        delta_cycles_per_bit: 1200,
        p_max_W: 0.02,
        channel_mean_gain: 5e-7,
        channel_variance: 5e-13,
        offload_mode: 'fractional',
        priority_weight: 1.0,
      },
    ],
    edge_servers: [
      { id: 'edge-1', f_k_Hz: 15e9, f_max_Hz: 15e9, num_cores: 8 },
    ],
    cloud: {
      latency_s: 0.02,
      compute_capacity_cycles_per_slot: 1e12,
    },
  },
  'stress-test-6sensors': {
    experiment_name: 'stress-test-6sensors',
    seed: 123,
    slots: 300,
    slot_duration_s: 0.5,
    bandwidth_Hz: 2e6,
    V: 50,
    prediction_horizon: 8,
    opt_mode: 'per-slot',
    optimizer: {
      population: 60,
      generations: 10,
      mutation_prob: 0.08,
      random_restarts: 5,
      max_evals: 1000,
    },
  },
};

// Field tooltips and metadata
export const FIELD_TOOLTIPS: Record<string, { description: string; unit: string; range: string; default: string }> = {
  J_mean_bits_per_slot: {
    description: 'Average arrival traffic for the sensor in bits per slot',
    unit: 'bits/slot',
    range: '1e3 to 1e7',
    default: '100000',
  },
  arrival_model: {
    description: 'Statistical model of task arrivals. Poisson for random, Fixed for constant, Uniform for range.',
    unit: 'model',
    range: 'poisson | fixed | uniform',
    default: 'poisson',
  },
  initial_queue_bits: {
    description: 'Initial backlog of unsent bits at sensor start',
    unit: 'bits',
    range: '0 to 1e8',
    default: '0',
  },
  battery_J: {
    description: 'Initial stored energy in Joules. Sensors are energy-limited.',
    unit: 'Joules',
    range: '0.01 to 10.0',
    default: '0.5',
  },
  harvest_mean_J_per_slot: {
    description: 'Average energy harvested per slot from environment',
    unit: 'Joules/slot',
    range: '0 to 0.1',
    default: '0.01',
  },
  harvest_model: {
    description: 'Energy harvesting model: Bernoulli (on/off), Constant, or Gaussian (clipped at 0)',
    unit: 'model',
    range: 'bernoulli | constant | gaussian',
    default: 'bernoulli',
  },
  f_max_Hz: {
    description: 'Maximum CPU frequency available on sensor',
    unit: 'Hz',
    range: '1e7 to 1e9 (10 MHz to 1 GHz)',
    default: '1e9',
  },
  delta_cycles_per_bit: {
    description: 'CPU cycles required to process one bit locally (δ_u)',
    unit: 'cycles/bit',
    range: '100 to 2000',
    default: '1000',
  },
  p_max_W: {
    description: 'Maximum transmit power for wireless offloading',
    unit: 'Watts',
    range: '0.001 to 0.2',
    default: '0.05',
  },
  channel_mean_gain: {
    description: 'Channel gain (linear scale) for achievable rate calculation. r = W * log2(1 + p*g/σ²)',
    unit: 'linear (not dB)',
    range: '1e-7 to 1e-4',
    default: '1e-6',
  },
  channel_variance: {
    description: 'Variance for channel fading (linear scale)',
    unit: 'linear',
    range: '1e-14 to 1e-10',
    default: '1e-12',
  },
  offload_mode: {
    description: 'Binary: offload all or none. Fractional: α ∈ [0,1] continuous split.',
    unit: 'mode',
    range: 'binary | fractional',
    default: 'fractional',
  },
  priority_weight: {
    description: 'Scheduler weight for ES allocation priority',
    unit: 'unitless',
    range: '0.1 to 10.0',
    default: '1.0',
  },
  V: {
    description: 'Lyapunov tradeoff parameter: larger V emphasizes energy over backlog',
    unit: 'unitless',
    range: '1 to 1000',
    default: '10',
  },
  prediction_horizon: {
    description: 'Number of future slots for MPC in P-TSRA. 0 disables prediction (falls back to TSRA).',
    unit: 'slots',
    range: '0 to 20',
    default: '5',
  },
  slot_duration_s: {
    description: 'Duration of each time slot (τ)',
    unit: 'seconds',
    range: '0.1 to 2.0',
    default: '1.0',
  },
  bandwidth_Hz: {
    description: 'Channel bandwidth (W) for rate calculation',
    unit: 'Hz',
    range: '1e5 to 1e7',
    default: '1e6',
  },
  theta: {
    description: 'Effective switched capacitor coefficient for CPU energy (θ)',
    unit: 'varies',
    range: '1e-28 to 1e-26',
    default: '1e-27',
  },
  noise_power_W: {
    description: 'Noise variance (σ²) in channel model',
    unit: 'Watts',
    range: '1e-15 to 1e-12',
    default: '9e-14',
  },
};
