import { initAssistant, initIssue, initPullRequest, initComments } from '../prompts';

describe('initAssistant', () => {
  test('returns a chat completion request message', () => {
    expect(initAssistant('John Doe', '@johndoe')).toMatchInlineSnapshot(`
      [
        {
          "content": "You are a helpful assistant for GitHub issues and pull requests.
      Your name is John Doe and your handle is @johndoe.
      You respond to comments when someone mentions you.",
          "role": "system",
        },
      ]
    `);
  });
});

describe('initIssue', () => {
  test('returns a chat completion request message', () => {
    const repo = {
      owner: 'octocat',
      repo: 'Hello-World',
    };
    const issue = {
      user: {
        login: 'johndoe',
      },
      number: 42,
      title: 'Example Issue',
      body: 'This is an example issue.',
    } as any;
    expect(initIssue(repo, issue)).toMatchInlineSnapshot(`
      [
        {
          "content": "The current issue was created by johndoe in repository Hello-World.
      Issue number: 42
      Issue title: \`Example Issue\`
      Issue description:
      \`\`\`
      This is an example issue.
      \`\`\`",
          "role": "system",
        },
      ]
    `);
  });
});

describe('initPullRequest', () => {
  test('returns a chat completion request message', () => {
    const repo = {
      owner: 'octocat',
      repo: 'Hello-World',
    };
    const pullRequest = {
      user: {
        login: 'johndoe',
      },
      number: 42,
      title: 'Example Pull Request',
      body: 'This is an example pull request.',
    } as any;
    const diff =
      'diff --git a/file1 b/file1\nindex 0000001..0000002 100644\n--- a/file1\n+++ b/file1\n@@ -1,3 +1,4 @@\n+line4\n line1\n line2\n line3';
    expect(initPullRequest(repo, pullRequest, diff)).toMatchInlineSnapshot(`
      [
        {
          "content": "The current pull request was created by johndoe in repository Hello-World.
      Pull request number: 42
      Pull request title: \`Example Pull Request\`
      Pull request description:
      \`\`\`
      This is an example pull request.
      \`\`\`",
          "role": "system",
        },
        {
          "content": "Git diff:
      diff --git a/file1 b/file1
      index 0000001..0000002 100644
      --- a/file1
      +++ b/file1
      @@ -1,3 +1,4 @@
      +line4
       line1
       line2
       line3",
          "role": "system",
        },
      ]
    `);
  });
});

describe('initComments', () => {
  test('returns empty array for empty comments', () => {
    expect(initComments([])).toMatchInlineSnapshot(`[]`);
  });

  test('returns chat completion request messages for comments', () => {
    const comments = [
      {
        body: '@assistant Hello!',
        user: {
          login: 'johndoe',
        },
      },
      {
        body: '@assistant Hello!',
        user: {
          login: 'johndoe',
        },
      },
      {
        body: 'This is a comment.',
        user: {
          login: 'janedoe',
        },
      },
      {
        body: '@assistant This is a reply to you.',
        user: {
          login: 'janedoe',
        },
      },
    ] as any;
    expect(initComments(comments)).toMatchInlineSnapshot(`
      [
        {
          "content": "Here are the comments:",
          "role": "system",
        },
        {
          "content": "@assistant Hello!",
          "name": "johndoe",
          "role": "user",
        },
        {
          "content": "@assistant Hello!",
          "name": "johndoe",
          "role": "user",
        },
        {
          "content": "This is a comment.",
          "name": "janedoe",
          "role": "user",
        },
        {
          "content": "@assistant This is a reply to you.",
          "name": "janedoe",
          "role": "user",
        },
      ]
    `);
  });
});
