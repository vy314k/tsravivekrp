import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Minus, Zap, Clock, Database } from 'lucide-react';
import { SimulationState } from '@/types/experiment';
import { generateSummary, exportToCSV } from '@/lib/algorithms/simulator';

interface ResultsSummaryProps {
  state: SimulationState;
}

export function ResultsSummary({ state }: ResultsSummaryProps) {
  const summary = generateSummary(state);

  const handleExport = () => {
    const csv = exportToCSV(state);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-results-${state.run_id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTrendIcon = (improvement: number) => {
    if (improvement > 5) return <TrendingDown className="h-4 w-4 text-green-500" />;
    if (improvement < -5) return <TrendingUp className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatImprovement = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Simulation Results</h3>
          <p className="text-sm text-muted-foreground">
            Run ID: {state.run_id.slice(0, 8)} • {state.total_slots} slots completed
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Improvement Summary */}
      <Card className="border-primary/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">P-TSRA Improvements over TSRA</CardTitle>
          <CardDescription>
            Comparison of key metrics between baseline TSRA and predictive P-TSRA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Queue Backlog</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatImprovement(summary.improvement.backlog_reduction_pct)}
                  </span>
                  {getTrendIcon(summary.improvement.backlog_reduction_pct)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Energy Consumption</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatImprovement(summary.improvement.energy_reduction_pct)}
                  </span>
                  {getTrendIcon(summary.improvement.energy_reduction_pct)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Latency</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatImprovement(summary.improvement.latency_reduction_pct)}
                  </span>
                  {getTrendIcon(summary.improvement.latency_reduction_pct)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* TSRA Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">TSRA (Baseline)</CardTitle>
              <Badge variant="outline">Reference</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Average Queue Backlog</dt>
                <dd className="font-mono font-medium">
                  {summary.tsra.avg_backlog >= 1e6 
                    ? `${(summary.tsra.avg_backlog / 1e6).toFixed(2)} Mb`
                    : `${(summary.tsra.avg_backlog / 1e3).toFixed(2)} kb`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Energy</dt>
                <dd className="font-mono font-medium">
                  {summary.tsra.total_energy.toFixed(4)} J
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Energy per Slot</dt>
                <dd className="font-mono font-medium">
                  {(summary.tsra.energy_per_slot * 1000).toFixed(4)} mJ
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Average Latency</dt>
                <dd className="font-mono font-medium">
                  {summary.tsra.avg_latency.toFixed(2)} ms
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* P-TSRA Stats */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">P-TSRA (Predictive)</CardTitle>
              <Badge>Optimized</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Average Queue Backlog</dt>
                <dd className="font-mono font-medium">
                  {summary.ptsra.avg_backlog >= 1e6 
                    ? `${(summary.ptsra.avg_backlog / 1e6).toFixed(2)} Mb`
                    : `${(summary.ptsra.avg_backlog / 1e3).toFixed(2)} kb`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Energy</dt>
                <dd className="font-mono font-medium">
                  {summary.ptsra.total_energy.toFixed(4)} J
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Energy per Slot</dt>
                <dd className="font-mono font-medium">
                  {(summary.ptsra.energy_per_slot * 1000).toFixed(4)} mJ
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Average Latency</dt>
                <dd className="font-mono font-medium">
                  {summary.ptsra.avg_latency.toFixed(2)} ms
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Citation Notice */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>Research Citation:</strong> This simulation implements algorithms from 
            "Optimal Task Scheduling and Resource Allocation for Self-Powered Sensors in IoT" 
            (Xu et al., IEEE TNSM 2024) with P-TSRA extensions from Vivek Yadav's research.
          </p>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/docs/base-paper.pdf" target="_blank" rel="noopener">
                Base Paper (TSRA)
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/docs/p-tsra-slides.pdf" target="_blank" rel="noopener">
                P-TSRA Slides
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
