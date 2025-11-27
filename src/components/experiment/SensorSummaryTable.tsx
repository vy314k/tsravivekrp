import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SensorConfig } from '@/types/experiment';

interface SensorSummaryTableProps {
  sensors: SensorConfig[];
  selectedSensors: Set<string>;
  onToggleSelection: (sensorId: string) => void;
}

export function SensorSummaryTable({
  sensors,
  selectedSensors,
  onToggleSelection,
}: SensorSummaryTableProps) {
  const formatNumber = (n: number, decimals: number = 2) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(decimals)}G`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}k`;
    return n.toFixed(decimals);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Plot</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>J_mean</TableHead>
            <TableHead>Battery</TableHead>
            <TableHead>Harvest</TableHead>
            <TableHead>f_max</TableHead>
            <TableHead>p_max</TableHead>
            <TableHead>Mode</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sensors.map((sensor) => (
            <TableRow key={sensor.id}>
              <TableCell>
                <Checkbox
                  checked={selectedSensors.has(sensor.id)}
                  onCheckedChange={() => onToggleSelection(sensor.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{sensor.id}</TableCell>
              <TableCell>{formatNumber(sensor.J_mean_bits_per_slot)}b/s</TableCell>
              <TableCell>{sensor.battery_J.toFixed(2)} J</TableCell>
              <TableCell>{formatNumber(sensor.harvest_mean_J_per_slot * 1000, 1)} mJ/s</TableCell>
              <TableCell>{formatNumber(sensor.f_max_Hz)}Hz</TableCell>
              <TableCell>{formatNumber(sensor.p_max_W * 1000, 0)} mW</TableCell>
              <TableCell>
                <Badge variant={sensor.offload_mode === 'fractional' ? 'default' : 'secondary'}>
                  {sensor.offload_mode}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
