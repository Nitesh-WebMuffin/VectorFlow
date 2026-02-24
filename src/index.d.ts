declare type VectorFlowEvent = 'stateChange' | 'actionStart' | 'actionEnd' | 'error';

declare interface VectorFlowOptions {
  /** An SVG DOM element or raw SVG string */
  svgElement: SVGElement | string;
  /** VectorFlow JSON config (object or string) */
  json: VectorFlowConfig | string;
}

declare interface VectorFlowConfig {
  name?: string;
  initial_state: string;
  ms?: number;
  routes: Record<string, VectorFlowRoute>;
  actions: Record<string, VectorFlowAction>;
}

declare interface VectorFlowRoute {
  ms?: number;
  [sourceState: string]: string[] | number | undefined;
}

declare interface VectorFlowAction {
  type?: 'sequence' | 'loop';
  order: string[];
  ms?: number;
  count?: number;
  mode?: 'direct';
}

declare class VectorFlow {
  constructor(options: VectorFlowOptions);

  /** All discovered state names */
  readonly states: string[];
  /** Current active state */
  readonly currentState: string;
  /** Actions config from JSON */
  readonly actions: Record<string, VectorFlowAction>;
  /** The SVG element being animated */
  readonly svgElement: SVGElement;
  /** Whether an action is currently playing */
  readonly isPlaying: boolean;
  /** Name of the currently playing action */
  readonly currentAction: string | null;

  /** Play a named action. Auto-cancels any running action. */
  play(actionName: string): Promise<void>;
  /** Cancel current playback immediately. */
  stop(): void;
  /** Register an event listener. */
  on(event: 'stateChange', callback: (state: string) => void): this;
  on(event: 'actionStart', callback: (actionName: string) => void): this;
  on(event: 'actionEnd', callback: (actionName: string) => void): this;
  on(event: 'error', callback: (error: Error) => void): this;
  /** Remove an event listener. */
  off(event: VectorFlowEvent, callback: (...args: any[]) => void): this;
  /** Clean up: stop playback, restore SVG, remove listeners. */
  destroy(): void;
}

export default VectorFlow;
export { VectorFlow, VectorFlowOptions, VectorFlowConfig, VectorFlowRoute, VectorFlowAction, VectorFlowEvent };
