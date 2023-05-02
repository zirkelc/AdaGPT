import * as core from '@actions/core';
import * as github from '@actions/github';
import { IssueCommentCreatedEvent } from '@octokit/webhooks-types';
import { addComment, listPreviousComments } from './github/comment';
import { getPullRequestDiff } from './github/pulls';
import {
  getIssueNumber,
  isEventWith,
  isIssueCommentEvent,
  isPullRequestCommentEvent,
  writeSummary,
} from './github/utils';
import { generateCompletion, generateIssuePrompt, generatePullRequestPrompt } from './openai/openai';

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
      core.debug(`Event doesn't contain ${ASSISTANT_HANDLE}. Skipping...`);
      return;
    }

    const issueNumber = getIssueNumber(github.context);
    core.debug(`IssueNumber: ${issueNumber}`);

    const inputs = getInputs();
    core.debug('Inputs');
    core.debug(JSON.stringify(inputs));

    const assistant = { handle: ASSISTANT_HANDLE, name: ASSISTANT_NAME };
    const { issue, comment: requestComment, repository } = github.context.payload as IssueCommentCreatedEvent;
    const previousComments = await listPreviousComments(inputs.github_token, issueNumber, requestComment.id);

    core.debug('Comments');
    core.debug(JSON.stringify(previousComments));

    const prompt = [];

    if (isPullRequestCommentEvent(github.context)) {
      const diff = await getPullRequestDiff(inputs.github_token, issueNumber);

      core.debug('Diff');
      core.debug(diff);

      prompt.push(
        ...generatePullRequestPrompt({
          assistant,
          repository,
          issue,
          requestComment,
          previousComments,
          diff,
        }),
      );
    } else if (isIssueCommentEvent(github.context)) {
      prompt.push(
        ...generateIssuePrompt({
          assistant,
          repository,
          issue,
          requestComment,
          previousComments,
        }),
      );
    } else {
      core.debug('Event is not an issue or pull request comment. Skipping...');
      return;
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

      await writeSummary(github.context, issue, requestComment, responseComment);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
