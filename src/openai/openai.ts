import * as core from '@actions/core';
import { isAxiosError } from 'axios';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { escapeComment } from './utils';
import { debug } from '../github/utils';

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

    debug('Completion', { completion: completion.data });

    if (!completion.data.choices[0].message?.content || completion.data.choices[0].finish_reason !== 'stop') {
      // https://platform.openai.com/docs/guides/chat/response-format
      throw new Error(`API return incomplete: ${completion.data.choices[0].finish_reason}`);
    }

    const content = completion.data.choices[0].message?.content;

    // Escape the content to identify the assistant's comments.
    return escapeComment(content);
  } catch (error) {
    if (isAxiosError(error)) {
      const response = error.response;
      if (response?.status === 429) {
        core.error(
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
