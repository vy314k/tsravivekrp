import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, Clock, TrendingDown, AlertTriangle } from 'lucide-react';
import { OptimizerLogEntry, SimulationState } from '@/types/experiment';

interface OptimizerProgressProps {
  state: SimulationState;
  currentSlot: number;
  totalSlots: number;
}

export function OptimizerProgress({ state, currentSlot, totalSlots }: OptimizerProgressProps) {
  const progress = (currentSlot / totalSlots) * 100;
  
  // Get latest optimizer logs grouped by slot
  const latestLogs = useMemo(() => {
    const logs = state.optimizer_log.slice(-100);
    return logs;
  }, [state.optimizer_log]);

  // Fitness convergence data
  const fitnessData = useMemo(() => {
    const bySlot = new Map<number, OptimizerLogEntry[]>();
    for (const log of state.optimizer_log) {
      if (!bySlot.has(log.slot)) {
        bySlot.set(log.slot, []);
      }
      bySlot.get(log.slot)!.push(log);
    }

    return Array.from(bySlot.entries())
      .slice(-50)
      .map(([slot, logs]) => {
        const lastLog = logs[logs.length - 1];
        return {
          slot,
          best: lastLog.best_fitness,
          avg: lastLog.avg_fitness,
        };
      });
  }, [state.optimizer_log]);

  // Statistics
  const stats = useMemo(() => {
    if (state.optimizer_log.length === 0) {
      return { avgTime: 0, totalInfeasible: 0, avgGenerations: 0 };
    }

    const avgTime = state.optimizer_log.reduce((sum, l) => sum + l.elapsed_ms, 0) / state.optimizer_log.length;
    const totalInfeasible = state.optimizer_log.reduce((sum, l) => sum + l.infeasible_count, 0);
    const uniqueSlots = new Set(state.optimizer_log.map(l => l.slot)).size;
    const avgGenerations = state.optimizer_log.length / Math.max(1, uniqueSlots);

    return { avgTime, totalInfeasible, avgGenerations };
  }, [state.optimizer_log]);

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Simulation Progress
            </CardTitle>
            <Badge variant={state.status === 'running' ? 'default' : 'secondary'}>
              {state.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Slot {currentSlot} / {totalSlots}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Avg Time</span>
              </div>
              <p className="text-lg font-semibold">{stats.avgTime.toFixed(1)} ms</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs">Avg Gens</span>
              </div>
              <p className="text-lg font-semibold">{stats.avgGenerations.toFixed(1)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Infeasible</span>
              </div>
              <p className="text-lg font-semibold">{stats.totalInfeasible}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fitness Convergence */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">GA Fitness Convergence</CardTitle>
          <CardDescription>Best and average fitness over slots</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fitnessData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="slot" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => value.toFixed(2)} />
              <Line 
                type="monotone" 
                dataKey="best" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                dot={false}
                name="Best Fitness"
              />
              <Line 
                type="monotone" 
                dataKey="avg" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={1}
                dot={false}
                name="Avg Fitness"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Live Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Optimizer Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1 font-mono text-xs">
              {latestLogs.slice(-30).reverse().map((log, i) => (
                <div 
                  key={`${log.slot}-${log.generation}-${i}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <span className="w-16 text-primary">slot:{log.slot}</span>
                  <span className="w-12">gen:{log.generation}</span>
                  <span className="w-24">best:{log.best_fitness.toFixed(2)}</span>
                  <span className="w-20">{log.elapsed_ms}ms</span>
                  {log.infeasible_count > 0 && (
                    <Badge variant="destructive" className="h-4 text-[10px]">
                      {log.infeasible_count} infeas
                    </Badge>
                  )}
                </div>
              ))}
              {latestLogs.length === 0 && (
                <p className="text-muted-foreground">No optimizer logs yet...</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
