import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { SimulationState, SlotResult } from '@/types/experiment';

interface RealtimeChartsProps {
  state: SimulationState;
  selectedSensors: Set<string>;
}

export function RealtimeCharts({ state, selectedSensors }: RealtimeChartsProps) {
  // Prepare queue backlog data
  const backlogData = useMemo(() => {
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(state.tsra_results.length / maxPoints));
    
    return state.tsra_results
      .filter((_, i) => i % step === 0)
      .map((tsra, i) => {
        const ptsra = state.ptsra_results[i * step];
        const tsraBacklog = tsra.sensor_results.reduce(
          (sum, s) => sum + s.H_l + s.H_o + s.H_k, 0
        );
        const ptsraBacklog = ptsra?.sensor_results.reduce(
          (sum, s) => sum + s.H_l + s.H_o + s.H_k, 0
        ) || 0;
        
        return {
          slot: tsra.slot,
          TSRA: tsraBacklog,
          'P-TSRA': ptsraBacklog,
        };
      });
  }, [state.tsra_results, state.ptsra_results]);

  // Prepare cumulative energy data
  const energyData = useMemo(() => {
    let tsraCumulative = 0;
    let ptsraCumulative = 0;
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(state.tsra_results.length / maxPoints));
    
    return state.tsra_results
      .filter((_, i) => i % step === 0)
      .map((tsra, i) => {
        const ptsra = state.ptsra_results[i * step];
        
        // Sum energy for skipped slots
        for (let j = (i > 0 ? (i - 1) * step + 1 : 0); j <= i * step && j < state.tsra_results.length; j++) {
          tsraCumulative += state.tsra_results[j].global_metrics.total_energy_J;
          if (state.ptsra_results[j]) {
            ptsraCumulative += state.ptsra_results[j].global_metrics.total_energy_J;
          }
        }
        
        return {
          slot: tsra.slot,
          TSRA: tsraCumulative,
          'P-TSRA': ptsraCumulative,
        };
      });
  }, [state.tsra_results, state.ptsra_results]);

  // Per-sensor alpha heatmap data (latest N slots)
  const alphaData = useMemo(() => {
    const lastN = 50;
    const start = Math.max(0, state.ptsra_results.length - lastN);
    
    return state.ptsra_results.slice(start).map((result) => {
      const data: Record<string, number | string> = { slot: result.slot };
      result.sensor_results.forEach((sensor) => {
        if (selectedSensors.has(sensor.id)) {
          data[sensor.id] = sensor.alpha;
        }
      });
      return data;
    });
  }, [state.ptsra_results, selectedSensors]);

  // Per-sensor queue comparison
  const perSensorData = useMemo(() => {
    if (state.ptsra_results.length === 0) return [];
    const latest = state.ptsra_results[state.ptsra_results.length - 1];
    const tsraLatest = state.tsra_results[state.tsra_results.length - 1];
    
    return latest.sensor_results
      .filter(s => selectedSensors.has(s.id))
      .map((ptsraSensor) => {
        const tsraSensor = tsraLatest.sensor_results.find(s => s.id === ptsraSensor.id);
        return {
          id: ptsraSensor.id,
          'TSRA Queue': tsraSensor ? tsraSensor.H_l + tsraSensor.H_o + tsraSensor.H_k : 0,
          'P-TSRA Queue': ptsraSensor.H_l + ptsraSensor.H_o + ptsraSensor.H_k,
          'TSRA Energy': tsraSensor ? (tsraSensor.local_energy_J + tsraSensor.tx_energy_J) * 1000 : 0,
          'P-TSRA Energy': (ptsraSensor.local_energy_J + ptsraSensor.tx_energy_J) * 1000,
        };
      });
  }, [state.ptsra_results, state.tsra_results, selectedSensors]);

  const chartColors = {
    tsra: 'hsl(var(--chart-1))',
    ptsra: 'hsl(var(--chart-4))',
    sensor1: 'hsl(var(--chart-1))',
    sensor2: 'hsl(var(--chart-2))',
    sensor3: 'hsl(var(--chart-3))',
    sensor4: 'hsl(var(--chart-4))',
    sensor5: 'hsl(var(--chart-5))',
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comparison" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comparison">Algorithm Comparison</TabsTrigger>
          <TabsTrigger value="energy">Energy Analysis</TabsTrigger>
          <TabsTrigger value="alpha">Alpha Heatmap</TabsTrigger>
          <TabsTrigger value="sensors">Per-Sensor</TabsTrigger>
        </TabsList>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Queue Backlog Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Queue Backlog (bits)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={backlogData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="slot" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}`}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v}
                    />
                    <Tooltip 
                      formatter={(value: number) => value.toFixed(0)}
                      labelFormatter={(label) => `Slot ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="TSRA" 
                      stroke={chartColors.tsra}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="P-TSRA" 
                      stroke={chartColors.ptsra}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cumulative Energy Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cumulative Energy (J)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={energyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="slot" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => v.toFixed(2)}
                    />
                    <Tooltip 
                      formatter={(value: number) => value.toFixed(4)}
                      labelFormatter={(label) => `Slot ${label}`}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="TSRA" 
                      stroke={chartColors.tsra}
                      fill={chartColors.tsra}
                      fillOpacity={0.3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="P-TSRA" 
                      stroke={chartColors.ptsra}
                      fill={chartColors.ptsra}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Energy Tab */}
        <TabsContent value="energy" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per-Slot Energy Consumption</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={backlogData.map((_, i) => {
                    const tsra = state.tsra_results[i];
                    const ptsra = state.ptsra_results[i];
                    return {
                      slot: tsra?.slot || i,
                      TSRA: (tsra?.global_metrics.total_energy_J || 0) * 1000,
                      'P-TSRA': (ptsra?.global_metrics.total_energy_J || 0) * 1000,
                    };
                  }).filter(d => d.slot !== undefined)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="slot" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'mJ', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(4)} mJ`} />
                    <Legend />
                    <Line type="monotone" dataKey="TSRA" stroke={chartColors.tsra} dot={false} />
                    <Line type="monotone" dataKey="P-TSRA" stroke={chartColors.ptsra} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Latest Energy by Sensor (mJ)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={perSensorData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="id" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="TSRA Energy" fill={chartColors.tsra} />
                    <Bar dataKey="P-TSRA Energy" fill={chartColors.ptsra} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alpha Heatmap Tab */}
        <TabsContent value="alpha" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Offload Fraction (α) Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={alphaData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="slot" tick={{ fontSize: 12 }} />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    domain={[0, 1]}
                    label={{ value: 'α', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value: number) => value.toFixed(3)} />
                  <Legend />
                  {Array.from(selectedSensors).map((sensorId, index) => (
                    <Line
                      key={sensorId}
                      type="monotone"
                      dataKey={sensorId}
                      stroke={Object.values(chartColors)[index % 5]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-Sensor Tab */}
        <TabsContent value="sensors" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current Queue Backlog by Sensor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={perSensorData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="id" tick={{ fontSize: 12 }} />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v}
                  />
                  <Tooltip 
                    formatter={(value: number) => value.toFixed(0)}
                  />
                  <Legend />
                  <Bar dataKey="TSRA Queue" fill={chartColors.tsra} />
                  <Bar dataKey="P-TSRA Queue" fill={chartColors.ptsra} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
