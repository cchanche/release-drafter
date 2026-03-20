import * as core from '@actions/core'

export async function getGitHubTokenInfo(token: string): Promise<void> {
  try {
    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    // Print all response headers
    core.info('Response Headers:')
    response.headers.forEach((value, key) => {
      core.info(`${key}: ${value}`)
    })
  } catch (error) {
    core.error(JSON.stringify(error))
  }
}
