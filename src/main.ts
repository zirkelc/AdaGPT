import * as core from '@actions/core';
import * as github from '@actions/github';
import type { IssueCommentCreatedEvent } from '@octokit/webhooks-types';
import { addComment, listCommentsBefore } from './github/comment';
import { getIssue } from './github/issues';
import { getPullRequestDiff } from './github/pulls';
import { debug, getEventPayload, writeContext, writeResponse } from './github/utils';
import { generateCompletion } from './openai/openai';
import { initAssistant, initIssue, initPreviousComments, initPullRequest } from './openai/prompts';

/**
 * The name and handle of the assistant.
 */
const ASSISTANT_NAME = 'AdaGPT';
const ASSISTANT_HANDLE = '@AdaGPT';
const ASSISTANT_REGEX = /@adagpt/i;

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

    const request = getEventPayload(github.context);
    if (!request?.body || ASSISTANT_REGEX.test(request.body)) {
      debug(`Event doesn't contain ${ASSISTANT_HANDLE}. Skipping...`);
      return;
    }

    // if (!isEventWith(github.context, ASSISTANT_HANDLE)) {
    //   debug(`Event doesn't contain ${ASSISTANT_HANDLE}. Skipping...`);
    //   return;
    // }

    const inputs = getInputs();
    debug('Inputs', { inputs });

    // const issueNumber = getIssueNumber(github.context);
    // const iss = github.context.issue.number;
    // debug('Issue number', { issueNumber });

    const issue = await getIssue(inputs.github_token, github.context.issue.number);
    debug('Issue', { issue });

    const repo = github.context.repo;
    const assistant = { handle: ASSISTANT_HANDLE, name: ASSISTANT_NAME };

    const prompt = [...initAssistant(assistant)];

    if (issue.pull_request) {
      const diff = await getPullRequestDiff(inputs.github_token, github.context.issue.number);
      debug('Diff', { diff });

      prompt.push(...initPullRequest(repo, issue, diff));
    } else {
      prompt.push(...initIssue(repo, issue));
    }

    if (github.context.eventName === 'issue_comment') {
      const { comment } = github.context.payload as IssueCommentCreatedEvent;
      const comments = await listCommentsBefore(inputs.github_token, github.context.issue.number, comment.id);

      prompt.push(...initPreviousComments(issue, comments));
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

      const response = await addComment(inputs.github_token, github.context.issue.number, completion);
      debug('Response', { response });

      await writeResponse(response);
    }

    await writeContext(github.context);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
