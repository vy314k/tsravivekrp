/**
 * Genetic Algorithm Optimizer for P-TSRA
 * Randomized optimizer for per-sensor α (alpha) split optimization
 */

import { SeededRandom } from './random';

export interface Individual {
  genes: number[];
  fitness: number;
}

export interface OptimizationResult {
  best: Individual;
  generations: number;
  evaluations: number;
  converged: boolean;
}

export type GenerationCallback = (
  generation: number,
  bestFitness: number,
  avgFitness: number,
  infeasibleCount: number
) => void;

/**
 * Genetic Algorithm Optimizer with:
 * - Tournament selection
 * - Uniform crossover
 * - Gaussian mutation
 * - Elitism
 * - Random restarts
 */
export class GeneticOptimizer {
  private populationSize: number;
  private generations: number;
  private mutationProb: number;
  private random: SeededRandom;
  private eliteCount: number;
  private tournamentSize: number;

  constructor(
    populationSize: number = 40,
    generations: number = 8,
    mutationProb: number = 0.05,
    seed: number = 42
  ) {
    this.populationSize = populationSize;
    this.generations = generations;
    this.mutationProb = mutationProb;
    this.random = new SeededRandom(seed);
    this.eliteCount = Math.max(2, Math.floor(populationSize * 0.1));
    this.tournamentSize = 3;
  }

  /**
   * Initialize population with random individuals
   */
  private initializePopulation(
    geneCount: number,
    bounds: [number, number][]
  ): Individual[] {
    const population: Individual[] = [];
    
    for (let i = 0; i < this.populationSize; i++) {
      const genes: number[] = [];
      for (let j = 0; j < geneCount; j++) {
        const [min, max] = bounds[j];
        genes.push(this.random.uniform(min, max));
      }
      population.push({ genes, fitness: Infinity });
    }
    
    return population;
  }

  /**
   * Tournament selection
   */
  private tournamentSelect(population: Individual[]): Individual {
    let best: Individual | null = null;
    
    for (let i = 0; i < this.tournamentSize; i++) {
      const idx = Math.floor(this.random.random() * population.length);
      const candidate = population[idx];
      if (!best || candidate.fitness < best.fitness) {
        best = candidate;
      }
    }
    
    return best!;
  }

  /**
   * Uniform crossover between two parents
   */
  private crossover(parent1: Individual, parent2: Individual): Individual {
    const genes: number[] = [];
    
    for (let i = 0; i < parent1.genes.length; i++) {
      genes.push(this.random.random() < 0.5 ? parent1.genes[i] : parent2.genes[i]);
    }
    
    return { genes, fitness: Infinity };
  }

  /**
   * Gaussian mutation with bounds checking
   */
  private mutate(
    individual: Individual,
    bounds: [number, number][],
    mutationScale: number = 0.1
  ): Individual {
    const genes = [...individual.genes];
    
    for (let i = 0; i < genes.length; i++) {
      if (this.random.random() < this.mutationProb) {
        const [min, max] = bounds[i];
        const range = max - min;
        const mutation = this.random.gaussian(0, range * mutationScale);
        genes[i] = Math.max(min, Math.min(max, genes[i] + mutation));
      }
    }
    
    return { genes, fitness: Infinity };
  }

  /**
   * Evaluate fitness for entire population
   */
  private evaluatePopulation(
    population: Individual[],
    fitnessFunc: (individual: Individual) => number
  ): { infeasibleCount: number } {
    let infeasibleCount = 0;
    
    for (const individual of population) {
      individual.fitness = fitnessFunc(individual);
      if (individual.fitness > 1e5) {
        infeasibleCount++;
      }
    }
    
    return { infeasibleCount };
  }

  /**
   * Main optimization loop
   */
  optimize(
    fitnessFunc: (individual: Individual) => number,
    geneCount: number,
    bounds: [number, number][],
    callback?: GenerationCallback
  ): OptimizationResult {
    let population = this.initializePopulation(geneCount, bounds);
    let { infeasibleCount } = this.evaluatePopulation(population, fitnessFunc);
    let totalEvaluations = this.populationSize;
    
    // Sort by fitness
    population.sort((a, b) => a.fitness - b.fitness);
    
    let bestEver = { ...population[0], genes: [...population[0].genes] };
    let stagnationCount = 0;
    const maxStagnation = Math.ceil(this.generations / 2);

    for (let gen = 0; gen < this.generations; gen++) {
      // Report progress
      const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
      if (callback) {
        callback(gen, population[0].fitness, avgFitness, infeasibleCount);
      }

      // Check for improvement
      if (population[0].fitness < bestEver.fitness) {
        bestEver = { ...population[0], genes: [...population[0].genes] };
        stagnationCount = 0;
      } else {
        stagnationCount++;
      }

      // Early termination if stagnated
      if (stagnationCount >= maxStagnation) {
        break;
      }

      // Create new population
      const newPopulation: Individual[] = [];

      // Elitism - keep best individuals
      for (let i = 0; i < this.eliteCount; i++) {
        newPopulation.push({
          genes: [...population[i].genes],
          fitness: population[i].fitness,
        });
      }

      // Generate rest of population through selection, crossover, mutation
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.tournamentSelect(population);
        const parent2 = this.tournamentSelect(population);
        
        let child = this.crossover(parent1, parent2);
        child = this.mutate(child, bounds);
        
        newPopulation.push(child);
      }

      population = newPopulation;
      const evalResult = this.evaluatePopulation(population, fitnessFunc);
      infeasibleCount = evalResult.infeasibleCount;
      totalEvaluations += this.populationSize;

      // Sort by fitness
      population.sort((a, b) => a.fitness - b.fitness);

      // Update best ever
      if (population[0].fitness < bestEver.fitness) {
        bestEver = { ...population[0], genes: [...population[0].genes] };
      }
    }

    return {
      best: bestEver,
      generations: this.generations,
      evaluations: totalEvaluations,
      converged: stagnationCount >= maxStagnation,
    };
  }

  /**
   * Multi-start optimization with random restarts
   */
  optimizeWithRestarts(
    fitnessFunc: (individual: Individual) => number,
    geneCount: number,
    bounds: [number, number][],
    restarts: number = 5,
    callback?: GenerationCallback
  ): OptimizationResult {
    let bestResult: OptimizationResult | null = null;

    for (let r = 0; r < restarts; r++) {
      // Re-seed random for diversity
      this.random = new SeededRandom(this.random.nextInt(0, 1e9));
      
      const result = this.optimize(fitnessFunc, geneCount, bounds, callback);
      
      if (!bestResult || result.best.fitness < bestResult.best.fitness) {
        bestResult = result;
      }
    }

    return bestResult!;
  }
}

/**
 * Differential Evolution variant for comparison
 */
export class DifferentialEvolution {
  private populationSize: number;
  private generations: number;
  private F: number;  // Mutation factor
  private CR: number; // Crossover rate
  private random: SeededRandom;

  constructor(
    populationSize: number = 40,
    generations: number = 8,
    F: number = 0.8,
    CR: number = 0.9,
    seed: number = 42
  ) {
    this.populationSize = populationSize;
    this.generations = generations;
    this.F = F;
    this.CR = CR;
    this.random = new SeededRandom(seed);
  }

  optimize(
    fitnessFunc: (individual: Individual) => number,
    geneCount: number,
    bounds: [number, number][],
    callback?: GenerationCallback
  ): OptimizationResult {
    // Initialize population
    const population: Individual[] = [];
    for (let i = 0; i < this.populationSize; i++) {
      const genes: number[] = [];
      for (let j = 0; j < geneCount; j++) {
        const [min, max] = bounds[j];
        genes.push(this.random.uniform(min, max));
      }
      const ind: Individual = { genes, fitness: fitnessFunc({ genes, fitness: 0 }) };
      population.push(ind);
    }

    let bestEver = population.reduce((best, ind) => 
      ind.fitness < best.fitness ? ind : best
    );

    for (let gen = 0; gen < this.generations; gen++) {
      let infeasibleCount = 0;

      for (let i = 0; i < this.populationSize; i++) {
        // Select three random distinct individuals
        const indices = new Set<number>();
        while (indices.size < 3) {
          const idx = Math.floor(this.random.random() * this.populationSize);
          if (idx !== i) indices.add(idx);
        }
        const [a, b, c] = Array.from(indices);

        // Mutation
        const mutant: number[] = [];
        for (let j = 0; j < geneCount; j++) {
          const [min, max] = bounds[j];
          let val = population[a].genes[j] + this.F * (population[b].genes[j] - population[c].genes[j]);
          val = Math.max(min, Math.min(max, val));
          mutant.push(val);
        }

        // Crossover
        const trial: number[] = [];
        const jRand = Math.floor(this.random.random() * geneCount);
        for (let j = 0; j < geneCount; j++) {
          if (this.random.random() < this.CR || j === jRand) {
            trial.push(mutant[j]);
          } else {
            trial.push(population[i].genes[j]);
          }
        }

        // Selection
        const trialFitness = fitnessFunc({ genes: trial, fitness: 0 });
        if (trialFitness > 1e5) infeasibleCount++;
        
        if (trialFitness < population[i].fitness) {
          population[i] = { genes: trial, fitness: trialFitness };
          if (trialFitness < bestEver.fitness) {
            bestEver = { genes: [...trial], fitness: trialFitness };
          }
        }
      }

      const avgFitness = population.reduce((sum, ind) => sum + ind.fitness, 0) / population.length;
      if (callback) {
        callback(gen, bestEver.fitness, avgFitness, infeasibleCount);
      }
    }

    return {
      best: bestEver,
      generations: this.generations,
      evaluations: this.populationSize * this.generations,
      converged: true,
    };
  }
}
