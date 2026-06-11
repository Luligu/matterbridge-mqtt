import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Fragment, useState } from 'react';

import { type ApiDevice, type DeviceEntry } from './api.ts';
import { formatJson, formatTime } from './format.ts';

type CellKind = 'config' | 'state' | 'subscribe';
const KINDS: CellKind[] = ['config', 'state', 'subscribe'];

interface ExpandedCell {
  deviceId: string;
  kind: CellKind;
}

/**
 * A single config/state/subscribe table cell showing a status dot, the last-updated time and an expand affordance.
 *
 * @param props - The cell props.
 * @param props.entry - The retained payload entry, or null when none has been received.
 * @param props.selected - Whether this cell is the currently expanded one.
 * @param props.onClick - Click handler that toggles the expanded payload.
 * @returns The rendered table cell.
 */
function PayloadCell({ entry, selected, onClick }: { entry: DeviceEntry | null; selected: boolean; onClick: () => void }) {
  if (!entry) {
    return (
      <TableCell>
        <Typography variant="body2" color="text.disabled">
          —
        </Typography>
      </TableCell>
    );
  }
  return (
    <TableCell onClick={onClick} sx={{ cursor: 'pointer', userSelect: 'none', bgcolor: selected ? 'action.selected' : undefined }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {formatTime(entry.time)}
        </Typography>
        <ExpandMoreIcon fontSize="small" sx={{ ml: 'auto', color: 'action.active', transition: 'transform 0.2s', transform: selected ? 'rotate(180deg)' : 'none' }} />
      </Box>
    </TableCell>
  );
}

/**
 * The expanded payload detail rendered as a full-width row beneath a device.
 *
 * @param props - The detail props.
 * @param props.device - The device the payload belongs to.
 * @param props.kind - The subTopic being shown.
 * @param props.entry - The retained payload entry.
 * @returns The rendered payload detail.
 */
function PayloadDetail({ device, kind, entry }: { device: ApiDevice; kind: CellKind; entry: DeviceEntry }) {
  return (
    <Box sx={{ my: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {device.deviceId} · {kind} · endpoint {entry.endpointName} · {formatTime(entry.time)}
      </Typography>
      <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: 12, overflow: 'auto' }}>
        {formatJson(entry.payload)}
      </Box>
    </Box>
  );
}

/**
 * Renders the devices table with expandable config/state/subscribe payload cells.
 *
 * @param props - The table props.
 * @param props.devices - The devices to render.
 * @returns The rendered devices table.
 */
export function DevicesTable({ devices }: { devices: ApiDevice[] }) {
  const [expanded, setExpanded] = useState<ExpandedCell | null>(null);

  const toggle = (deviceId: string, kind: CellKind) => {
    setExpanded((prev) => (prev && prev.deviceId === deviceId && prev.kind === kind ? null : { deviceId, kind }));
  };

  if (devices.length === 0) {
    return (
      <Typography sx={{ p: 2 }} color="text.secondary">
        No devices received yet.
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Device</TableCell>
            <TableCell>Config</TableCell>
            <TableCell>State</TableCell>
            <TableCell>Subscribe</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {devices.map((device) => {
            const exp = expanded && expanded.deviceId === device.deviceId ? expanded : null;
            const detailEntry = exp ? device[exp.kind] : null;
            return (
              <Fragment key={device.deviceId}>
                <TableRow hover>
                  <TableCell>
                    <Typography variant="body2">{device.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {device.deviceId}
                    </Typography>
                  </TableCell>
                  {KINDS.map((kind) => (
                    <PayloadCell key={kind} entry={device[kind]} selected={exp?.kind === kind} onClick={() => toggle(device.deviceId, kind)} />
                  ))}
                </TableRow>
                {exp && detailEntry && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0, borderBottom: 0 }}>
                      <Collapse in timeout="auto" unmountOnExit>
                        <PayloadDetail device={device} kind={exp.kind} entry={detailEntry} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
