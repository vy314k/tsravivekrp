/**
 * Main Simulation Engine
 * Runs both TSRA and P-TSRA algorithms and compares results
 */

import type {
  ExperimentConfig,
  SlotResult,
  GlobalMetrics,
  SimulationState,
  OptimizerLogEntry,
} from '@/types/experiment';
import { TSRAAlgorithm, initializeSensorStates, SensorState } from './tsra';
import { PTSRAAlgorithm } from './p-tsra';

export type SimulationProgressCallback = (
  state: SimulationState,
  tsraSlot?: SlotResult,
  ptsraSlot?: SlotResult
) => void;

export type OptimizerLogCallback = (
  sensorId: string,
  entry: OptimizerLogEntry
) => void;

/**
 * Run complete simulation comparing TSRA and P-TSRA
 */
export async function runSimulation(
  config: ExperimentConfig,
  progressCallback?: SimulationProgressCallback,
  optimizerCallback?: OptimizerLogCallback
): Promise<SimulationState> {
  const runId = crypto.randomUUID();
  
  // Initialize state
  const state: SimulationState = {
    run_id: runId,
    status: 'running',
    current_slot: 0,
    total_slots: config.slots,
    tsra_results: [],
    ptsra_results: [],
    optimizer_log: [],
  };

  // Initialize algorithms
  const tsra = new TSRAAlgorithm(
    config.V,
    config.slot_duration_s,
    config.bandwidth_Hz,
    config.global_params,
    config.seed
  );

  const ptsra = new PTSRAAlgorithm(
    config.V,
    config.slot_duration_s,
    config.bandwidth_Hz,
    config.global_params,
    config.seed + 1, // Different seed for independence
    config.prediction_horizon,
    config.optimizer
  );

  // Initialize sensor states for both algorithms
  let tsraStates = initializeSensorStates(config.sensors);
  let ptsraStates = initializeSensorStates(config.sensors);
  const edgeServer = config.edge_servers[0]; // Use first edge server

  try {
    for (let slot = 0; slot < config.slots; slot++) {
      state.current_slot = slot;

      // Run TSRA
      const tsraResult = tsra.executeSlot(
        config.sensors,
        tsraStates,
        edgeServer
      );
      tsraStates = tsraResult.newStates;

      // Calculate TSRA global metrics
      const tsraMetrics = calculateGlobalMetrics(
        tsraResult.sensorResults,
        tsraResult.edgeResult
      );

      const tsraSlotResult: SlotResult = {
        slot,
        sensor_results: tsraResult.sensorResults,
        edge_results: tsraResult.edgeResult,
        global_metrics: tsraMetrics,
        algorithm: 'TSRA',
      };
      state.tsra_results.push(tsraSlotResult);

      // Run P-TSRA
      const ptsraResult = ptsra.executeSlotPredictive(
        config.sensors,
        ptsraStates,
        edgeServer,
        slot,
        (sensorId, entry) => {
          state.optimizer_log.push(entry);
          if (optimizerCallback) {
            optimizerCallback(sensorId, entry);
          }
        }
      );
      ptsraStates = ptsraResult.newStates;

      // Calculate P-TSRA global metrics
      const ptsraMetrics = calculateGlobalMetrics(
        ptsraResult.sensorResults,
        ptsraResult.edgeResult
      );

      const ptsraSlotResult: SlotResult = {
        slot,
        sensor_results: ptsraResult.sensorResults,
        edge_results: ptsraResult.edgeResult,
        global_metrics: ptsraMetrics,
        algorithm: 'P-TSRA',
      };
      state.ptsra_results.push(ptsraSlotResult);

      // Report progress
      if (progressCallback) {
        progressCallback(state, tsraSlotResult, ptsraSlotResult);
      }

      // Yield to event loop periodically for UI responsiveness
      if (slot % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    state.status = 'completed';
  } catch (error) {
    state.status = 'error';
    console.error('Simulation error:', error);
  }

  return state;
}

/**
 * Calculate global metrics from slot results
 */
function calculateGlobalMetrics(
  sensorResults: SlotResult['sensor_results'],
  edgeResult: SlotResult['edge_results']
): GlobalMetrics {
  let totalBacklog = 0;
  let totalEnergy = 0;
  let totalLatency = 0;

  for (const sensor of sensorResults) {
    totalBacklog += sensor.H_l + sensor.H_o + sensor.H_k;
    totalEnergy += sensor.local_energy_J + sensor.tx_energy_J;
    
    // Estimate latency based on queue backlog
    const avgRate = sensor.arrival_bits > 0 
      ? sensor.arrival_bits 
      : 1e5; // Default rate for latency calculation
    totalLatency += (sensor.H_l + sensor.H_o + sensor.H_k) / avgRate * 1000; // ms
  }

  return {
    total_backlog_bits: totalBacklog,
    total_energy_J: totalEnergy,
    best_fitness: -totalEnergy - 0.01 * totalBacklog, // Combined objective
    avg_latency_ms: totalLatency / sensorResults.length,
  };
}

/**
 * Generate summary statistics from simulation results
 */
export function generateSummary(state: SimulationState): {
  tsra: {
    avg_backlog: number;
    total_energy: number;
    avg_latency: number;
    energy_per_slot: number;
  };
  ptsra: {
    avg_backlog: number;
    total_energy: number;
    avg_latency: number;
    energy_per_slot: number;
  };
  improvement: {
    backlog_reduction_pct: number;
    energy_reduction_pct: number;
    latency_reduction_pct: number;
  };
} {
  // TSRA statistics
  const tsraBacklogs = state.tsra_results.map(r => r.global_metrics.total_backlog_bits);
  const tsraEnergies = state.tsra_results.map(r => r.global_metrics.total_energy_J);
  const tsraLatencies = state.tsra_results.map(r => r.global_metrics.avg_latency_ms);

  const tsraAvgBacklog = tsraBacklogs.reduce((a, b) => a + b, 0) / tsraBacklogs.length;
  const tsraTotalEnergy = tsraEnergies.reduce((a, b) => a + b, 0);
  const tsraAvgLatency = tsraLatencies.reduce((a, b) => a + b, 0) / tsraLatencies.length;

  // P-TSRA statistics
  const ptsraBacklogs = state.ptsra_results.map(r => r.global_metrics.total_backlog_bits);
  const ptsraEnergies = state.ptsra_results.map(r => r.global_metrics.total_energy_J);
  const ptsraLatencies = state.ptsra_results.map(r => r.global_metrics.avg_latency_ms);

  const ptsraAvgBacklog = ptsraBacklogs.reduce((a, b) => a + b, 0) / ptsraBacklogs.length;
  const ptsraTotalEnergy = ptsraEnergies.reduce((a, b) => a + b, 0);
  const ptsraAvgLatency = ptsraLatencies.reduce((a, b) => a + b, 0) / ptsraLatencies.length;

  return {
    tsra: {
      avg_backlog: tsraAvgBacklog,
      total_energy: tsraTotalEnergy,
      avg_latency: tsraAvgLatency,
      energy_per_slot: tsraTotalEnergy / state.total_slots,
    },
    ptsra: {
      avg_backlog: ptsraAvgBacklog,
      total_energy: ptsraTotalEnergy,
      avg_latency: ptsraAvgLatency,
      energy_per_slot: ptsraTotalEnergy / state.total_slots,
    },
    improvement: {
      backlog_reduction_pct: ((tsraAvgBacklog - ptsraAvgBacklog) / tsraAvgBacklog) * 100,
      energy_reduction_pct: ((tsraTotalEnergy - ptsraTotalEnergy) / tsraTotalEnergy) * 100,
      latency_reduction_pct: ((tsraAvgLatency - ptsraAvgLatency) / tsraAvgLatency) * 100,
    },
  };
}

/**
 * Export results to CSV format
 */
export function exportToCSV(state: SimulationState): string {
  const headers = [
    'slot',
    'algorithm',
    'sensor_id',
    'H_l',
    'H_o',
    'H_k',
    'alpha',
    'local_energy_J',
    'tx_energy_J',
    'battery_J',
    'arrival_bits',
    'harvest_J',
  ];

  const rows: string[] = [headers.join(',')];

  // Add TSRA results
  for (const slotResult of state.tsra_results) {
    for (const sensor of slotResult.sensor_results) {
      rows.push([
        slotResult.slot,
        'TSRA',
        sensor.id,
        sensor.H_l,
        sensor.H_o,
        sensor.H_k,
        sensor.alpha,
        sensor.local_energy_J,
        sensor.tx_energy_J,
        sensor.battery_J,
        sensor.arrival_bits,
        sensor.harvest_J,
      ].join(','));
    }
  }

  // Add P-TSRA results
  for (const slotResult of state.ptsra_results) {
    for (const sensor of slotResult.sensor_results) {
      rows.push([
        slotResult.slot,
        'P-TSRA',
        sensor.id,
        sensor.H_l,
        sensor.H_o,
        sensor.H_k,
        sensor.alpha,
        sensor.local_energy_J,
        sensor.tx_energy_J,
        sensor.battery_J,
        sensor.arrival_bits,
        sensor.harvest_J,
      ].join(','));
    }
  }

  return rows.join('\n');
}
