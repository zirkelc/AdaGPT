import * as core from '@actions/core';
import * as github from '@actions/github';
import { IssueCommentCreatedEvent, IssuesOpenedEvent, PullRequestOpenedEvent } from '@octokit/webhooks-types';
import { addComment, listComments } from './github/comment';
import { getPullRequestDiff } from './github/pulls';
import {
  getIssueNumber,
  isEventWith,
  isIssueCommentEvent,
  isIssueEvent,
  isPullRequestCommentEvent,
  isPullRequestEvent,
  writeSummary,
} from './github/utils';
import { generateCompletion } from './openai/openai';
import { initAssistant, initIssue, initPreviousComments, initPullRequest } from './openai/prompts';
import { getIssue } from './github/issues';

/**
 * The name and handle of the assistant.
 */
const ASSISTANT_NAME = 'AdaGPT';
const ASSISTANT_HANDLE = '@AdaGPT';

type Inputs = {
  github_token: string;
  openai_key: string;
  openai_temperature?: number;
  openai_top_p?: number;
  openai_max_tokens?: number;
};

/**
 * Returns the inputs for the action.
 * @returns
 */
const getInputs = (): Inputs => ({
  github_token: core.getInput('github_token', { required: true }),
  openai_key: core.getInput('openai_key', { required: true }),
  openai_temperature: parseFloat(core.getInput('openai_temperature')),
  openai_top_p: parseFloat(core.getInput('openai_top_p')),
  openai_max_tokens: parseInt(core.getInput('openai_max_tokens')),
});

async function run(): Promise<void> {
  try {
    core.debug('Context');
    core.debug(JSON.stringify(github.context));

    if (!isEventWith(github.context, ASSISTANT_HANDLE)) {
      core.debug(`Event is not an issue comment containing ${ASSISTANT_HANDLE} handle. Skipping...`);
      return;
    }

    const inputs = getInputs();
    core.debug('Inputs');
    core.debug(JSON.stringify(inputs));

    const issueNumber = getIssueNumber(github.context);
    core.debug(`Issue number: ${issueNumber}`);

    const issue = await getIssue(inputs.github_token, issueNumber);
    core.debug('Issue');
    core.debug(JSON.stringify(issue));

    const repo = github.context.repo;

    const assistant = { handle: ASSISTANT_HANDLE, name: ASSISTANT_NAME };
    // const { issue, comment: requestComment, repository } = github.context.payload as IssueCommentCreatedEvent;
    const comments = await listComments(inputs.github_token, issueNumber);

    // filter out comments that were made after the request comment
    // TODO can we use the id instead?
    const previousComments = comments.filter((comment) => comment.created_at < requestComment.created_at);

    core.debug('Comments');
    core.debug(JSON.stringify(previousComments));

    const prompt = [];

    if (isPullRequestEvent(github.context)) {
      // const { pull_request: issue, repository } = github.context.payload as PullRequestOpenedEvent;

      const diff = await getPullRequestDiff(inputs.github_token, issueNumber);
      core.debug('Diff');
      core.debug(diff);

      prompt.push(...initAssistant(assistant), ...initPullRequest(repo, issue, diff));
    } else if (isPullRequestCommentEvent(github.context)) {
      // const { issue, repository } = github.context.payload as IssueCommentCreatedEvent;

      const diff = await getPullRequestDiff(inputs.github_token, issueNumber);
      core.debug('Diff');
      core.debug(diff);

      prompt.push(
        ...initAssistant(assistant),
        ...initPullRequest(repo, issue, diff),
        ...initPreviousComments(issue, previousComments),
        // ...initRequestComment(issue, requestComment),
      );
    } else if (isIssueEvent(github.context)) {
      // const { issue, repository } = github.context.payload as IssuesOpenedEvent;

      prompt.push(...initAssistant(assistant), ...initIssue(repo, issue));
    } else if (isIssueCommentEvent(github.context)) {
      // const { issue, repository } = github.context.payload as IssueCommentCreatedEvent;

      prompt.push(
        ...initAssistant(assistant),
        ...initIssue(repo, issue),
        ...initPreviousComments(issue, previousComments),
        // ...initRequestComment(issue, requestComment),
      );
    } else {
      throw new Error(`Unsupported event: ${github.context.eventName}`);
    }

    core.debug('Prompt');
    core.debug(JSON.stringify(prompt));

    if (prompt.length > 0) {
      // TODO handle max tokens limit
      const response = await generateCompletion(inputs.openai_key, {
        messages: prompt,
        temperature: inputs.openai_temperature,
        top_p: inputs.openai_top_p,
        max_tokens: inputs.openai_max_tokens,
      });

      const responseComment = await addComment(inputs.github_token, issueNumber, response);
      core.debug('ResponseComment');
      core.debug(JSON.stringify(responseComment));

      // TODO
      // await writeSummary(github.context, issue, requestComment, responseComment);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
