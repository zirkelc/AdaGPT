import * as github from '@actions/github';
import { Issue } from '@octokit/webhooks-types';

export const getIssue = async (github_token: string, issue_number: number): Promise<Issue> => {
  const { owner, repo } = github.context.repo;
  const octokit = github.getOctokit(github_token);

  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number,
  });

  return issue as Issue;
};
