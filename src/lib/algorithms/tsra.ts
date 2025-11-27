/**
 * TSRA Algorithm Implementation
 * Based on: "Optimal Task Scheduling and Resource Allocation for Self-Powered Sensors in IoT"
 * Authors: Jiajie Xu, Kaixin Li, Ying Chen, Jiwei Huang
 * IEEE Transactions on Network and Service Management, 2024
 */

import type { 
  SensorConfig, 
  EdgeServerConfig, 
  GlobalParams, 
  SensorSlotResult, 
  EdgeSlotResult 
} from '@/types/experiment';
import { SeededRandom } from './random';

export interface SensorState {
  H_l: number;  // Local computation queue (bits)
  H_o: number;  // Offload queue (bits)
  H_k: number;  // Edge server queue (bits)
  B_u: number;  // Battery energy (Joules)
}

export interface SlotDecision {
  kappa: 0 | 1;   // Task scheduling decision (0=local, 1=offload)
  alpha: number;  // Offload fraction [0,1] for fractional mode
  f_u: number;    // Local CPU frequency (Hz)
  p_u: number;    // Transmission power (Watts)
  xi_u: number;   // ES resource allocation fraction
}

/**
 * TSRA Algorithm - Task Scheduling and Resource Allocation
 * Implements the Lyapunov drift-plus-penalty optimization framework
 */
export class TSRAAlgorithm {
  private V: number;
  private tau: number;
  private bandwidth: number;
  private globalParams: GlobalParams;
  private random: SeededRandom;

  constructor(
    V: number,
    tau: number,
    bandwidth: number,
    globalParams: GlobalParams,
    seed: number
  ) {
    this.V = V;
    this.tau = tau;
    this.bandwidth = bandwidth;
    this.globalParams = globalParams;
    this.random = new SeededRandom(seed);
  }

  /**
   * Generate task arrival based on sensor's arrival model
   */
  generateArrival(sensor: SensorConfig): number {
    const model = sensor.arrival_model;
    switch (model.type) {
      case 'poisson':
        // Poisson-distributed number of arrivals, each of mean size
        const numArrivals = this.random.poisson(model.lambda || 1);
        return numArrivals * sensor.J_mean_bits_per_slot;
      case 'fixed':
        return model.value_bits || sensor.J_mean_bits_per_slot;
      case 'uniform':
        const min = model.min_bits || sensor.J_mean_bits_per_slot * 0.5;
        const max = model.max_bits || sensor.J_mean_bits_per_slot * 1.5;
        return this.random.uniform(min, max);
      default:
        return sensor.J_mean_bits_per_slot;
    }
  }

  /**
   * Generate energy harvest based on sensor's harvest model
   */
  generateHarvest(sensor: SensorConfig): number {
    const model = sensor.harvest_model;
    switch (model.type) {
      case 'bernoulli':
        return this.random.random() < (model.p || 0.1) 
          ? (model.value_J || sensor.harvest_mean_J_per_slot) 
          : 0;
      case 'constant':
        return model.value_J || sensor.harvest_mean_J_per_slot;
      case 'gaussian':
        const mean = model.mean_J || sensor.harvest_mean_J_per_slot;
        const std = model.std_J || mean * 0.2;
        return Math.max(0, this.random.gaussian(mean, std)); // Clipped at 0
      default:
        return sensor.harvest_mean_J_per_slot;
    }
  }

  /**
   * Generate channel gain with fading
   */
  generateChannelGain(sensor: SensorConfig): number {
    // Rayleigh fading approximation
    const mean = sensor.channel_mean_gain;
    const variance = sensor.channel_variance;
    const std = Math.sqrt(variance);
    return Math.max(1e-10, this.random.gaussian(mean, std));
  }

  /**
   * Sub-problem 1: Task Scheduling Decision
   * κ*(t) = 0 if H_o(t) >= H_l(t), else 1
   * Equation (25) in paper
   */
  taskSchedulingDecision(state: SensorState): 0 | 1 {
    return state.H_o >= state.H_l ? 0 : 1;
  }

  /**
   * Sub-problem 2: Local CPU-Cycle Frequency Allocation
   * Equations (27)-(30) in paper
   */
  localCPUFrequencyAllocation(
    sensor: SensorConfig,
    state: SensorState
  ): number {
    const delta = sensor.delta_cycles_per_bit;
    const theta = this.globalParams.theta;
    const H_l = state.H_l;
    const B_u = state.B_u;
    const f_max = sensor.f_max_Hz;
    const tau = this.tau;

    // Calculate threshold: sqrt(B_u / (theta * tau))^(1/3)
    const batteryThreshold = Math.pow(B_u / (theta * tau), 1/3);
    
    // Maximum frequency based on queue constraint
    const queueConstraint = (H_l * delta) / tau;
    
    // Case analysis from Equation (28)
    const lyapunovFreq = Math.pow(H_l / (3 * this.V * theta * delta), 1/2);
    
    if (batteryThreshold <= Math.min(f_max, queueConstraint)) {
      // Battery energy sufficient, use Lyapunov optimal
      if (lyapunovFreq <= batteryThreshold) {
        return Math.min(f_max, Math.max(0, lyapunovFreq));
      }
      return Math.min(f_max, queueConstraint, lyapunovFreq);
    }
    
    // Battery insufficient - use linear programming solution
    return Math.min(f_max, queueConstraint);
  }

  /**
   * Sub-problem 3: Transmission Power Allocation
   * Equations (32)-(35) in paper
   */
  transmissionPowerAllocation(
    sensor: SensorConfig,
    state: SensorState,
    channelGain: number
  ): number {
    const H_o = state.H_o;
    const H_k = state.H_k;
    const sigma2 = this.globalParams.noise_power_W;
    const p_max = sensor.p_max_W;
    const b = this.bandwidth;
    
    // If offload queue <= edge queue, no transmission needed
    if (H_o <= H_k) {
      return 0;
    }
    
    // Water-filling solution from Equation (35)
    const numerator = (H_o - H_k) * b;
    const denominator = this.V * Math.log(2);
    const waterLevel = numerator / denominator - sigma2 / channelGain;
    
    // Constraint: transmission rate <= queue backlog
    const maxRateConstraint = (Math.pow(2, H_o / (b * this.tau)) - 1) * sigma2 / channelGain;
    
    return Math.max(0, Math.min(p_max, waterLevel, maxRateConstraint));
  }

  /**
   * Calculate transmission rate using Shannon capacity formula
   * r_u = W * log2(1 + p_u * g_u / σ²)
   */
  calculateTransmissionRate(power: number, channelGain: number): number {
    const snr = (power * channelGain) / this.globalParams.noise_power_W;
    return this.bandwidth * Math.log2(1 + snr) * this.tau;
  }

  /**
   * Calculate local computation energy
   * E_l(t) = θ * f_u(t)³ * τ
   * Equation (8) in paper
   */
  calculateLocalEnergy(frequency: number): number {
    return this.globalParams.theta * Math.pow(frequency, 3) * this.tau;
  }

  /**
   * Calculate transmission energy
   * E_tx = p_u * τ
   */
  calculateTransmissionEnergy(power: number): number {
    return power * this.tau;
  }

  /**
   * Sub-problem 4: ES Resource Allocation
   * Equation (37)-(38) in paper - weighted fair allocation
   */
  edgeServerAllocation(
    sensors: SensorConfig[],
    states: SensorState[],
    edgeServer: EdgeServerConfig
  ): Map<string, number> {
    const allocations = new Map<string, number>();
    
    // Calculate weighted queue backlogs
    const weightedBacklogs: { id: string; weight: number }[] = [];
    let totalWeight = 0;
    
    for (let i = 0; i < sensors.length; i++) {
      const sensor = sensors[i];
      const state = states[i];
      const weight = state.H_k * sensor.priority_weight;
      weightedBacklogs.push({ id: sensor.id, weight });
      totalWeight += weight;
    }
    
    // Allocate proportionally to weighted queue backlogs
    for (const { id, weight } of weightedBacklogs) {
      const xi = totalWeight > 0 ? weight / totalWeight : 1 / sensors.length;
      allocations.set(id, Math.min(1, xi));
    }
    
    return allocations;
  }

  /**
   * Execute one time slot of TSRA algorithm
   */
  executeSlot(
    sensors: SensorConfig[],
    states: SensorState[],
    edgeServer: EdgeServerConfig
  ): {
    decisions: SlotDecision[];
    newStates: SensorState[];
    sensorResults: SensorSlotResult[];
    edgeResult: EdgeSlotResult;
  } {
    const decisions: SlotDecision[] = [];
    const newStates: SensorState[] = [];
    const sensorResults: SensorSlotResult[] = [];
    const edgeAllocations = this.edgeServerAllocation(sensors, states, edgeServer);

    for (let i = 0; i < sensors.length; i++) {
      const sensor = sensors[i];
      const state = states[i];

      // Generate stochastic events
      const arrival = this.generateArrival(sensor);
      const harvest = this.generateHarvest(sensor);
      const channelGain = this.generateChannelGain(sensor);

      // Sub-problem 1: Task scheduling
      const kappa = this.taskSchedulingDecision(state);
      
      // Sub-problem 2: Local CPU frequency
      const f_u = this.localCPUFrequencyAllocation(sensor, state);
      
      // Sub-problem 3: Transmission power
      const p_u = this.transmissionPowerAllocation(sensor, state, channelGain);
      
      // Get ES allocation
      const xi_u = edgeAllocations.get(sensor.id) || 0;

      // Calculate derived quantities
      const delta = sensor.delta_cycles_per_bit;
      const C_l = (f_u * this.tau) / delta;  // Bits processed locally
      const C_o = this.calculateTransmissionRate(p_u, channelGain);  // Bits offloaded
      const C_k = (xi_u * edgeServer.f_k_Hz * this.tau) / delta;  // Bits processed at ES

      // Calculate energy
      const localEnergy = this.calculateLocalEnergy(f_u);
      const txEnergy = this.calculateTransmissionEnergy(p_u);

      // Update queues (Equations 4, 5, 7 in paper)
      const new_H_l = Math.max(0, state.H_l - C_l) + (1 - kappa) * arrival;
      const new_H_o = Math.max(0, state.H_o - C_o) + kappa * arrival;
      const new_H_k = Math.max(0, state.H_k - C_k) + C_o;
      
      // Update battery (Equation 9)
      const new_B_u = Math.max(0, state.B_u - localEnergy) + harvest;

      // Calculate alpha for fractional offloading
      const alpha = sensor.offload_mode === 'fractional' 
        ? (arrival > 0 ? (kappa * arrival) / arrival : 0)
        : kappa;

      decisions.push({ kappa, alpha, f_u, p_u, xi_u });
      
      newStates.push({
        H_l: new_H_l,
        H_o: new_H_o,
        H_k: new_H_k,
        B_u: new_B_u,
      });

      sensorResults.push({
        id: sensor.id,
        H_l: new_H_l,
        H_o: new_H_o,
        H_k: new_H_k,
        alpha,
        local_energy_J: localEnergy,
        tx_energy_J: txEnergy,
        p_tx_W: p_u,
        f_cpu_Hz: f_u,
        arrival_bits: arrival,
        harvest_J: harvest,
        battery_J: new_B_u,
      });
    }

    const edgeResult: EdgeSlotResult = {
      ES_allocations: sensors.map((s, i) => ({
        sensor_id: s.id,
        xi: edgeAllocations.get(s.id) || 0,
        processed_bits: (edgeAllocations.get(s.id) || 0) * edgeServer.f_k_Hz * this.tau / s.delta_cycles_per_bit,
      })),
    };

    return { decisions, newStates, sensorResults, edgeResult };
  }
}

/**
 * Initialize sensor states from configuration
 */
export function initializeSensorStates(sensors: SensorConfig[]): SensorState[] {
  return sensors.map(sensor => ({
    H_l: sensor.initial_queue_bits / 2,  // Split initial backlog
    H_o: sensor.initial_queue_bits / 2,
    H_k: 0,
    B_u: sensor.battery_J,
  }));
}
