import { findPullRequests } from '../find-pull-requests'
import { ParsedConfig } from '../../config'
import { context } from '@actions/github'
import { CommitParser } from 'conventional-commits-parser'
import { groupBy } from 'src/common'

export const generateIndividualCommitsChangelog = (
  commits: Awaited<ReturnType<typeof findPullRequests>>['commits'],
  config: Pick<ParsedConfig, 'no-changes-template'>
) => {
  const { owner, repo } = context.repo

  const commitsWithoutPullRequests = commits.filter(
    (c) => !c.associatedPullRequests?.nodes?.length
  )

  if (commitsWithoutPullRequests.length > 0) {
    const parser = new CommitParser({})

    const augmentedCommits = commitsWithoutPullRequests.map((c) => {
      return {
        ...c,
        parsed: c.message ? parser.parse(c.message) : undefined
      }
    })

    // TODO : handle bot users
    const writeCommit = (c: (typeof augmentedCommits)[number]) =>
      `-${c.parsed?.scope ? ` **${c.parsed?.scope}:**` : ''}${` ${
        c.parsed?.subject || c.parsed?.header || c.message || 'empty message'
      }`}${c.author?.user?.login ? ` @${c.author.user.login}` : ''}${
        c?.oid && repo && owner
          ? ` ([${c.oid.slice(
              0,
              7
            )}](https://github.com/${owner}/${repo}/commit/${c.oid}))`
          : ''
      }`

    const typedChanges = Object.entries(
      groupBy(augmentedCommits, (c) => {
        switch (c?.parsed?.type) {
          case 'feat':
            return '🚀 Features'
          case 'docs':
            return '📗 Documentation'
          case 'fix':
            return '🐛 Bug fixes'
          case 'build':
            return '⚙️ Build system'
          case 'test':
            return '🧪 Tests'
          case 'perf':
            return '⚡️ Performance'
          case 'refactor':
            return '♻️ Refactor'
          case 'ci':
            return '🚦 CI / CD'
          case 'chore':
          case 'revert':
            return '🧰 Maintenance'
          case 'style':
            return '🎨 Style'
          case undefined:
          case null:
          case '':
            return '🧐 Uncategorized'
          default:
            return c.parsed?.type
        }
      })
    )
      .map(
        ([type, commitsForType]) =>
          `### ${type}\n${commitsForType.map((c) => writeCommit(c)).join('\n')}`
      )
      .join('\n\n')

    return typedChanges
  } else {
    return config['no-changes-template']
  }
}
