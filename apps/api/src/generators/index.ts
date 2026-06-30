import type { BracketGenerator } from './types';
import { SingleElimGenerator } from './single-elimination';
import { DoubleElimGenerator } from './double-elimination';
import { RoundRobinGenerator } from './round-robin';
import { SwissGenerator } from './swiss';

export type { BracketGenerator, BracketSettings, GenerateResult } from './types';
export { SingleElimGenerator } from './single-elimination';
export { DoubleElimGenerator } from './double-elimination';
export { RoundRobinGenerator } from './round-robin';
export { SwissGenerator } from './swiss';

export function getGenerator(format: string): BracketGenerator {
  switch (format) {
    case 'single_elim':
      return new SingleElimGenerator();
    case 'double_elim':
      return new DoubleElimGenerator();
    case 'round_robin':
      return new RoundRobinGenerator();
    case 'swiss':
      return new SwissGenerator();
    default:
      throw new Error(`不支持的赛制: ${format}`);
  }
}
