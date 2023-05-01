# AdaGPT GitHub Action
AdaGPT is an AI-powered GitHub Action for Issues and Pull Requests. 
It's like having a discussion with ChatGPT, but without actually leaving GitHub and available to everyone.

## Who's Ada?
Ada is named after [Ada Lovelace](https://en.wikipedia.org/wiki/Ada_Lovelace), a pioneer of computer programming and the first person to write an algorithm intended to be processed by a machine. Ada is considered the first computer programmer and a symbol of women's contributions to science and technology.

## How it works
To use AdaGPT, simply mention @AdaGPT in your comments on issues and pull requests. AdaGPT will be triggered and respond to your comment with a helpful response.

## Usage
Create a workflow file (e.g. `.github/workflows/adagpt.yml`) that will be executed on `issue_comment` events.

```yaml
name: 'AdaGPT'

on:
  issue_comment:
    types: [created]

# Allows the workflow to create comments on issues and pull requests
permissions:
  issues: write
  pull-requests: write

jobs:
  issue_comment:
    name: Issue and PR comments
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3  
      - uses: zirkelc/adagpt@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_key: ${{ secrets.OPENAI_KEY }}
          issue_number: ${{ github.event.issue.number }}
```

Check out [`main.yml`](./.github/workflows/main.yml) for a working demo.

### Permissions
The `GITHUB_TOKEN` requires the following permissions to create comments on issues and pull requests:
- `issues: write`
- `pull-requests: write`

Add these permissions to your workflow or individual jobs using the `permissions` keyword.
See [GitHub's documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow) for more information.

### Secrets
Sensitive information, such as the OpenAI API key, should be stored as [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) in the repository.

Add the OpenAI API key as a secret in your repository and reference it using the `${{ secrets.OPENAI_KEY }}` syntax.

## Action Inputs
| Name               | Required | Default | Description                                                                                                                                            |   |   |   |   |   |   |
|--------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------|---|---|---|---|---|---|
| `github_token`     | Yes      |         | The access token used to retrieve and create comments on the issues and pull requests. This will typically be your GitHub token. If so, use `${{ secrets.GITHUB_TOKEN }}` |   |   |   |   |   |   |
| `issue_number`       | Yes      |         | The number of the issue or pull request. If the workflow was triggered on the `issue_comment` event, use `${{ github.event.issue.number }}`                                                                              |   |   |   |   |   |   |
| `openai_key`       | Yes      |         | The API key used for OpenAI chat completion request. Go to [OpenAI](https://platform.openai.com/account/api-keys) to create a new API key              |   |   |   |   |   |   |
| `openai_temperature` | No       | 0.8     | What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. See [API reference](https://platform.openai.com/docs/api-reference/chat/create#completions/create-temperature) for more information.                                                                                                                                                      |   |   |   |   |   |   |
| `openai_top_p`       | No       | 0       | An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. See [API reference](https://platform.openai.com/docs/api-reference/chat/create#completions/create-top_p) for more information.                                                                                                                                                       |   |   |   |   |   |   |
| `openai_max_tokens`  | No       | 4096    | The maximum number of tokens to generate in the completion. See [API reference](https://platform.openai.com/docs/api-reference/chat/create#completions/create-max_tokens) for more information.

# Examples


# License
AdaGPT is licensed under the MIT License. See the LICENSE file for more information.