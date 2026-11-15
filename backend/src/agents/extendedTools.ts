/**
 * File README
 * What this file does: re-exports the deterministic network trace and log analyzer tools as a unified tool array.
 * Why it exists: preserves backward compatibility with modules importing extendedTools while keeping tool implementations modular.
 */
import { logAnalyzerTool } from './tools/logAnalyzerTool.js';
import { networkTraceTool } from './tools/networkTraceTool.js';

export { logAnalyzerTool, networkTraceTool };
export const extendedTools = [networkTraceTool, logAnalyzerTool];
