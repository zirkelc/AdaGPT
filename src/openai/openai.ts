import * as core from '@actions/core';
import { Issue, IssueComment, Repository } from '@octokit/webhooks-types';
import { isAxiosError } from 'axios';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from 'openai';
import { escapeComment, escapeUser, isCommentByAssistant, unescapeComment } from './utils';

type Assistant = {
  name: string;
  handle: string;
};

type PromptInput = {
  assistant: Assistant;
  repository: Repository;
  issue: Issue;
  requestComment: IssueComment;
  previousComments: IssueComment[];
};

type IssuePromptInput = PromptInput & {};

type PullRequestPromptInput = PromptInput & {
  diff: string;
};

const initAssistant = (assistant: Assistant): ChatCompletionRequestMessage[] => {
  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: [
        `You are a helpful assistant for GitHub issues and pull requests.`,
        `Your name is "${assistant.name}" and your handle is ${assistant.handle}.`,
        `You respond to comments when someone includes your handle ${assistant.handle}.`,
      ].join('\n'),
    },
  ];
};

const initIssue = (repository: Repository, issue: Issue): ChatCompletionRequestMessage[] => {
  const issueOrPullRequest = issue.pull_request ? 'pull request' : 'issue';

  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: [
        `
The current ${issueOrPullRequest} was created by ${escapeUser(issue.user.login)} in repository ${
          repository.full_name
        }.`,
        `${issueOrPullRequest} number: ${issue.number}`,
        `${issueOrPullRequest} title: ${issue.title}`,
        `${issueOrPullRequest} content: ${issue.body}`,
      ].join('\n'),
    },
  ];
};

const initPullRequest = (repository: Repository, issue: Issue, diff: string): ChatCompletionRequestMessage[] => {
  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: `I will provide you with the git diff of the pull request.`,
    },
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: diff,
    },
  ];
};

const initPreviousComments = (issue: Issue, comments: IssueComment[]): ChatCompletionRequestMessage[] => {
  const issueOrPullRequest = issue.pull_request ? 'pull request' : 'issue';

  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: `I will provide you with a list of previous comments that were already made on the ${issueOrPullRequest}.`,
    },
    ...comments.map((comment) =>
      isCommentByAssistant(comment.body)
        ? {
            role: ChatCompletionRequestMessageRoleEnum.Assistant,
            content: unescapeComment(comment.body),
          }
        : {
            role: ChatCompletionRequestMessageRoleEnum.User,
            name: escapeUser(comment.user.login),
            content: unescapeComment(comment.body),
          },
    ),
  ];
};

const initRequestComment = (issue: Issue, comment: IssueComment): ChatCompletionRequestMessage[] => {
  const issueOrPullRequest = issue.pull_request ? 'pull request' : 'issue';

  return [
    {
      role: ChatCompletionRequestMessageRoleEnum.User,
      name: escapeUser(comment.user.login),
      content: unescapeComment(comment.body),
    },
    {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: [
        `The last comment was made by ${escapeUser(comment.user.login)}.`,
        `This comment activated you, so you should respond to it.`,
        `Consider the current ${issueOrPullRequest} and the previous comments when you respond.`,
      ].join('\n'),
    },
  ];
};

/**
 * Generates an issue comment prompt for the OpenAI API.
 * @param input
 * @returns
 */
export const generateIssuePrompt = (input: IssuePromptInput): ChatCompletionRequestMessage[] => {
  const { assistant, repository, issue, requestComment, previousComments } = input;

  return [
    ...initAssistant(assistant),
    ...initIssue(repository, issue),
    ...initPreviousComments(issue, previousComments),
    ...initRequestComment(issue, requestComment),
  ];
};

/**
 * Generates an issue comment prompt for the OpenAI API.
 * @param input
 * @returns
 */
export const generateIssueCommentPrompt = (input: IssuePromptInput): ChatCompletionRequestMessage[] => {
  const { assistant, repository, issue, requestComment, previousComments } = input;

  return [
    ...initAssistant(assistant),
    ...initIssue(repository, issue),
    ...initPreviousComments(issue, previousComments),
    ...initRequestComment(issue, requestComment),
  ];
};

/**
 * Generates a pull request comment prompt for the OpenAI API.
 * @param input
 * @returns
 */
export const generatePullRequestCommentPrompt = (input: PullRequestPromptInput): ChatCompletionRequestMessage[] => {
  const { assistant, repository, issue, requestComment, previousComments, diff } = input;

  return [
    ...initAssistant(assistant),
    ...initIssue(repository, issue),
    ...initPullRequest(repository, issue, diff),
    ...initPreviousComments(issue, previousComments),
    ...initRequestComment(issue, requestComment),
  ];
};

/**
 * Creates a chat completion using the OpenAI API.
 * @param openai_key
 * @param messages
 * @returns
 */
export async function generateCompletion(
  openai_key: string,
  request: Omit<CreateChatCompletionRequest, 'model' | 'n' | 'stream'>,
): Promise<string> {
  const openAi = new OpenAIApi(
    new Configuration({
      apiKey: openai_key,
    }),
  );

  try {
    const completion = await openAi.createChatCompletion({
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
      ...request,
      n: 1,
      stream: false,
    });

    core.debug('Completion');
    core.debug(JSON.stringify(completion, null, 2));

    if (!completion.data.choices[0].message?.content || completion.data.choices[0].finish_reason !== 'stop') {
      // https://platform.openai.com/docs/guides/chat/response-format
      core.debug(`API return incomplete: ${completion.data.choices[0].finish_reason}`);
      throw new Error(`API return incomplete: ${completion.data.choices[0].finish_reason}`);
    }

    const content = completion.data.choices[0].message?.content;

    // Escape the content to identify the assistant's comments.
    return escapeComment(content);
  } catch (error) {
    if (isAxiosError(error)) {
      const response = error.response;
      if (response?.status === 429) {
        core.debug(
          'Request to OpenAI failed with status 429. This is due to incorrect billing setup or excessive quota usage. Please follow this guide to fix it: https://help.openai.com/en/articles/6891831-error-code-429-you-exceeded-your-current-quota-please-check-your-plan-and-billing-details',
        );
      } else {
        core.error(`Request to OpenAI failed with status ${response?.status}: ${response?.data?.error?.message}`);
      }
    } else {
      const message = error instanceof Error ? error.message : error;
      core.error(`Request to OpenAI failed: ${message}`);
    }

    throw error;
  }
}
