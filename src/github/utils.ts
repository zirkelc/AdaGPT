import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import {
  Issue,
  IssueComment,
  IssueCommentCreatedEvent,
  IssuesOpenedEvent,
  PullRequest,
  PullRequestOpenedEvent,
} from '@octokit/webhooks-types';

/**
 * Returns true if the event originated from an issue event.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues
 * @param context
 * @returns
 */
export const isIssueEvent = (context: Context): boolean => {
  return context.eventName === 'issues';
};

/**
 * Returns true if the event originated from a pull request event.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request
 * @param context
 * @returns
 */
export const isPullRequestEvent = (context: Context): boolean => {
  return context.eventName === 'pull_request';
};

/**
 * Returns true if the event originated from an issue comment.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @returns
 */
export const isIssueCommentEvent = (context: Context): boolean => {
  return context.eventName === 'issue_comment' && context.payload.issue?.pull_request === undefined;
};

/**
 * Returns true if the event originated from a pull request comment.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @returns
 */
export const isPullRequestCommentEvent = (context: Context): boolean => {
  return context.eventName === 'issue_comment' && context.payload.issue?.pull_request !== undefined;
};

/**
 * Returns true if the event paylod contains the search string.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads
 * @param context
 * @returns
 */
export const isEventWith = (context: Context, search: string): boolean => {
  if (isIssueEvent(context)) {
    const payload = context.payload as IssuesOpenedEvent;
    return !!payload.issue.body && payload.issue.body.toLowerCase().includes(search.toLowerCase());
  }

  if (isPullRequestEvent(context)) {
    const payload = context.payload as PullRequestOpenedEvent;
    return !!payload.pull_request.body && payload.pull_request.body.toLowerCase().includes(search.toLowerCase());
  }

  if (isIssueCommentEvent(context) || isPullRequestCommentEvent(context)) {
    const payload = context.payload as IssueCommentCreatedEvent;
    return payload.comment.body.toLowerCase().includes(search.toLowerCase());
  }

  return false;
};

/**
 * Returns the issue number from the event payload.
 * Throws an error if the event is not an issue, pull request, or comment.
 * @param context
 * @returns
 */
export const getIssueNumber = (context: Context): number => {
  if (isIssueEvent(context)) {
    const payload = context.payload as IssuesOpenedEvent;
    return payload.issue.number;
  }

  if (isPullRequestEvent(context)) {
    const payload = context.payload as PullRequestOpenedEvent;
    return payload.pull_request.number;
  }

  if (isIssueCommentEvent(context) || isPullRequestCommentEvent(context)) {
    const payload = context.payload as IssueCommentCreatedEvent;
    return payload.issue.number;
  }

  throw new Error(`Could not determine issue number from event "${context.eventName}"`);
};

export type Repo = { owner: string; repo: string };
/**
 * Returns the owner and name of the repository.
 * @returns
 */
export const getRepo = (): Repo => {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
  return { owner, repo };
};

/**
 * Writes a summary of the request and response to the job log.
 * @see https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/
 */
export const writeSummary = async (
  context: Context,
  issue: Issue | PullRequest,
  request: Issue | PullRequest | IssueComment,
  response: Issue | PullRequest | IssueComment,
): Promise<void> => {
  await core.summary
    .addLink('Issue', issue.html_url)
    .addHeading('Request', 3)
    .addRaw(request.body ?? '', true)
    .addBreak()
    .addLink('Comment', request.html_url)
    .addHeading('Response', 3)
    .addRaw(response.body ?? '', true)
    .addBreak()
    .addLink('Comment', response.html_url)
    .addBreak()
    .addHeading('GitHub Context', 3)
    .addCodeBlock(JSON.stringify(context.payload, null, 2), 'json')
    .write();
};
