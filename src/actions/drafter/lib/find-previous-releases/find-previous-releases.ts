import { getOctokit } from 'src/common'
import { context } from '@actions/github'
import * as core from '@actions/core'
import { sortReleases } from './sort-releases'
import { type ParsedConfig } from '../../config'
import semver from 'semver'

// GitHub API currently returns a 500 HTTP response if you attempt to fetch over 1000 releases.
const RELEASE_COUNT_LIMIT = 1000

/**
 * Lists every release and :
 * - filters by commitish if specified
 * - filters by tag-prefix if specified
 * - excludes by exclude-tag-prefix if specified
 * - filters out pre-releases unless specified
 * - extracts the first draft releases (according to return-order of GitHub API)
 * - get latest published release according to ./sort-releases.ts implementation
 *
 * Returns one of (or both) draft release and latest published release
 */
export const findPreviousReleases = async (
  params: Pick<
    ParsedConfig,
    | 'commitish'
    | 'filter-by-commitish'
    | 'include-pre-releases'
    | 'tag-prefix'
    | 'exclude-tag-prefix'
    | 'filter-by-range'
  >
) => {
  const {
    commitish,
    'filter-by-commitish': filterByCommitish,
    'include-pre-releases': includePreReleases,
    'tag-prefix': tagPrefix,
    'exclude-tag-prefix': excludeTagPrefix,
    'filter-by-range': filterByRange
  } = params
  const octokit = getOctokit()

  core.info('Fetching releases from GitHub...')

  let releaseCount = 0
  const releases = await octokit.paginate(
    octokit.rest.repos.listReleases,
    {
      ...context.repo,
      per_page: 100
    },
    (response, done) => {
      releaseCount += response.data.length
      if (releaseCount >= RELEASE_COUNT_LIMIT) {
        done()
      }
      return response.data
    }
  )

  core.info(`Found ${releases.length} releases`)

  // `refs/heads/branch` and `branch` are the same thing in this context
  const headRefRegex = /^refs\/heads\//
  const targetCommitishName = commitish.replace(headRefRegex, '')
  const commitishFilteredReleases = filterByCommitish
    ? releases.filter(
        (r) =>
          targetCommitishName === r.target_commitish.replace(headRefRegex, '')
      )
    : releases
  const semverRangeFilteredReleases =
    filterByRange && filterByRange !== '*'
      ? commitishFilteredReleases.filter((r) => {
          const parsedRange = semver.validRange(filterByRange)! // ensured by config validation
          const parsedVersion = semver.coerce(r.tag_name)?.version

          if (!parsedVersion) {
            core.warning(
              `Failed to coerce semver version for "${r.tag_name}" : will be excluded from releases considered for drafting.`
            )
            return false
          }

          const satisfies = !!semver.satisfies(parsedVersion, parsedRange)

          core.debug(
            `Range "${parsedRange}" ${
              satisfies ? 'satisfies' : 'does not satisfy'
            } version "${parsedVersion}" `
          )

          return satisfies
        })
      : commitishFilteredReleases
  const tagPrefixFilteredReleases = tagPrefix
    ? semverRangeFilteredReleases.filter((r) =>
        r.tag_name.startsWith(tagPrefix)
      )
    : semverRangeFilteredReleases
  const filteredReleases = excludeTagPrefix
    ? tagPrefixFilteredReleases.filter(
        (r) => !r.tag_name.startsWith(excludeTagPrefix)
      )
    : tagPrefixFilteredReleases
  const sortedSelectedReleases = sortReleases({
    releases: filteredReleases.filter(
      (r) => !r.draft && (!r.prerelease || includePreReleases)
    ),
    tagPrefix
  })
  const draftRelease = filteredReleases.find(
    (r) => r.draft && r.prerelease === includePreReleases
  )
  const lastRelease = sortedSelectedReleases.at(-1)

  if (draftRelease) {
    core.info(`Draft release:`)
    core.info(`  tag_name:  ${draftRelease.tag_name}`)
    core.info(`  name:      ${draftRelease.name}`)
  } else {
    core.info(`No draft release found`)
  }

  if (lastRelease) {
    core.info(
      `Last release${includePreReleases ? ' (including prerelease)' : ''}:`
    )
    core.info(`  tag_name:  ${lastRelease.tag_name}`)
    core.info(`  name:      ${lastRelease.name}`)
  } else {
    core.info(`No last release found`)
  }

  return { draftRelease, lastRelease }
}
