/**
 * Chat Module Unit Tests
 */

import {
  sanitizeMessageText,
  getMessagePreviewText,
  isWithinEditWindow,
  isMessageVisibleToUser,
} from '../../src/modules/chat/chat.helpers';
import mongoose from 'mongoose';
import type { IMessageDocument } from '../../src/modules/chat/message.model';

describe('Chat Helpers', () => {
  describe('sanitizeMessageText', () => {
    it('escapes HTML-like characters', () => {
      expect(sanitizeMessageText('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      );
    });

    it('trims whitespace', () => {
      expect(sanitizeMessageText('  hello  ')).toBe('hello');
    });
  });

  describe('getMessagePreviewText', () => {
    it('returns Photo for image type', () => {
      expect(getMessagePreviewText('image')).toBe('Photo');
    });

    it('returns Document for file type', () => {
      expect(getMessagePreviewText('file')).toBe('Document');
    });

    it('returns Audio for audio type', () => {
      expect(getMessagePreviewText('audio')).toBe('Audio');
    });

    it('truncates long text previews', () => {
      const longText = 'a'.repeat(250);
      expect(getMessagePreviewText('text', longText)).toHaveLength(200);
    });
  });

  describe('isWithinEditWindow', () => {
    it('returns true for recent messages', () => {
      const message = {
        sentAt: new Date(Date.now() - 5 * 60 * 1000),
      } as unknown as IMessageDocument;
      expect(isWithinEditWindow(message)).toBe(true);
    });

    it('returns false for messages older than 15 minutes', () => {
      const message = {
        sentAt: new Date(Date.now() - 20 * 60 * 1000),
      } as unknown as IMessageDocument;
      expect(isWithinEditWindow(message)).toBe(false);
    });
  });

  describe('isMessageVisibleToUser', () => {
    const userId = new mongoose.Types.ObjectId().toString();

    it('hides messages deleted for user', () => {
      const message = {
        deletedFor: [new mongoose.Types.ObjectId(userId)],
        deletedAt: null,
        senderId: new mongoose.Types.ObjectId(),
      } as unknown as IMessageDocument;
      expect(isMessageVisibleToUser(message, userId)).toBe(false);
    });

    it('shows sender their own deleted-for-everyone message', () => {
      const senderId = new mongoose.Types.ObjectId(userId);
      const message = {
        deletedFor: [],
        deletedAt: new Date(),
        senderId,
      } as unknown as IMessageDocument;
      expect(isMessageVisibleToUser(message, userId)).toBe(true);
    });
  });
});
