import * as core from '@actions/core';
import * as github from '@actions/github';
import { IssueCommentCreatedEvent } from '@octokit/webhooks-types';
import { addComment, listCommentsBefore } from './github/comment';
import { getIssue } from './github/issues';
import { getPullRequestDiff } from './github/pulls';
import {
  debug,
  getIssueNumber,
  isEventWith,
  isIssueCommentEvent,
  isIssueEvent,
  isPullRequestCommentEvent,
  isPullRequestEvent,
  writeContext,
  writeRequest,
  writeResponse,
} from './github/utils';
import { generateCompletion } from './openai/openai';
import { initAssistant, initIssue, initPreviousComments, initPullRequest } from './openai/prompts';

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
    debug('Context', { context: github.context });

    if (!isEventWith(github.context, ASSISTANT_HANDLE)) {
      debug(`Event doesn't contain ${ASSISTANT_HANDLE}. Skipping...`);
      return;
    }

    const inputs = getInputs();
    debug('Inputs', { inputs });

    const issueNumber = getIssueNumber(github.context);
    debug('Issue number', { issueNumber });

    const issue = await getIssue(inputs.github_token, issueNumber);
    debug('Issue', { issue });

    const repo = github.context.repo;

    const assistant = { handle: ASSISTANT_HANDLE, name: ASSISTANT_NAME };

    const diff = issue.pull_request ? await getPullRequestDiff(inputs.github_token, issueNumber) : '';

    const comments = github.context.payload?.comment
      ? await listCommentsBefore(inputs.github_token, issueNumber, github.context.payload.comment.id)
      : [];

    // filter out comments that were made after the request comment
    // TODO can we use the id instead?
    // const previousComments = comments.filter((comment) => comment.created_at < requestComment.created_at);

    // core.debug('Comments');
    // core.debug(JSON.stringify(previousComments));

    const prompt = [];

    if (isPullRequestEvent(github.context)) {
      await writeRequest(issue);

      prompt.push(...initAssistant(assistant), ...initPullRequest(repo, issue, diff));
    } else if (isPullRequestCommentEvent(github.context)) {
      const { comment } = github.context.payload as IssueCommentCreatedEvent;
      await writeRequest(comment);

      prompt.push(
        ...initAssistant(assistant),
        ...initPullRequest(repo, issue, diff),
        ...initPreviousComments(issue, comments),
      );
    } else if (isIssueEvent(github.context)) {
      await writeRequest(issue);

      prompt.push(...initAssistant(assistant), ...initIssue(repo, issue));
    } else if (isIssueCommentEvent(github.context)) {
      const { comment } = github.context.payload as IssueCommentCreatedEvent;
      await writeRequest(comment);

      prompt.push(...initAssistant(assistant), ...initIssue(repo, issue), ...initPreviousComments(issue, comments));
    } else {
      throw new Error(`Unsupported event: ${github.context.eventName}`);
    }

    debug('Prompt', { prompt });

    if (prompt.length > 0) {
      // TODO handle max tokens limit
      const completion = await generateCompletion(inputs.openai_key, {
        messages: prompt,
        temperature: inputs.openai_temperature,
        top_p: inputs.openai_top_p,
        max_tokens: inputs.openai_max_tokens,
      });

      const response = await addComment(inputs.github_token, issueNumber, completion);
      debug('Response', { response });

      await writeResponse(response);
    }

    await writeContext(github.context);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
