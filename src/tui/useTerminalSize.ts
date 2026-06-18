/** Track the terminal width (columns), updating on resize. */
import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

const DEFAULT_COLUMNS = 80;

export function useColumns(): number {
  const { stdout } = useStdout();
  const [columns, setColumns] = useState(stdout?.columns ?? DEFAULT_COLUMNS);

  useEffect(() => {
    if (!stdout?.on) return;
    const onResize = () => setColumns(stdout.columns ?? DEFAULT_COLUMNS);
    stdout.on('resize', onResize);
    return () => {
      stdout.off?.('resize', onResize);
    };
  }, [stdout]);

  return columns;
}
