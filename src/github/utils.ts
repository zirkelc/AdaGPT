import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import {
  Issue,
  IssueComment,
  IssueCommentCreatedEvent,
  IssuesOpenedEvent,
  PullRequestOpenedEvent,
} from '@octokit/webhooks-types';

/**
 * Returns true if the event paylod contains the search string.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads
 * @param context
 * @returns
 */
export const isEventWith = (context: Context, search: string): boolean => {
  if (context.eventName === 'issues') {
    const payload = context.payload as IssuesOpenedEvent;
    return !!payload.issue.body && payload.issue.body.toLowerCase().includes(search.toLowerCase());
  }

  if (context.eventName === 'pull_request') {
    const payload = context.payload as PullRequestOpenedEvent;
    return !!payload.pull_request.body && payload.pull_request.body.toLowerCase().includes(search.toLowerCase());
  }

  if (context.eventName === 'issue_comment') {
    const payload = context.payload as IssueCommentCreatedEvent;
    return payload.comment.body.toLowerCase().includes(search.toLowerCase());
  }

  return false;
};

/**
 * Returns true if the event originated from an issue event.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues
 * @param context
 * @returns
 */
export const isIssue = (context: Context): boolean => {
  return context.eventName === 'issues';
};

/**
 * Returns true if the event originated from a pull request event.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request
 * @param context
 * @returns
 */
export const isPullRequest = (context: Context): boolean => {
  return context.eventName === 'pull_request';
};

/**
 * Returns true if the event originated from an issue comment.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @returns
 */
export const isIssueComment = (context: Context): boolean => {
  return context.eventName === 'issue_comment' && context.payload.issue?.pull_request === undefined;
};

/**
 * Returns true if the event originated from a pull request comment.
 * @see https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issue_comment
 * @see https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
 * @param context
 * @returns
 */
export const isPullRequestComment = (context: Context): boolean => {
  return context.eventName === 'issue_comment' && context.payload.issue?.pull_request !== undefined;
};

export type Repo = { owner: string; name: string };
/**
 * Returns the owner and name of the repository.
 * @returns
 */
export const getRepo = (): Repo => {
  const [owner, name] = (process.env.GITHUB_REPOSITORY || '').split('/');
  return { owner, name };
};

/**
 * Writes a summary of the request and response to the job log.
 * @see https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/
 */
export const writeSummary = async (
  context: Context,
  issue: Issue,
  request: IssueComment,
  response: IssueComment,
): Promise<void> => {
  await core.summary
    .addLink('Issue', issue.html_url)
    .addHeading('Request', 3)
    .addRaw(request.body, true)
    .addBreak()
    .addLink('Comment', request.html_url)
    .addHeading('Response', 3)
    .addRaw(response.body, true)
    .addBreak()
    .addLink('Comment', response.html_url)
    .addBreak()
    .addHeading('GitHub Context', 3)
    .addCodeBlock(JSON.stringify(context.payload, null, 2), 'json')
    .write();
};
