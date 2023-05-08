import { Context } from '@actions/github/lib/context';
import {
  getEventTrigger,
  getIssueNumber,
  isIssueCommentEvent,
  isIssueEvent,
  isPullRequestCommentEvent,
  isPullRequestEvent,
} from '../utils';

describe('utils', () => {
  describe('isIssueEvent', () => {
    it('should return true if the event is an issue event', () => {
      const context: Context = { eventName: 'issues', payload: {} } as any;
      expect(isIssueEvent(context)).toBe(true);
    });

    it('should return false if the event is not an issue event', () => {
      const context: Context = { eventName: 'pull_request', payload: {} } as any;
      expect(isIssueEvent(context)).toBe(false);
    });
  });

  describe('isPullRequestEvent', () => {
    it('should return true if the event is a pull request event', () => {
      const context: Context = { eventName: 'pull_request', payload: {} } as any;
      expect(isPullRequestEvent(context)).toBe(true);
    });

    it('should return false if the event is not a pull request event', () => {
      const context: Context = { eventName: 'issues', payload: {} } as any;
      expect(isPullRequestEvent(context)).toBe(false);
    });
  });

  describe('isIssueCommentEvent', () => {
    it('should return true if the event is an issue comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { issue: {} } } as any;
      expect(isIssueCommentEvent(context)).toBe(true);
    });

    it('should return false if the event is not an issue comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { issue: { pull_request: {} } } } as any;
      expect(isIssueCommentEvent(context)).toBe(false);
    });
  });

  describe('isPullRequestCommentEvent', () => {
    it('should return true if the event is a pull request comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { issue: { pull_request: {} } } } as any;
      expect(isPullRequestCommentEvent(context)).toBe(true);
    });

    it('should return false if the event is not a pull request comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { issue: {} } } as any;
      expect(isPullRequestCommentEvent(context)).toBe(false);
    });
  });

  describe('getEventTrigger', () => {
    it('should return the issue object if the event is an issue event', () => {
      const context: Context = { eventName: 'issues', payload: { issue: {} } } as any;
      expect(getEventTrigger(context)).toEqual({});
    });

    it('should return the pull request object if the event is a pull request event', () => {
      const context: Context = { eventName: 'pull_request', payload: { pull_request: {} } } as any;
      expect(getEventTrigger(context)).toEqual({});
    });

    it('should return the comment object if the event is an issue comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { comment: {} } } as any;
      expect(getEventTrigger(context)).toEqual({});
    });

    it('should return undefined if the event is not an issue, pull request, or comment event', () => {
      const context: Context = { eventName: 'unknown', payload: {} } as any;
      expect(getEventTrigger(context)).toBeUndefined();
    });
  });

  describe('getIssueNumber', () => {
    it('should return the issue number if the event is an issue event', () => {
      const context: Context = { eventName: 'issues', payload: { issue: { number: 42 } } } as any;
      expect(getIssueNumber(context)).toEqual(42);
    });

    it('should return the pull request number if the event is a pull request event', () => {
      const context: Context = { eventName: 'pull_request', payload: { pull_request: { number: 42 } } } as any;
      expect(getIssueNumber(context)).toEqual(42);
    });

    it('should return the issue number if the event is an issue comment event', () => {
      const context: Context = { eventName: 'issue_comment', payload: { issue: { number: 42 } } } as any;
      expect(getIssueNumber(context)).toEqual(42);
    });

    it('should return the issue number if the event is a pull request comment event', () => {
      const context: Context = {
        eventName: 'issue_comment',
        payload: { issue: { number: 42, pull_request: {} } },
      } as any;
      expect(getIssueNumber(context)).toEqual(42);
    });

    it('should throw an error if the event is not an issue, pull request, or comment event', () => {
      const context: Context = { eventName: 'unknown', payload: {} } as any;
      expect(() => getIssueNumber(context)).toThrowError();
    });
  });
});
