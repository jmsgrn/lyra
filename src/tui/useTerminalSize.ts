/** Track the terminal size (columns × rows), updating on resize. */
import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

export interface TerminalSize {
  columns: number;
  rows: number;
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns ?? DEFAULT_COLUMNS,
    rows: stdout?.rows ?? DEFAULT_ROWS,
  });

  useEffect(() => {
    if (!stdout?.on) return;
    const onResize = () =>
      setSize({ columns: stdout.columns ?? DEFAULT_COLUMNS, rows: stdout.rows ?? DEFAULT_ROWS });
    stdout.on('resize', onResize);
    return () => {
      stdout.off?.('resize', onResize);
    };
  }, [stdout]);

  return size;
}

export function useColumns(): number {
  return useTerminalSize().columns;
}
