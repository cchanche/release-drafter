import "../../../../lodash.js";
import "../../../../lexer.js";
import "path";
import "fs";
import { c as coreExports } from "../../../../core.js";
import { getOctokit } from "../../../../common/get-octokit.js";
import "../../../../index2.js";
import "../../../../common/shared-input.schema.js";
import { c as context } from "../../../../github.js";
import { sortReleases } from "./sort-releases.js";
import { s as semver } from "../../../../index.js";
const RELEASE_COUNT_LIMIT = 1e3;
const findPreviousReleases = async (params) => {
  const {
    commitish,
    "filter-by-commitish": filterByCommitish,
    "include-pre-releases": includePreReleases,
    "tag-prefix": tagPrefix,
    "filter-by-range": filterByRange
  } = params;
  const octokit = getOctokit();
  coreExports.info("Fetching releases from GitHub...");
  let releaseCount = 0;
  const releases = await octokit.paginate(
    octokit.rest.repos.listReleases,
    {
      ...context.repo,
      per_page: 100
    },
    (response, done) => {
      releaseCount += response.data.length;
      if (releaseCount >= RELEASE_COUNT_LIMIT) {
        done();
      }
      return response.data;
    }
  );
  coreExports.info(`Found ${releases.length} releases`);
  const headRefRegex = /^refs\/heads\//;
  const targetCommitishName = commitish.replace(headRefRegex, "");
  const commitishFilteredReleases = filterByCommitish ? releases.filter(
    (r) => targetCommitishName === r.target_commitish.replace(headRefRegex, "")
  ) : releases;
  const semverRangeFilteredReleases = filterByRange && filterByRange !== "*" ? commitishFilteredReleases.filter((r) => {
    const parsedRange = semver.validRange(filterByRange);
    const parsedVersion = semver.coerce(r.tag_name)?.version;
    if (!parsedVersion) {
      coreExports.warning(
        `Failed to coerce semver version for "${r.tag_name}" : will be excluded from releases considered for drafting.`
      );
      return false;
    }
    const satisfies = !!semver.satisfies(parsedVersion, parsedRange);
    coreExports.debug(
      `Range "${parsedRange}" ${satisfies ? "satisfies" : "does not satisfy"} version "${parsedVersion}" `
    );
    return satisfies;
  }) : commitishFilteredReleases;
  const filteredReleases = tagPrefix ? semverRangeFilteredReleases.filter(
    (r) => r.tag_name.startsWith(tagPrefix)
  ) : semverRangeFilteredReleases;
  const sortedSelectedReleases = sortReleases({
    releases: filteredReleases.filter(
      (r) => !r.draft && (!r.prerelease || includePreReleases)
    ),
    tagPrefix
  });
  const draftRelease = filteredReleases.find(
    (r) => r.draft && r.prerelease === includePreReleases
  );
  const lastRelease = sortedSelectedReleases.at(-1);
  if (draftRelease) {
    coreExports.info(`Draft release:`);
    coreExports.info(`  tag_name:  ${draftRelease.tag_name}`);
    coreExports.info(`  name:      ${draftRelease.name}`);
  } else {
    coreExports.info(`No draft release found`);
  }
  if (lastRelease) {
    coreExports.info(
      `Last release${includePreReleases ? " (including prerelease)" : ""}:`
    );
    coreExports.info(`  tag_name:  ${lastRelease.tag_name}`);
    coreExports.info(`  name:      ${lastRelease.name}`);
  } else {
    coreExports.info(`No last release found`);
  }
  return { draftRelease, lastRelease };
};
export {
  findPreviousReleases
};
