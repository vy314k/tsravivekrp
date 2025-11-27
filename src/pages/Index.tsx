import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cpu, BarChart3, Settings, FileText, Github } from 'lucide-react';
import { ExperimentBuilder } from '@/components/experiment/ExperimentBuilder';
import { RealtimeCharts } from '@/components/visualization/RealtimeCharts';
import { OptimizerProgress } from '@/components/visualization/OptimizerProgress';
import { ResultsSummary } from '@/components/visualization/ResultsSummary';
import { ExperimentConfig, SimulationState } from '@/types/experiment';
import { runSimulation } from '@/lib/algorithms/simulator';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [simulationState, setSimulationState] = useState<SimulationState | null>(null);
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set());

  const handleStartExperiment = useCallback(async (config: ExperimentConfig) => {
    setIsRunning(true);
    setActiveTab('visualization');
    setSelectedSensors(new Set(config.sensors.slice(0, 3).map(s => s.id)));
    
    toast({
      title: 'Simulation started',
      description: `Running ${config.slots} slots with ${config.sensors.length} sensors`,
    });

    try {
      const state = await runSimulation(
        config,
        (state) => {
          setSimulationState({ ...state });
        },
        (sensorId, entry) => {
          // Optimizer log callback - already handled in state
        }
      );
      
      setSimulationState(state);
      toast({
        title: 'Simulation complete',
        description: 'View results in the Results tab',
      });
      setActiveTab('results');
    } catch (error) {
      toast({
        title: 'Simulation error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cpu className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">IoT Task Scheduling Research Platform</h1>
                <p className="text-sm text-muted-foreground">TSRA vs P-TSRA Algorithm Comparison</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <Badge variant="default" className="animate-pulse">
                  Running...
                </Badge>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href="/docs/base-paper.pdf" target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  Paper
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Experiment Builder
            </TabsTrigger>
            <TabsTrigger value="visualization" className="flex items-center gap-2" disabled={!simulationState}>
              <BarChart3 className="h-4 w-4" />
              Live Visualization
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2" disabled={!simulationState || simulationState.status !== 'completed'}>
              <FileText className="h-4 w-4" />
              Results
            </TabsTrigger>
          </TabsList>

          {/* Experiment Builder Tab */}
          <TabsContent value="builder">
            <ExperimentBuilder 
              onStartExperiment={handleStartExperiment}
              isRunning={isRunning}
            />
          </TabsContent>

          {/* Visualization Tab */}
          <TabsContent value="visualization">
            {simulationState && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RealtimeCharts 
                    state={simulationState}
                    selectedSensors={selectedSensors}
                  />
                </div>
                <div>
                  <OptimizerProgress
                    state={simulationState}
                    currentSlot={simulationState.current_slot}
                    totalSlots={simulationState.total_slots}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {simulationState && simulationState.status === 'completed' && (
              <ResultsSummary state={simulationState} />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Based on "Optimal Task Scheduling and Resource Allocation for Self-Powered Sensors in IoT" 
            (Xu et al., IEEE TNSM 2024) • P-TSRA by Vivek Yadav, NIT Rourkela
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
