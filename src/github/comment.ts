import * as github from '@actions/github';
import type { IssueComment } from '@octokit/webhooks-types';

/**
 * Returns all comments on an issue or pull request.
 * @param github_token
 * @param issue_number
 * @returns
 */
export async function listComments(github_token: string, issue_number: number): Promise<IssueComment[]> {
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(github_token);

  // pagination: https://github.com/octokit/octokit.js#pagination
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
    per_page: 100,
  });

  return comments as IssueComment[];
}

export const listPreviousComments = async (
  github_token: string,
  issue_number: number,
  comment_id: number,
): Promise<IssueComment[]> => {
  const comments = await listComments(github_token, issue_number);

  const index = comments.findIndex((comment) => comment.id === comment_id);

  return comments.slice(0, index);
};

/**
 * Adds a comment to an issue or pull request.
 * @param github_token
 * @param issue_number
 * @param body
 * @returns
 */
export async function addComment(github_token: string, issue_number: number, body: string): Promise<IssueComment> {
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(github_token);

  const comment = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body,
  });

  return comment.data as IssueComment;
}
