/**
 * P-TSRA (Predictive TSRA) Algorithm Implementation
 * Extension of TSRA with:
 * 1. Predictive control using short-horizon MPC
 * 2. Fractional offloading (continuous α ∈ [0,1])
 * 3. Joint optimization of CPU DVFS, transmit power, and offload fraction
 * 
 * Based on: Vivek Yadav's research slides (P-TSRA design)
 */

import type {
  SensorConfig,
  EdgeServerConfig,
  GlobalParams,
  OptimizerConfig,
  SensorSlotResult,
  EdgeSlotResult,
  OptimizerLogEntry,
} from '@/types/experiment';
import { TSRAAlgorithm, SensorState, SlotDecision, initializeSensorStates } from './tsra';
import { GeneticOptimizer, Individual } from './optimizer';
import { SeededRandom } from './random';

/**
 * Prediction model for future states
 */
export interface PredictionHorizon {
  arrivals: number[];      // Predicted arrivals for H slots
  harvests: number[];      // Predicted harvests
  channelGains: number[];  // Predicted channel gains
}

/**
 * P-TSRA Algorithm - Predictive Task Scheduling and Resource Allocation
 * Integrates MPC with Lyapunov drift-plus-penalty
 */
export class PTSRAAlgorithm extends TSRAAlgorithm {
  private horizon: number;
  private optimizer: GeneticOptimizer;
  private optimizerConfig: OptimizerConfig;
  private ewmaAlpha: number = 0.3;  // EWMA smoothing factor
  
  // Historical averages for prediction
  private arrivalHistory: Map<string, number[]> = new Map();
  private harvestHistory: Map<string, number[]> = new Map();
  private channelHistory: Map<string, number[]> = new Map();

  constructor(
    V: number,
    tau: number,
    bandwidth: number,
    globalParams: GlobalParams,
    seed: number,
    horizon: number,
    optimizerConfig: OptimizerConfig
  ) {
    super(V, tau, bandwidth, globalParams, seed);
    this.horizon = horizon;
    this.optimizerConfig = optimizerConfig;
    this.optimizer = new GeneticOptimizer(
      optimizerConfig.population,
      optimizerConfig.generations,
      optimizerConfig.mutation_prob,
      seed
    );
  }

  /**
   * Update historical data for EWMA prediction
   */
  updateHistory(
    sensorId: string,
    arrival: number,
    harvest: number,
    channelGain: number
  ): void {
    // Update arrivals
    const arrivals = this.arrivalHistory.get(sensorId) || [];
    arrivals.push(arrival);
    if (arrivals.length > 50) arrivals.shift();
    this.arrivalHistory.set(sensorId, arrivals);

    // Update harvests
    const harvests = this.harvestHistory.get(sensorId) || [];
    harvests.push(harvest);
    if (harvests.length > 50) harvests.shift();
    this.harvestHistory.set(sensorId, harvests);

    // Update channel gains
    const channels = this.channelHistory.get(sensorId) || [];
    channels.push(channelGain);
    if (channels.length > 50) channels.shift();
    this.channelHistory.set(sensorId, channels);
  }

  /**
   * EWMA-based prediction for future slots
   */
  predictFuture(
    sensor: SensorConfig,
    horizon: number
  ): PredictionHorizon {
    const arrivals = this.arrivalHistory.get(sensor.id) || [];
    const harvests = this.harvestHistory.get(sensor.id) || [];
    const channels = this.channelHistory.get(sensor.id) || [];

    // Calculate EWMA for each metric
    const ewmaArrival = this.calculateEWMA(arrivals, sensor.J_mean_bits_per_slot);
    const ewmaHarvest = this.calculateEWMA(harvests, sensor.harvest_mean_J_per_slot);
    const ewmaChannel = this.calculateEWMA(channels, sensor.channel_mean_gain);

    // Generate predictions with some variance
    const predictions: PredictionHorizon = {
      arrivals: [],
      harvests: [],
      channelGains: [],
    };

    for (let h = 0; h < horizon; h++) {
      // Add small random perturbation to predictions
      const arrivalNoise = 0.9 + Math.random() * 0.2;
      const harvestNoise = 0.8 + Math.random() * 0.4;
      const channelNoise = 0.85 + Math.random() * 0.3;

      predictions.arrivals.push(ewmaArrival * arrivalNoise);
      predictions.harvests.push(ewmaHarvest * harvestNoise);
      predictions.channelGains.push(ewmaChannel * channelNoise);
    }

    return predictions;
  }

  /**
   * Calculate Exponentially Weighted Moving Average
   */
  private calculateEWMA(history: number[], defaultValue: number): number {
    if (history.length === 0) return defaultValue;
    
    let ewma = history[0];
    for (let i = 1; i < history.length; i++) {
      ewma = this.ewmaAlpha * history[i] + (1 - this.ewmaAlpha) * ewma;
    }
    return ewma;
  }

  /**
   * Fitness function for GA optimizer
   * Minimizes: V * E(energy) + drift penalty
   */
  fitnessFunction(
    individual: Individual,
    sensor: SensorConfig,
    state: SensorState,
    predictions: PredictionHorizon,
    V: number,
    tau: number,
    bandwidth: number,
    globalParams: GlobalParams
  ): number {
    const alpha = individual.genes[0];  // Offload fraction
    const fNorm = individual.genes[1];  // Normalized CPU frequency
    const pNorm = individual.genes[2];  // Normalized TX power

    // Denormalize
    const f_u = fNorm * sensor.f_max_Hz;
    const p_u = pNorm * sensor.p_max_W;

    // Simulate over prediction horizon
    let totalCost = 0;
    let simState = { ...state };

    for (let h = 0; h < Math.min(this.horizon, predictions.arrivals.length); h++) {
      const arrival = predictions.arrivals[h];
      const harvest = predictions.harvests[h];
      const channelGain = predictions.channelGains[h];

      // Calculate processing rates
      const delta = sensor.delta_cycles_per_bit;
      const C_l = (f_u * tau) / delta;
      const snr = (p_u * channelGain) / globalParams.noise_power_W;
      const C_o = bandwidth * Math.log2(1 + snr) * tau;

      // Calculate energy
      const localEnergy = globalParams.theta * Math.pow(f_u, 3) * tau;
      const txEnergy = p_u * tau;
      const totalEnergy = localEnergy + txEnergy;

      // Apply harvest
      const effectiveEnergy = Math.max(0, localEnergy - harvest);

      // Update queues
      const localArrival = (1 - alpha) * arrival;
      const offloadArrival = alpha * arrival;
      
      simState.H_l = Math.max(0, simState.H_l - C_l) + localArrival;
      simState.H_o = Math.max(0, simState.H_o - C_o) + offloadArrival;
      simState.B_u = Math.max(0, simState.B_u - effectiveEnergy) + harvest;

      // Lyapunov drift
      const drift = simState.H_l * (localArrival - C_l) + 
                   simState.H_o * (offloadArrival - C_o);

      // Cost for this slot (Equation 18 in paper)
      const slotCost = V * totalEnergy + drift;
      
      // Penalize constraint violations
      if (simState.B_u < 0) totalCost += 1e6;  // Energy exhaustion
      if (f_u > sensor.f_max_Hz) totalCost += 1e6;
      if (p_u > sensor.p_max_W) totalCost += 1e6;

      // Discount future costs slightly
      const discount = Math.pow(0.95, h);
      totalCost += discount * slotCost;
    }

    return totalCost;
  }

  /**
   * Optimize offload fraction using GA
   */
  optimizeAlpha(
    sensor: SensorConfig,
    state: SensorState,
    predictions: PredictionHorizon,
    logCallback?: (entry: OptimizerLogEntry) => void
  ): { alpha: number; f_u: number; p_u: number; logs: OptimizerLogEntry[] } {
    const logs: OptimizerLogEntry[] = [];
    const startTime = Date.now();

    // Define bounds: [alpha, f_norm, p_norm] all in [0,1]
    const bounds: [number, number][] = [
      [0, 1],     // alpha
      [0.1, 1],   // f_norm (avoid 0 frequency)
      [0, 1],     // p_norm
    ];

    const result = this.optimizer.optimize(
      (individual) => this.fitnessFunction(
        individual,
        sensor,
        state,
        predictions,
        (this as any).V,  // Access parent class V
        (this as any).tau,
        (this as any).bandwidth,
        (this as any).globalParams
      ),
      3,  // 3 genes
      bounds,
      (gen, bestFitness, avgFitness, infeasibleCount) => {
        const entry: OptimizerLogEntry = {
          slot: 0,  // Will be updated by caller
          generation: gen,
          best_fitness: bestFitness,
          avg_fitness: avgFitness,
          infeasible_count: infeasibleCount,
          elapsed_ms: Date.now() - startTime,
        };
        logs.push(entry);
        if (logCallback) logCallback(entry);
      }
    );

    return {
      alpha: result.best.genes[0],
      f_u: result.best.genes[1] * sensor.f_max_Hz,
      p_u: result.best.genes[2] * sensor.p_max_W,
      logs,
    };
  }

  /**
   * Execute one time slot of P-TSRA algorithm with prediction
   */
  executeSlotPredictive(
    sensors: SensorConfig[],
    states: SensorState[],
    edgeServer: EdgeServerConfig,
    slot: number,
    logCallback?: (sensorId: string, entry: OptimizerLogEntry) => void
  ): {
    decisions: SlotDecision[];
    newStates: SensorState[];
    sensorResults: SensorSlotResult[];
    edgeResult: EdgeSlotResult;
    optimizerLogs: OptimizerLogEntry[];
  } {
    const decisions: SlotDecision[] = [];
    const newStates: SensorState[] = [];
    const sensorResults: SensorSlotResult[] = [];
    const allOptimizerLogs: OptimizerLogEntry[] = [];

    // First, compute ES allocations
    const edgeAllocations = this.edgeServerAllocation(sensors, states, edgeServer);

    for (let i = 0; i < sensors.length; i++) {
      const sensor = sensors[i];
      const state = states[i];

      // Generate actual stochastic events
      const arrival = this.generateArrival(sensor);
      const harvest = this.generateHarvest(sensor);
      const channelGain = this.generateChannelGain(sensor);

      // Update history for future predictions
      this.updateHistory(sensor.id, arrival, harvest, channelGain);

      // Get predictions for MPC
      const predictions = this.predictFuture(sensor, this.horizon);

      // Optimize using GA (only if prediction horizon > 0)
      let alpha: number;
      let f_u: number;
      let p_u: number;

      if (this.horizon > 0) {
        const optResult = this.optimizeAlpha(
          sensor,
          state,
          predictions,
          (entry) => {
            entry.slot = slot;
            if (logCallback) logCallback(sensor.id, entry);
          }
        );
        alpha = optResult.alpha;
        f_u = optResult.f_u;
        p_u = optResult.p_u;
        
        // Add slot info to logs
        optResult.logs.forEach(log => {
          log.slot = slot;
          allOptimizerLogs.push(log);
        });
      } else {
        // Fall back to standard TSRA decisions
        const kappa = this.taskSchedulingDecision(state);
        alpha = kappa;
        f_u = this.localCPUFrequencyAllocation(sensor, state);
        p_u = this.transmissionPowerAllocation(sensor, state, channelGain);
      }

      // Get ES allocation
      const xi_u = edgeAllocations.get(sensor.id) || 0;

      // Calculate derived quantities
      const delta = sensor.delta_cycles_per_bit;
      const tau = (this as any).tau;
      const bandwidth = (this as any).bandwidth;
      const globalParams = (this as any).globalParams;

      const C_l = (f_u * tau) / delta;
      const snr = (p_u * channelGain) / globalParams.noise_power_W;
      const C_o = bandwidth * Math.log2(1 + snr) * tau;
      const C_k = (xi_u * edgeServer.f_k_Hz * tau) / delta;

      // Calculate energy
      const localEnergy = globalParams.theta * Math.pow(f_u, 3) * tau;
      const txEnergy = p_u * tau;

      // Update queues with fractional offloading
      const localArrival = (1 - alpha) * arrival;
      const offloadArrival = alpha * arrival;

      const new_H_l = Math.max(0, state.H_l - C_l) + localArrival;
      const new_H_o = Math.max(0, state.H_o - C_o) + offloadArrival;
      const new_H_k = Math.max(0, state.H_k - C_k) + C_o;
      const new_B_u = Math.max(0, state.B_u - localEnergy) + harvest;

      const kappa: 0 | 1 = alpha >= 0.5 ? 1 : 0;

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
      ES_allocations: sensors.map((s) => ({
        sensor_id: s.id,
        xi: edgeAllocations.get(s.id) || 0,
        processed_bits: (edgeAllocations.get(s.id) || 0) * edgeServer.f_k_Hz * (this as any).tau / s.delta_cycles_per_bit,
      })),
    };

    return { decisions, newStates, sensorResults, edgeResult, optimizerLogs: allOptimizerLogs };
  }
}
