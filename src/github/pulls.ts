import * as github from '@actions/github'

/**
 * Returns the diff of a pull request.
 * @param github_token
 * @param issue_number
 * @returns
 */
export const getPullRequestDiff = async (github_token: string, issue_number: number): Promise<string> => {
  const { owner, repo } = github.context.repo
  const octokit = github.getOctokit(github_token)

  const { data: diff } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: issue_number,
    mediaType: {
      format: 'diff',
    },
  })

  // Shouldn't happen, just to satisfy TypeScript
  if (typeof diff !== 'string') throw new Error('Diff is not a string')

  return diff
}
