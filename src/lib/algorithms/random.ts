/**
 * Seeded Random Number Generator
 * Mulberry32 PRNG for reproducible experiments
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Generate random number in [0, 1)
   * Mulberry32 algorithm
   */
  random(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate uniform random number in [min, max]
   */
  uniform(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * Generate Gaussian random number using Box-Muller transform
   */
  gaussian(mean: number = 0, std: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }

  /**
   * Generate Poisson random number
   */
  poisson(lambda: number): number {
    if (lambda < 30) {
      // Direct method for small lambda
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.random();
      } while (p > L);
      return k - 1;
    } else {
      // Normal approximation for large lambda
      return Math.max(0, Math.round(this.gaussian(lambda, Math.sqrt(lambda))));
    }
  }

  /**
   * Generate Bernoulli random number
   */
  bernoulli(p: number): boolean {
    return this.random() < p;
  }

  /**
   * Generate exponential random number
   */
  exponential(rate: number): number {
    return -Math.log(this.random()) / rate;
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Sample n items from array without replacement
   */
  sample<T>(array: T[], n: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, n);
  }
}

/**
 * Generate random sensor configuration for testing
 */
export function generateRandomSensor(
  id: string,
  random: SeededRandom,
  defaults?: Partial<{
    J_mean_bits_per_slot: number;
    battery_J: number;
    harvest_mean_J_per_slot: number;
    f_max_Hz: number;
    p_max_W: number;
    channel_mean_gain: number;
  }>
): {
  id: string;
  J_mean_bits_per_slot: number;
  arrival_model: { type: 'poisson'; lambda: number };
  initial_queue_bits: number;
  battery_J: number;
  harvest_mean_J_per_slot: number;
  harvest_model: { type: 'bernoulli'; p: number; value_J: number };
  f_max_Hz: number;
  delta_cycles_per_bit: number;
  p_max_W: number;
  channel_mean_gain: number;
  channel_variance: number;
  offload_mode: 'fractional';
  priority_weight: number;
} {
  const J_mean = defaults?.J_mean_bits_per_slot ?? random.uniform(5e4, 2e5);
  const battery = defaults?.battery_J ?? random.uniform(0.1, 1.0);
  const harvest_mean = defaults?.harvest_mean_J_per_slot ?? random.uniform(0.005, 0.02);
  const f_max = defaults?.f_max_Hz ?? random.uniform(5e8, 2e9);
  const p_max = defaults?.p_max_W ?? random.uniform(0.02, 0.1);
  const channel_gain = defaults?.channel_mean_gain ?? random.uniform(1e-7, 5e-6);

  return {
    id,
    J_mean_bits_per_slot: J_mean,
    arrival_model: { type: 'poisson', lambda: random.uniform(0.5, 2.0) },
    initial_queue_bits: 0,
    battery_J: battery,
    harvest_mean_J_per_slot: harvest_mean,
    harvest_model: { 
      type: 'bernoulli', 
      p: random.uniform(0.05, 0.2), 
      value_J: harvest_mean * random.uniform(1.5, 3.0) 
    },
    f_max_Hz: f_max,
    delta_cycles_per_bit: random.nextInt(800, 1500),
    p_max_W: p_max,
    channel_mean_gain: channel_gain,
    channel_variance: channel_gain * random.uniform(0.01, 0.1),
    offload_mode: 'fractional',
    priority_weight: random.uniform(0.5, 2.0),
  };
}
