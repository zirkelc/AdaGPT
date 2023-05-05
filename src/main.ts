import * as core from '@actions/core';
import * as github from '@actions/github';
import type { IssueCommentCreatedEvent } from '@octokit/webhooks-types';
import { addComment, listCommentsBefore } from './github/comment';
import { getIssue } from './github/issues';
import { getPullRequestDiff } from './github/pulls';
import { debug, getEventTrigger, writeSummary } from './github/utils';
import { generateCompletion } from './openai/openai';
import { initAssistant, initComments, initIssue, initPullRequest } from './openai/prompts';

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

    // get the event object that triggered the workflow
    // this can be an issue, pull request, or comment
    const trigger = getEventTrigger(github.context);
    debug('Trigger', { trigger });

    // check if the event body contains the assistant handle, otherwise skip
    if (!trigger?.body || !ASSISTANT_REGEX.test(trigger.body)) {
      debug(`Event doesn't contain ${ASSISTANT_HANDLE}. Skipping...`);
      return;
    }

    // get the inputs for the action
    const inputs = getInputs();
    debug('Inputs', { inputs });

    // read the issue or pull request from the GitHub API
    const issue = await getIssue(inputs.github_token, github.context.issue.number);
    debug('Issue', { issue });

    // get the repository information
    const repo = github.context.repo;

    // initialize the prompt with the assistant name and handle
    const prompt = [...initAssistant(ASSISTANT_NAME, ASSISTANT_HANDLE)];

    // the prompt for issues and pull requests is only slightly different
    // but the diff might be very long and we may have to exlude it in the future
    if (issue.pull_request) {
      // get the diff for the pull request
      const diff = await getPullRequestDiff(inputs.github_token, github.context.issue.number);
      debug('Diff', { diff });

      // add pull request and diff to the prompt
      prompt.push(...initPullRequest(repo, issue, diff));
    } else {
      // add issue to the prompt
      prompt.push(...initIssue(repo, issue));
    }

    // prompt for comments is the same for issues and pull requests
    if (github.context.eventName === 'issue_comment') {
      // get the comment that triggered the workflow and all comments before it
      const { comment } = github.context.payload as IssueCommentCreatedEvent;

      // get the comments before the current one that triggered the workflow
      // the workflow execution may be delayed, so we need to make sure we don't get comments after the current one
      const comments = await listCommentsBefore(inputs.github_token, github.context.issue.number, comment.id);

      // add the current comment to the end of the comments
      prompt.push(...initComments([...comments, comment]));
    }

    debug('Prompt', { prompt });

    // TODO handle max tokens limit
    // generate the completion from the prompt
    const completion = await generateCompletion(inputs.openai_key, {
      messages: prompt,
      temperature: inputs.openai_temperature,
      top_p: inputs.openai_top_p,
      max_tokens: inputs.openai_max_tokens,
    });

    // add the response as a comment to the issue or pull request
    const response = await addComment(inputs.github_token, github.context.issue.number, completion);
    debug('Response', { response });

    // write a summary of the trigger and response to the job log
    writeSummary(issue, trigger, response);
  } catch (error) {
    if (error instanceof Error) core.setFailed(error);
  }
}

run();
