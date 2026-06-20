import { EventEmitter } from 'events';
import type { DAGEvent } from './types';

/**
 * In-process pub/sub bus.  Coordinator emits events; WebSocket handler subscribes per taskId.
 */
class EventBus extends EventEmitter {
  emit(taskId: string, event: DAGEvent): boolean {
    return super.emit(taskId, event);
  }

  subscribe(taskId: string, handler: (e: DAGEvent) => void): () => void {
    this.on(taskId, handler);
    return () => this.off(taskId, handler);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(100);
