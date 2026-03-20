import * as core from '@actions/core'
import type { RequestParameters } from '@octokit/graphql/types'

const getPath = <T = unknown>(obj: unknown, path: string[]): T => {
  core.debug(
    `[paginateGraphql/getPath] Resolving path: ${JSON.stringify(path)} on object: ${typeof obj === 'object' ? JSON.stringify(obj) : String(obj)}`,
  )
  const result = path.reduce(
    (acc, key) => (acc as Record<string, unknown>)?.[key],
    obj,
  ) as T
  core.debug(`[paginateGraphql/getPath] Result: ${JSON.stringify(result)}`)
  return result
}

const hasPath = (obj: unknown, path: string[]) => {
  const exists = getPath(obj, path) !== undefined
  core.debug(
    `[paginateGraphql/hasPath] Path ${JSON.stringify(path)} exists: ${exists}`,
  )
  return exists
}

const setPath = (obj: unknown, path: string[], value: unknown) => {
  core.debug(
    `[paginateGraphql/setPath] Setting path: ${JSON.stringify(path)} to value: ${JSON.stringify(value)}`,
  )
  const lastKey = path[path.length - 1]
  if (lastKey === undefined) return
  const parent = getPath<Record<string, unknown> | undefined>(
    obj,
    path.slice(0, -1),
  )
  if (parent == null) return
  parent[lastKey] = value
}

/**
 * Utility function to paginate a GraphQL function using Relay-style cursor pagination.
 *
 * @param {Function} queryFn - function used to query the GraphQL API
 * @param {string} query - GraphQL query, must include `nodes` and `pageInfo` fields for the field that will be paginated
 * @param {Object} variables
 * @param {string[]} paginatePath - path to field to paginate
 */
export async function paginateGraphql<T extends object>(
  client: typeof import('@octokit/graphql').graphql,
  query: string,
  requestParameters: RequestParameters,
  paginatePath: string[],
) {
  core.debug(
    `[paginateGraphql] Called with paginatePath: ${JSON.stringify(paginatePath)}, requestParameters: ${JSON.stringify(requestParameters)}`,
  )
  const nodesPath = [...paginatePath, 'nodes']
  const pageInfoPath = [...paginatePath, 'pageInfo']
  const endCursorPath = [...pageInfoPath, 'endCursor']
  const hasNextPagePath = [...pageInfoPath, 'hasNextPage']
  const hasNextPage = (data: T) => getPath(data, hasNextPagePath)

  core.debug(`[paginateGraphql] Executing initial GraphQL query`)
  const data = await client<T>(query, requestParameters)
  core.debug(`[paginateGraphql] Initial query result: ${JSON.stringify(data)}`)

  if (!hasPath(data, nodesPath)) {
    core.debug(
      `[paginateGraphql] Missing nodesPath: ${JSON.stringify(nodesPath)}`,
    )
    throw new Error(
      "Data doesn't contain `nodes` field. Make sure the `paginatePath` is set to the field you wish to paginate and that the query includes the `nodes` field.",
    )
  }

  if (
    !hasPath(data, pageInfoPath) ||
    !hasPath(data, endCursorPath) ||
    !hasPath(data, hasNextPagePath)
  ) {
    core.debug(
      `[paginateGraphql] Missing pageInfoPath or endCursorPath or hasNextPagePath`,
    )
    throw new Error(
      "Data doesn't contain `pageInfo` field with `endCursor` and `hasNextPage` fields. Make sure the `paginatePath` is set to the field you wish to paginate and that the query includes the `pageInfo` field.",
    )
  }

  let pageCount = 1
  while (hasNextPage(data)) {
    core.debug(
      `[paginateGraphql] Page ${pageCount}: hasNextPage=true, fetching next page...`,
    )
    const afterCursor = getPath(data, [...pageInfoPath, 'endCursor'])
    core.debug(
      `[paginateGraphql] Using after cursor: ${JSON.stringify(afterCursor)}`,
    )
    const newData = await client<T>(query, {
      ...requestParameters,
      after: afterCursor,
    })
    core.debug(`[paginateGraphql] New page data: ${JSON.stringify(newData)}`)
    const newNodes = getPath<unknown[]>(newData, nodesPath)
    const newPageInfo = getPath(newData, pageInfoPath)

    setPath(data, pageInfoPath, newPageInfo)
    setPath(data, nodesPath, [
      ...getPath<unknown[]>(data, nodesPath),
      ...newNodes,
    ])
    pageCount++
  }

  core.debug(`[paginateGraphql] Pagination complete. Total pages: ${pageCount}`)
  return data
}
