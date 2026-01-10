/**
 * Event emitter for streaming events to WebSocket clients
 * Supports user-specific event filtering for multi-user environments
 */

import type { EventType, EventCallback } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const logger = createLogger('Events');

// Re-export event types from shared package
export type { EventType, EventCallback };

/**
 * Event payload with optional user targeting
 * If targetUser is set, only connections for that user receive the event
 */
export interface UserTargetedPayload {
  targetUser?: string;
  [key: string]: unknown;
}

/**
 * Callback with user filtering support
 * username parameter indicates which user this callback is for (null = all users)
 */
export type UserAwareCallback = (type: EventType, payload: unknown, targetUser?: string) => void;

export interface EventEmitter {
  emit: (type: EventType, payload: unknown) => void;
  subscribe: (callback: EventCallback) => () => void;
  /** Subscribe with user filtering - callback receives targetUser for filtering */
  subscribeWithUserFilter: (callback: UserAwareCallback) => () => void;
}

export function createEventEmitter(): EventEmitter {
  const subscribers = new Set<EventCallback>();
  const userAwareSubscribers = new Set<UserAwareCallback>();

  return {
    emit(type: EventType, payload: unknown) {
      // Extract targetUser from payload if present
      const targetUser = (payload as UserTargetedPayload)?.targetUser;

      // Notify regular subscribers (backwards compatible)
      for (const callback of subscribers) {
        try {
          callback(type, payload);
        } catch (error) {
          logger.error('Error in event subscriber:', error);
        }
      }

      // Notify user-aware subscribers with targetUser info
      for (const callback of userAwareSubscribers) {
        try {
          callback(type, payload, targetUser);
        } catch (error) {
          logger.error('Error in user-aware event subscriber:', error);
        }
      }
    },

    subscribe(callback: EventCallback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },

    subscribeWithUserFilter(callback: UserAwareCallback) {
      userAwareSubscribers.add(callback);
      return () => {
        userAwareSubscribers.delete(callback);
      };
    },
  };
}
