export const groupBy = <T>(
  collection: ReadonlyArray<T>,
  iteratee: (value: T) => unknown
): Record<string, T[]> =>
  collection.reduce<Record<string, T[]>>((result, value) => {
    const key = String(iteratee(value))

    if (!result[key]) {
      result[key] = []
    }

    result[key].push(value)

    return result
  }, {})
