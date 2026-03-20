import * as core from '@actions/core'
import { getOctokit, paginateGraphql } from 'src/common'
import findCommitsWithPrQuery from './graphql/find-commits-with-pr.gql?raw'
import type {
  FindCommitsWithAssociatedPullRequestsQuery,
  FindCommitsWithAssociatedPullRequestsQueryVariables,
} from './graphql/find-commits-with-pr.graphql.generated'

export const findCommitsWithPr = async (
  params: FindCommitsWithAssociatedPullRequestsQueryVariables,
) => {
  core.debug(
    `[findCommitsWithPr] called with params: ${JSON.stringify(params)}`,
  )
  const octokit = getOctokit()
  core.debug('[findCommitsWithPr] Obtained Octokit instance')

  core.debug('[findCommitsWithPr] Executing GraphQL query for commits with PRs')
  const data =
    await paginateGraphql<FindCommitsWithAssociatedPullRequestsQuery>(
      octokit.graphql,
      findCommitsWithPrQuery,
      params,
      ['repository', 'object', 'history'],
    )

  core.debug(
    `[findCommitsWithPr] GraphQL query result: ${JSON.stringify(data)}`,
  )

  if (data.repository?.object?.__typename !== 'Commit') {
    core.debug(
      `[findCommitsWithPr] Unexpected __typename: ${data.repository?.object?.__typename}`,
    )
    throw new Error('Query returned an unexpected result')
  }

  // Extract commit nodes from the paginated response
  core.debug('[findCommitsWithPr] Extracting commit nodes from response')
  const commits = (data.repository.object.history.nodes || []).filter(
    (commit): commit is NonNullable<typeof commit> => commit != null,
  )

  core.debug(`[findCommitsWithPr] Total commits extracted: ${commits.length}`)

  if (params.since) {
    core.debug(`[findCommitsWithPr] Filtering commits since: ${params.since}`)
    // GraphQL call is inclusive of commits from the specified dates.  This means the final
    // commit from the last tag is included, so we remove this here.
    const filteredCommits = commits.filter(
      (commit) =>
        !!commit?.committedDate && commit.committedDate !== params.since,
    )
    core.debug(
      `[findCommitsWithPr] Commits after filtering: ${filteredCommits.length}`,
    )
    return filteredCommits
  } else {
    core.debug('[findCommitsWithPr] Returning all commits (no since filter)')
    return commits
  }
}
