import * as core from '@actions/core';
import * as github from '@actions/github';
import { IssueCommentCreatedEvent } from '@octokit/webhooks-types';
import { addComment, listComments } from './github/comment';
import { getPullRequestDiff } from './github/pulls';
import { isIssueCommentWith, isPullRequest, writeSummary } from './github/utils';
import { generateCompletion, generateIssuePrompt, generatePullRequestPrompt } from './openai/openai';

/**
 * The name and handle of the assistant.
 */
const ASSISTANT_NAME = 'AdaGPT';
const ASSISTANT_HANDLE = '@AdaGPT';

type Inputs = {
  github_token: string;
  issue_number: number;
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
  issue_number: parseInt(core.getInput('issue_number', { required: true })),
  openai_key: core.getInput('openai_key', { required: true }),
  openai_temperature: parseFloat(core.getInput('openai_temperature')),
  openai_top_p: parseFloat(core.getInput('openai_top_p')),
  openai_max_tokens: parseInt(core.getInput('openai_max_tokens')),
});

async function run(): Promise<void> {
  try {
    core.debug('Context');
    core.debug(JSON.stringify(github.context));

    if (!isIssueCommentWith(github.context, ASSISTANT_HANDLE)) {
      core.debug(`Event is not an issue comment containing ${ASSISTANT_HANDLE} handle. Skipping...`);
      return;
    }

    const inputs = getInputs();
    const { github_token, issue_number, openai_key, openai_temperature, openai_top_p, openai_max_tokens } = inputs;

    core.debug('Inputs');
    core.debug(JSON.stringify(inputs));

    const assistant = { handle: ASSISTANT_HANDLE, name: ASSISTANT_NAME };
    const { issue, comment: requestComment, repository } = github.context.payload as IssueCommentCreatedEvent;
    const comments = await listComments(github_token, issue_number);

    // filter out comments that were made after the request comment
    // TODO can we use the id instead?
    const previousComments = comments.filter((comment) => comment.created_at < requestComment.created_at);

    core.debug('Comments');
    core.debug(JSON.stringify(previousComments));

    const prompt = [];

    if (isPullRequest(github.context)) {
      const diff = await getPullRequestDiff(github_token, issue_number);

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
    } else {
      prompt.push(
        ...generateIssuePrompt({
          assistant,
          repository,
          issue,
          requestComment,
          previousComments,
        }),
      );
    }

    core.debug('Prompt');
    core.debug(JSON.stringify(prompt));

    if (prompt.length > 0) {
      // TODO handle max tokens limit
      const response = await generateCompletion(openai_key, {
        messages: prompt,
        temperature: openai_temperature,
        top_p: openai_top_p,
        max_tokens: openai_max_tokens,
      });

      const responseComment = await addComment(github_token, issue_number, response);
      core.debug('ResponseComment');
      core.debug(JSON.stringify(responseComment));

      await writeSummary(github.context, issue, requestComment, responseComment);
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
